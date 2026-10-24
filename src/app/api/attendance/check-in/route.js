import { ok, route, readJson, AppError } from "@/lib/api";
import { requireEmployeeRecord } from "@/lib/auth";
import { computeCheckInStatus, validateCameraCheckIn } from "@/lib/attendance";
import { getSettings, localDateStr } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/check-in — the server stamps the time.
 * body: { source?: 'web' | 'camera', lat?, lng?, accuracy?, faceCount? }
 * Camera check-ins additionally require exactly one face + office geofence.
 */
export async function POST(req) {
  return route(async () => {
    const ctx = await requireEmployeeRecord();
    const body = await readJson(req);
    const settings = await getSettings(ctx.admin);
    const today = localDateStr(new Date(), settings.timezone);
    const nowIso = new Date().toISOString();

    const { data: existing } = await ctx.admin
      .from("attendance")
      .select("id")
      .eq("employee_id", ctx.employee.id)
      .eq("date", today)
      .maybeSingle();
    if (existing) throw new AppError(409, "You have already checked in today");

    // approved leave covering today blocks a normal check-in
    const { data: onLeave } = await ctx.admin
      .from("leaves")
      .select("id, type")
      .eq("employee_id", ctx.employee.id)
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle();
    if (onLeave) throw new AppError(422, `You are on approved ${onLeave.type} leave today`);

    let source = "web";
    let location = null;
    if (body.source === "camera") {
      source = "camera";
      const check = validateCameraCheckIn(body, settings);
      location = {
        lat: body.lat, lng: body.lng, accuracy: body.accuracy,
        distance_to_office_m: check.distance, face_detected: true,
      };
    }

    const status = computeCheckInStatus(settings);
    const { data: row, error } = await ctx.admin
      .from("attendance")
      .insert({
        employee_id: ctx.employee.id,
        date: today,
        check_in: nowIso,
        status,
        source,
        location,
      })
      .select("*")
      .single();
    if (error) throw new AppError(500, error.message);

    return ok({
      attendance: row,
      lateAfter: `${settings.office_start} + ${settings.grace_minutes} min grace`,
    }, 201);
  });
}
