/**
 * Pushes the required env vars from .env.local to the linked Vercel project
 * (production + preview). Usage: node scripts/push-env-to-vercel.mjs
 * Skips empty values and VERCEL_* vars; tolerates "already exists".
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const WANTED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AI_BASE_URL",
  "AI_API_KEY",
  "AI_MODEL",
  "AI_TIMEOUT_MS",
];

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/\uFEFF/g, "");
}

for (const name of WANTED) {
  const value = env[name];
  if (!value) {
    console.log(`SKIP  ${name} (empty locally)`);
    continue;
  }
  let ok = true;
  for (const environment of ["production", "preview"]) {
    const res = spawnSync("vercel", ["env", "add", name, "--environment", environment], {
      input: value + "\n",
      encoding: "utf8",
      shell: true,
    });
    const out = (res.stdout + res.stderr).replace(/\s+/g, " ").trim();
    if (/already exists|Duplicate/i.test(out)) {
      console.log(`EXISTS ${name} [${environment}]`);
    } else if (res.status === 0 && /Added|Success|✓/i.test(out)) {
      console.log(`OK    ${name} [${environment}]`);
    } else {
      ok = false;
      console.log(`WARN  ${name} [${environment}] → ${out.slice(0, 200)}`);
    }
  }
  if (ok) console.log(`DONE  ${name}`);
}
console.log("ALL-DONE");
