import { AppError } from "@/lib/api";

/**
 * OpenAI-compatible chat-completions client (works with OpenAI, Groq,
 * OpenRouter, Google Gemini's compat endpoint…). Key stays on the server.
 * Timeout is configurable via AI_TIMEOUT_MS (default 15 s).
 */

export function aiConfigured() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_BASE_URL && process.env.AI_MODEL);
}

function timeoutMs() {
  const n = Number(process.env.AI_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 5000 ? n : 15_000;
}

async function singleCall({ messages, tools, toolChoice = "auto", temperature = 0.2, maxTokens = 800 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const res = await fetch(`${process.env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        messages,
        ...(tools?.length ? { tools, tool_choice: toolChoice } : {}),
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // surface the provider's own guidance (e.g. model not available)
      let hint = body.slice(0, 200);
      try {
        const j = JSON.parse(body);
        hint = j?.error?.message?.slice(0, 220) ?? hint;
      } catch {
        /* keep raw slice */
      }
      if (res.status === 404 || /not available|no longer|not found/i.test(hint)) {
        throw new AppError(
          502,
          `AI model "${process.env.AI_MODEL}" is not available on this provider — ask Admin to check AI_MODEL in the server environment. (${hint})`
        );
      }
      if (res.status === 401 || res.status === 403) {
        throw new AppError(502, "AI provider rejected the API key — ask Admin to check AI_API_KEY.");
      }
      throw new AppError(502, `AI provider error (${res.status}): ${hint}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message ?? null;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new AppError(
        504,
        `The AI provider (${process.env.AI_MODEL}) is responding very slowly. Please try again — or ask Admin to switch to a faster model.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function callLLM(opts) {
  if (!aiConfigured()) {
    throw new AppError(503, "The AI assistant is not configured. Set AI_API_KEY in the server environment.");
  }
  // one silent retry on network hiccups (timeouts/5xx) — but only while we
  // still have time budget left, so serverless limits are never blown
  const start = Date.now();
  try {
    return await singleCall(opts);
  } catch (err) {
    if (
      err instanceof AppError &&
      (err.status === 504 || err.status === 502) &&
      Date.now() - start < 15_000
    ) {
      return await singleCall(opts);
    }
    throw err;
  }
}

/**
 * Runs the tool-calling loop: model → tool_calls → execute with the user's
 * scope → tool results → model … until a final answer (max 5 rounds).
 */
export async function runToolLoop({ systemPrompt, history, tools, executors, ctx }) {
  const messages = [{ role: "system", content: systemPrompt }, ...history];
  const toolsCalled = [];

  for (let round = 0; round < 5; round++) {
    const message = await callLLM({ messages, tools });

    if (!message?.tool_calls?.length) {
      return { answer: message?.content ?? "I could not find an answer.", toolsCalled };
    }

    messages.push(message);
    for (const tc of message.tool_calls) {
      const fn = tc.function?.name;
      toolsCalled.push(fn);
      let result;
      try {
        const args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
        result = executors[fn] ? await executors[fn](args, ctx) : { error: `Unknown tool ${fn}` };
      } catch (err) {
        result = { error: err.message ?? "tool failed" };
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 4000) });
    }
  }
  return {
    answer: "I stopped after too many tool steps — please rephrase your question.",
    toolsCalled,
  };
}
