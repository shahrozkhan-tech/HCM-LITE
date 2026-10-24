import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api";

/**
 * Resolves the signed-in user + profile + linked employee row.
 * Verifies the Supabase JWT first, then loads profile data with the
 * service-role client so route handlers enforce role/data scope centrally.
 */
export async function getAuthContext() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.is_active) return null;

  const { data: employee } = await admin
    .from("employees")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return { userId: user.id, profile, admin, employee: employee ?? null };
}

export async function requireAuth() {
  const ctx = await getAuthContext();
  if (!ctx) throw new AppError(401, "Authentication required");
  return ctx;
}

export async function requireRole(roles) {
  const ctx = await requireAuth();
  if (!roles.includes(ctx.profile.role)) {
    throw new AppError(403, "You do not have permission to perform this action");
  }
  return ctx;
}

/** Staff = admin or hr. */
export async function requireStaff() {
  return requireRole(["admin", "hr"]);
}

/** Routes that operate on the caller's own employee record. */
export async function requireEmployeeRecord() {
  const ctx = await requireAuth();
  if (!ctx.employee) {
    throw new AppError(
      403,
      "No employee record is linked to your account. Ask HR to register you."
    );
  }
  return ctx;
}
