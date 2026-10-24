import { ok, route, readJson, AppError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { aiConfigured, callLLM } from "@/lib/ai/client";
import { getSettings, addDays, todayStr } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PARSE_TOOL = {
  type: "function",
  function: {
    name: "parse_leave_request",
    description:
      "Extract a leave request from the employee's plain-text sentence. Resolve relative words like 'next Monday' or 'tomorrow' into real dates.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["annual", "sick", "casual", "unpaid"],
          description: "annual=vacation, sick=illness, casual=personal events (weddings, family), unpaid=when paid quota is gone",
        },
        start: { type: "string", description: "Start date YYYY-MM-DD" },
        end: { type: "string", description: "End date YYYY-MM-DD (same as start for a single day)" },
        reason: { type: "string", description: "Short reason from the user's words" },
      },
      required: ["type", "start", "end", "reason"],
    },
  },
};

/**
 * POST /api/ai/smart-leave — "Need next Monday and Tuesday off for a wedding"
 * → { type, start, end, reason } to pre-fill the leave form. Nothing is
 * saved; the user always confirms the normal form (guardrail).
 */
export async function POST(req) {
  return route(async () => {
    const ctx = await requireAuth();
    const { text } = await readJson(req);
    if (!text || typeof text !== "string") throw new AppError(400, "text is required");

    if (!aiConfigured()) {
      return ok({ configured: false, message: "AI is not configured — please fill the leave form manually." });
    }

    const settings = await getSettings(ctx.admin);
    const today = todayStr();
    const user = {
      full_name: ctx.profile.full_name,
      role: ctx.profile.role,
      employee: ctx.employee
        ? { code: ctx.employee.employee_code, name: `${ctx.employee.first_name} ${ctx.employee.last_name ?? ""}`.trim() }
        : null,
    };

    const attempt = async (strict) => {
      const message = await callLLM({
        messages: [
          {
            role: "system",
            content:
              `Today is ${today}. Weekend days are ${settings.weekend_days.join(",")} (0=Sun, 6=Sat). ` +
              `The user says: "${text}". Call parse_leave_request with the resolved dates. ` +
              (strict
                ? "Respond ONLY with a valid tool call. Dates MUST be real calendar dates in YYYY-MM-DD."
                : ""),
          },
          { role: "user", content: text },
        ],
        tools: [PARSE_TOOL],
        toolChoice: "required",
        temperature: 0,
        maxTokens: 300,
      });
      const call = message?.tool_calls?.[0];
      if (!call) throw new Error("no tool call");
      return JSON.parse(call.function.arguments);
    };

    // parse; on invalid JSON retry once (guardrail), then fall back to the form
    let parsed;
    try {
      try {
        parsed = await attempt(false);
      } catch {
        parsed = await attempt(true);
      }
    } catch {
      return ok({
        configured: true,
        ok: false,
        message: "Could not understand that — please fill the leave form manually.",
      });
    }

    // basic sanity — final validation still happens when the form is submitted
    const errors = [];
    if (!["annual", "sick", "casual", "unpaid"].includes(parsed.type)) errors.push("unknown leave type");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.start ?? "")) errors.push("bad start date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.end ?? "")) errors.push("bad end date");
    if (!errors.length && parsed.start > parsed.end) errors.push("start after end");
    if (!errors.length && parsed.start < addDays(today, -0)) {
      // allow today and future only
      if (parsed.start < today) errors.push("start date is in the past");
    }
    if (errors.length) {
      return ok({
        configured: true,
        ok: false,
        message: `AI could not build a valid request (${errors.join(", ")}) — please fill the form manually.`,
      });
    }

    await ctx.admin.from("ai_logs").insert({
      user_id: ctx.userId,
      question: text.slice(0, 1000),
      tools_called: ["parse_leave_request"],
      answer: JSON.stringify(parsed).slice(0, 1000),
    });

    return ok({ configured: true, ok: true, prefill: parsed, note: "Review and confirm — nothing is saved yet." });
  });
}
