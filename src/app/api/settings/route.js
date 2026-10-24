import { ok, route, readJson, AppError } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/dates";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** GET /api/settings — org settings (any signed-in user). */
export async function GET() {
  return route(async () => {
    const ctx = await requireAuth();
    const settings = await getSettings(ctx.admin);
    return ok({ settings });
  });
}

/** PUT /api/settings — Admin only. Rules apply to NEW records only. */
export async function PUT(req) {
  return route(async () => {
    const ctx = await requireRole(["admin"]);
    const before = await getSettings(ctx.admin);
    const body = await readJson(req);

    if (body.office_start && !/^\d{2}:\d{2}$/.test(body.office_start)) {
      throw new AppError(400, "office_start must be HH:MM (24-hour)");
    }

    const patch = { updated_at: new Date().toISOString() };
    const fields = [
      "company_name", "timezone", "office_start", "grace_minutes", "half_day_hours",
      "weekend_days", "office_lat", "office_lng", "geofence_radius",
      "annual_quota", "sick_quota", "casual_quota",
    ];
    for (const f of fields) if (body[f] !== undefined) patch[f] = body[f];

    const { error } = await ctx.admin.from("organization_settings").update(patch).eq("id", 1);
    if (error) throw new AppError(500, error.message);
    await writeAudit(ctx.admin, ctx.profile, "update", "organization_settings", 1, before, patch);
    return ok({ settings: { ...before, ...patch } });
  });
}
