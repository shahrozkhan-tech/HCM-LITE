import { ok, route, readJson, AppError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { AI_TOOLS, executeAiTool } from "@/lib/ai/tools";
import { aiConfigured, runToolLoop } from "@/lib/ai/client";
import { getSettings } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RATE_LIMIT_PER_HOUR = 20;

/** POST /api/ai/chat — chat drawer. body: { messages: [{role, content}] } */
export async function POST(req) {
  return route(async () => {
    const ctx = await requireAuth();

    if (!aiConfigured()) {
      return ok({
        answer:
          "The AI assistant is not configured on this server yet (missing AI_API_KEY). Please set it in the environment and try again.",
        toolsCalled: [],
        aiGenerated: true,
      });
    }

    // rate limit: ~20 requests per user per hour
    const anHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await ctx.admin
      .from("ai_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .gte("created_at", anHourAgo);
    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      throw new AppError(429, "AI rate limit reached (20 messages per hour). Please try again later.");
    }

    const body = await readJson(req);
    const history = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12);
    if (!history.length) throw new AppError(400, "messages array is required");

    const settings = await getSettings(ctx.admin);
    const systemPrompt = await buildSystemPrompt(ctx.profile, settings);

    // executors reuse the same permission-scoped services as the REST API
    const executors = {};
    for (const t of AI_TOOLS) executors[t.function.name] = (args) => executeAiTool(t.function.name, args, ctx);

    const question = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
    let result;
    try {
      result = await runToolLoop({ systemPrompt, history, tools: AI_TOOLS, executors, ctx });
    } catch (err) {
      console.error("[api/ai/chat] AI request failed:", err);
      // friendly fallback — never crash the drawer
      return ok({
        answer: err instanceof AppError ? err.message : "Sorry — the assistant hit an unexpected error. Please try again.",
        toolsCalled: [],
        aiGenerated: true,
      });
    }

    await ctx.admin.from("ai_logs").insert({
      user_id: ctx.userId,
      question: question.slice(0, 1000),
      tools_called: result.toolsCalled ?? [],
      answer: (result.answer ?? "").slice(0, 4000),
    });

    return ok({ ...result, aiGenerated: true });
  });
}
