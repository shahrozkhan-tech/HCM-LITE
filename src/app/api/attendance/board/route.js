import { ok, route, AppError } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { materializeAttendance } from "@/lib/attendance";
import { getSettings, localDateStr, addDays } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/board?date=YYYY-MM-DD&department_id=...
 * Daily attendance board for staff. Absent rows are materialized first so
 * the board always reflects the rules.
 */
export async function GET(req) {
  return route(async () => {
    const ctx = await requireStaff();
    const url = new URL(req.url);
    const settings = await getSettings(ctx.admin);
    const today = localDateStr(new Date(), settings.timezone);
    const date = url.searchParams.get("date") || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError(400, "date must be YYYY-MM-DD");
    }

    await materializeAttendance(ctx.admin, addDays(date, -35), date);

    let q = ctx.admin
      .from("attendance")
      .select(`
        *,
        employees!inner(
          id, first_name, last_name, employee_code, department_id, status,
          departments(name)
        )
      `)
      .eq("date", date);
    if (url.searchParams.get("department_id")) {
      q = q.eq("employees.department_id", url.searchParams.get("department_id"));
    }

    const { data, error } = await q;
    if (error) throw new AppError(500, error.message);

    const counts = { present: 0, late: 0, half_day: 0, absent: 0, missing_checkout: 0, on_leave: 0 };
    for (const r of data ?? []) if (counts[r.status] !== undefined) counts[r.status]++;

    const rows = (data ?? []).sort((a, b) =>
      `${a.employees.first_name} ${a.employees.last_name}`.localeCompare(
        `${b.employees.first_name} ${b.employees.last_name}`
      )
    );

    return ok({ date, isToday: date === today, rows, counts });
  });
}
