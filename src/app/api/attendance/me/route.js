import { ok, route } from "@/lib/api";
import { requireEmployeeRecord } from "@/lib/auth";
import { materializeAttendance } from "@/lib/attendance";
import { getSettings, localDateStr, monthBounds, todayStr } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** GET /api/attendance/me?month=&year= — own attendance calendar. */
export async function GET(req) {
  return route(async () => {
    const ctx = await requireEmployeeRecord();
    const url = new URL(req.url);
    const settings = await getSettings(ctx.admin);
    const now = new Date();
    const month = Number(url.searchParams.get("month") ?? now.getMonth() + 1);
    const year = Number(url.searchParams.get("year") ?? now.getFullYear());
    const { first, last } = monthBounds(year, month);

    const today = todayStr();
    if (first <= today) {
      await materializeAttendance(ctx.admin, first, last < today ? last : today);
    }

    const { data } = await ctx.admin
      .from("attendance")
      .select("*")
      .eq("employee_id", ctx.employee.id)
      .gte("date", first)
      .lte("date", last)
      .order("date");

    const counts = { present: 0, late: 0, half_day: 0, absent: 0, missing_checkout: 0, on_leave: 0 };
    for (const r of data ?? []) if (counts[r.status] !== undefined) counts[r.status]++;

    return ok({ month, year, rows: data ?? [], counts, today: localDateStr(new Date(), settings.timezone) });
  });
}
