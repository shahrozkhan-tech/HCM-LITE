/**
 * Diagnoses the AI provider configured in .env.local.
 * Usage: node scripts/test-ai-provider.mjs
 */
import fs from "node:fs";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/\uFEFF/g, "");
}

const base = (env.AI_BASE_URL || "").replace(/\/$/, "");
const key = env.AI_API_KEY || "";
const model = env.AI_MODEL || "";
console.log("BASE:", base);
console.log("MODEL:", model);
console.log("KEY:", key ? key.slice(0, 8) + "…" + ` (${key.length} chars)` : "(empty)");

async function timedFetch(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const start = Date.now();
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const body = await res.text();
    return { ms: Date.now() - start, status: res.status, body: body.slice(0, 400) };
  } catch (e) {
    return { ms: Date.now() - start, status: 0, body: e.name + ": " + e.message };
  } finally {
    clearTimeout(t);
  }
}

// 1) list models (validates key)
console.log("\n── GET /models ──");
console.log(await timedFetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } }, 20000));

// 2) tiny chat completion without tools
console.log("\n── POST /chat/completions (no tools) ──");
console.log(
  await timedFetch(
    `${base}/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "say ok" }], max_tokens: 10 }),
    },
    25000
  )
);

// 3) chat completion WITH tools (what the app does)
console.log("\n── POST /chat/completions (with tools) ──");
console.log(
  await timedFetch(
    `${base}/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "hi" }],
        tools: [
          {
            type: "function",
            function: {
              name: "get_headcount",
              description: "test tool",
              parameters: { type: "object", properties: { department: { type: "string" } } },
            },
          },
        ],
        tool_choice: "auto",
        max_tokens: 50,
      }),
    },
    25000
  )
);
