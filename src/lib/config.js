/**
 * Build-time configuration checks. NEXT_PUBLIC_* vars are inlined at build
 * time on Vercel — if they were missing when the deployment built, the
 * browser bundle gets undefined and every Supabase call crashes.
 */
export function missingPublicConfig() {
  const missing = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}
