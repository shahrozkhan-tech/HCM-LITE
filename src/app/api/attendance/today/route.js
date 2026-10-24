import { ok, route } from "@/lib/api";
import { requireEmployeeRecord } from "@/lib/auth";
import { getSettings, localDateStr, localTimeStr } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** GET /api/attendance/today — own record for today + office clock info. */
export async function GET() {
  return route(async () => {
    const ctx = await requireEmployeeRecord();
    const settings = await getSettings(ctx.admin);
    const today = localDateStr(new Date(), settings.timezone);

    const { data: row } = await ctx.admin
      .from("attendance")
      .select("*")
      .eq("employee_id", ctx.employee.id)
      .eq("date", today)
      .maybeSingle();

    return ok({
      date: today,
      localTime: localTimeStr(new Date(), settings.timezone),
      officeStart: settings.office_start,
      graceMinutes: settings.grace_minutes,
      attendance: row ?? null,
      canCheckIn: !row,
      canCheckOut: Boolean(row?.check_in && !row?.check_out),
      cameraEnabled: settings.office_lat != null && settings.office_lng != null,
      geofenceRadius: settings.geofence_radius,
    });
  });
}
