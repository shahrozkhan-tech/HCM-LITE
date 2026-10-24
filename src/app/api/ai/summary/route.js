import { ok, route, readJson, AppError } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { aiConfigured, callLLM } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/summary — Admin/HR "Summarize" button.
 * body: { kpis: object, context?: string } → 3–5 insight bullets built
 * ONLY from the supplied KPI JSON (no tools, no extra data).
 */
export async function POST(req) {
  return route(async () => {
    await requireStaff();
    const { kpis, context } = await readJson(req);
    if (!kpis || typeof kpis !== "object") throw new AppError(400, "kpis object is required");

    if (!aiConfigured()) {
      return ok({
        summary:
          "AI summary is not configured (missing AI_API_KEY). KPIs: " +
          JSON.stringify(kpis).slice(0, 300),
        aiGenerated: false,
      });
    }

    const system =
      "You summarize HR dashboards. You will receive a JSON object of KPIs. " +
      "Write 3 to 5 short insight bullets (max ~20 words each) using ONLY the numbers given. " +
      "Note anything unusual (spikes, drops, zeros). Never invent numbers. Plain text bullets starting with '•'.";
    const user =
      `Dashboard KPIs (JSON): ${JSON.stringify(kpis).slice(0, 6000)}\n` +
      (context ? `Context: ${context}` : "");

    let message;
    try {
      message = await callLLM({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        maxTokens: 300,
      });
    } catch (err) {
      return ok({ summary: "AI summary is temporarily unavailable — the KPIs above are still live.", aiGenerated: false });
    }

    return ok({ summary: message?.content ?? "", aiGenerated: true });
  });
}
