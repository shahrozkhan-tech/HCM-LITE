import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS — every caller MUST have already
 * authenticated the request and checked the role/data scope explicitly.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — server-side operations are unavailable."
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
