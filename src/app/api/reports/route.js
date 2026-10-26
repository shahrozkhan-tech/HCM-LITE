import { ok, route, AppError } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getSettings, monthBounds, monthName, todayStr } from "@/lib/dates";
import { materializeAttendance } from "@/lib/attendance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUSES = ["present", "late", "half_day", "absent", "on_leave", "missing_checkout"];

/**
 * GET /api/reports?month=YYYY-MM&department_id=…&format=csv
 * Admin/HR monthly report: per-employee attendance, leave usage and the
 * payroll outcome for the month — all computed server-side.
 */
export async function GET(req) {
  return route(async () => {
    const ctx = await requireStaff();
    const url = new URL(req.url);
    const today = todayStr();

    const monthParam = url.searchParams.get("month");
    let year, month;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      year = Number(monthParam.slice(0, 4));
      month = Number(monthParam.slice(5, 7));
    } else {
      year = Number(today.slice(0, 4));
      month = Number(today.slice(5, 7));
    }
    const departmentId = url.searchParams.get("department_id") || null;
    const format = url.searchParams.get("format");

    const settings = await getSettings(ctx.admin);
    const { first, last } = monthBounds(year, month);

    // Absent rows exist for past working days in the window.
    await materializeAttendance(ctx.admin, first > today ? today : first, last < today ? last : today);

    // employees in scope
    let empQ = ctx.admin
      .from("employees")
      .select("id, employee_code, first_name, last_name, join_date, status, departments(name)")
      .neq("status", "exited")
      .order("employee_code");
    if (departmentId) empQ = empQ.eq("department_id", departmentId);
    const { data: employees } = await empQ;
    const people = employees ?? [];
    const byId = new Map(people.map((p) => [p.id, p]));

    // attendance rows for the month
    const { data: attRows } = await ctx.admin
      .from("attendance")
      .select("employee_id, date, status, work_hours")
      .gte("date", first)
      .lte("date", last);
    const summary = new Map();
    for (const p of people) {
      summary.set(p.id, {
        employee_code: p.employee_code,
        name: `${p.first_name} ${p.last_name}`.trim(),
        department: p.departments?.name ?? "—",
        present: 0, late: 0, half_day: 0, absent: 0, on_leave: 0, missing_checkout: 0,
        hours: 0,
      });
    }
    for (const r of attRows ?? []) {
      const s = summary.get(r.employee_id);
      if (!s) continue;
      if (r.status in s) s[r.status] += 1;
      s.hours = Math.round((s.hours + Number(r.work_hours ?? 0)) * 10) / 10;
    }

    // leaves approved in the month (by start_date), pending still open
    const { data: leaveRows } = await ctx.admin
      .from("leaves")
      .select("type, status, days, start_date")
      .gte("start_date", first)
      .lte("start_date", last);
    const leaveByType = { annual: 0, sick: 0, casual: 0, unpaid: 0 };
    const pendingByType = { annual: 0, sick: 0, casual: 0, unpaid: 0 };
    let pendingTotal = 0;
    for (const l of leaveRows ?? []) {
      if (!(l.type in leaveByType)) continue;
      if (l.status === "approved") leaveByType[l.type] += Number(l.days);
      if (l.status === "pending") {
        pendingByType[l.type] += Number(l.days);
        pendingTotal += 1;
      }
    }

    // payroll outcome for the month (latest run of that period)
    const { data: runs } = await ctx.admin
      .from("payroll_runs")
      .select("id, status, period_month, period_year, created_at")
      .eq("period_year", year)
      .eq("period_month", month)
      .order("created_at", { ascending: false })
      .limit(1);
    let payroll = null;
    const run = runs?.[0];
    if (run) {
      const { data: slips } = await ctx.admin
        .from("payslips")
        .select("gross, deduction, tax, net_pay")
        .eq("run_id", run.id);
      const tot = (slips ?? []).reduce(
        (a, s) => ({
          gross: a.gross + Number(s.gross ?? 0),
          deductions: a.deductions + Number(s.deduction ?? 0),
          tax: a.tax + Number(s.tax ?? 0),
          net: a.net + Number(s.net_pay ?? 0),
        }),
        { gross: 0, deductions: 0, tax: 0, net: 0 }
      );
      payroll = { status: run.status, employees: (slips ?? []).length, ...tot };
    }

    const label = `${monthName(month)} ${year}`;

    // CSV export — the per-employee attendance table
    if (format === "csv") {
      const header = "Employee Code,Name,Department,Present,Late,Half Day,Absent,On Leave,Missing Checkout,Work Hours";
      const lines = [...summary.values()].map((s) =>
        [s.employee_code, `"${s.name}"`, `"${s.department}"`, s.present, s.late, s.half_day, s.absent, s.on_leave, s.missing_checkout, s.hours].join(",")
      );
      await writeAudit(ctx.admin, ctx.profile, "export", "reports", null, null, { month: label });
      return new Response([header, ...lines].join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="attendance-report-${year}-${String(month).padStart(2, "0")}.csv"`,
        },
      });
    }

    const rows = [...summary.values()];
    const totals = STATUSES.reduce((a, st) => ({ ...a, [st]: rows.reduce((s, r) => s + r[st], 0) }), { hours: 0 });

    return ok({
      month: `${year}-${String(month).padStart(2, "0")}`,
      label,
      range: { first, last },
      today,
      weekendDays: settings.weekend_days,
      rows,
      totals,
      leaves: {
        approvedDaysByType: leaveByType,
        pendingDaysByType: pendingByType,
        pendingRequests: pendingTotal,
      },
      payroll,
      employees: people.length,
    });
  });
}
