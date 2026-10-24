import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ok, route, readJson, requireFields, AppError } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** GET /api/setup — is this a fresh install? */
export async function GET() {
  return route(async () => {
    const admin = createSupabaseAdminClient();
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    return ok({
      fresh: (count ?? 0) === 0,
      envAdmin: process.env.ADMIN_EMAIL ? { email: process.env.ADMIN_EMAIL } : null,
    });
  });
}

/**
 * POST /api/setup — first-run: create the Admin account + company profile.
 * Only works while the system is fresh (no profiles exist).
 */
export async function POST(req) {
  return route(async () => {
    const admin = createSupabaseAdminClient();
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      throw new AppError(409, "Setup already completed — sign in instead");
    }

    const body = await readJson(req);
    // allow pre-fill from env when no body fields given
    const email = body.email || process.env.ADMIN_EMAIL;
    const password = body.password || process.env.ADMIN_PASSWORD;
    requireFields({ ...body, email, password, company_name: body.company_name }, ["email", "password", "company_name"]);
    if (String(password).length < 8) {
      throw new AppError(400, "Admin password must be at least 8 characters");
    }

    const { data: authUser, error: userErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userErr) throw new AppError(400, userErr.message);

    const { error: profileErr } = await admin.from("profiles").insert({
      id: authUser.user.id,
      email,
      full_name: body.full_name || "Administrator",
      role: "admin",
      must_change_password: false,
      is_active: true,
    });
    if (profileErr) throw new AppError(500, profileErr.message);

    const { error: setErr } = await admin
      .from("organization_settings")
      .update({
        company_name: body.company_name,
        timezone: body.timezone || "Asia/Karachi",
        office_start: body.office_start || "09:00",
        grace_minutes: body.grace_minutes ?? 15,
        half_day_hours: body.half_day_hours ?? 5,
        office_lat: body.office_lat ?? null,
        office_lng: body.office_lng ?? null,
        geofence_radius: body.geofence_radius ?? 150,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (setErr) throw new AppError(500, setErr.message);

    await writeAudit(admin, { id: authUser.user.id, email, full_name: body.full_name }, "setup", "organization", "settings", null, { company_name: body.company_name });

    return ok({ success: true, email });
  });
}
