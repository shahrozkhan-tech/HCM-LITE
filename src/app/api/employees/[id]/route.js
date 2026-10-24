import { ok, route, readJson, AppError } from "@/lib/api";
import { requireAuth, requireStaff } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getBalances } from "@/lib/leave";
import { materializeAttendance } from "@/lib/attendance";
import { todayStr, monthBounds } from "@/lib/dates";

export const dynamic = "force-dynamic";

const EMPLOYEE_SELECT = "*, departments(name), designations(name)";

/** GET /api/employees/[id] — Employee 360 (staff) or own profile (employee). */
export async function GET(_req, { params }) {
  return route(async () => {
    const ctx = await requireAuth();
    const { id } = params;

    if (ctx.profile.role === "employee" && ctx.employee?.id !== id) {
      throw new AppError(403, "You can only view your own profile");
    }

    const { data: emp } = await ctx.admin
      .from("employees")
      .select(EMPLOYEE_SELECT)
      .eq("id", id)
      .single();
    if (!emp) throw new AppError(404, "Employee not found");

    const today = todayStr();
    const { first } = monthBounds(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
    await materializeAttendance(ctx.admin, first, today);

    const [attendance, leaves, payslips, balances] = await Promise.all([
      ctx.admin
        .from("attendance")
        .select("*")
        .eq("employee_id", id)
        .gte("date", first)
        .lte("date", today)
        .order("date", { ascending: false }),
      ctx.admin.from("leaves").select("*").eq("employee_id", id).order("created_at", { ascending: false }).limit(20),
      ctx.admin
        .from("payslips")
        .select("*, payroll_runs(period_month, period_year, status)")
        .eq("employee_id", id)
        .order("created_at", { ascending: false })
        .limit(12),
      getBalances(ctx.admin, id, Number(today.slice(0, 4))),
    ]);

    return ok({
      employee: emp,
      attendance_month: attendance.data ?? [],
      leaves: leaves.data ?? [],
      payslips: payslips.data ?? [],
      balances,
    });
  });
}

/** PATCH /api/employees/[id] — staff edit job details / salary structure. */
export async function PATCH(req, { params }) {
  return route(async () => {
    const ctx = await requireStaff();
    const { id } = params;
    const body = await readJson(req);

    const { data: before } = await ctx.admin
      .from("employees")
      .select(EMPLOYEE_SELECT)
      .eq("id", id)
      .single();
    if (!before) throw new AppError(404, "Employee not found");

    if (body.basic_salary !== undefined) {
      const basic = Number(body.basic_salary);
      if (!Number.isFinite(basic) || basic <= 0) {
        throw new AppError(400, "basic_salary must be greater than 0");
      }
    }

    const patch = { updated_at: new Date().toISOString() };
    const fields = [
      "first_name", "last_name", "email", "department_id", "designation_id",
      "join_date", "exit_date", "status", "basic_salary", "gender", "dob",
      "phone", "address", "employee_code",
    ];
    for (const f of fields) if (body[f] !== undefined) patch[f] = body[f];

    const { data: after, error } = await ctx.admin
      .from("employees")
      .update(patch)
      .eq("id", id)
      .select(EMPLOYEE_SELECT)
      .single();
    if (error) throw new AppError(400, error.message);

    await writeAudit(ctx.admin, ctx.profile, "update", "employee", id, before, after);
    return ok({ employee: after });
  });
}
