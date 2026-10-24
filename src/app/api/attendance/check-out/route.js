import { ok, route, AppError } from "@/lib/api";
import { requireEmployeeRecord } from "@/lib/auth";
import { hoursBetween, computeCheckOutStatus } from "@/lib/attendance";
import { getSettings, localDateStr } from "@/lib/dates";
import { round2 as r2 } from "@/lib/payroll";

export const dynamic = "force-dynamic";

/** POST /api/attendance/check-out — stamps checkout; half-day if under 5 h. */
export async function POST() {
  return route(async () => {
    const ctx = await requireEmployeeRecord();
    const settings = await getSettings(ctx.admin);
    const today = localDateStr(new Date(), settings.timezone);
    const nowIso = new Date().toISOString();

    const { data: row } = await ctx.admin
      .from("attendance")
      .select("*")
      .eq("employee_id", ctx.employee.id)
      .eq("date", today)
      .maybeSingle();
    if (!row) throw new AppError(404, "No check-in found for today");
    if (row.check_out) throw new AppError(409, "You have already checked out today");

    const hours = hoursBetween(row.check_in, nowIso);
    const status = computeCheckOutStatus(row.status, hours, settings);

    const { data: updated, error } = await ctx.admin
      .from("attendance")
      .update({ check_out: nowIso, work_hours: r2(hours), status })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw new AppError(500, error.message);

    return ok({
      attendance: updated,
      workedHours: r2(hours),
      halfDayThreshold: settings.half_day_hours,
    });
  });
}
