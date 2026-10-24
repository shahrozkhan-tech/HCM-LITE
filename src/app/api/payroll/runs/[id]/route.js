import { ok, route, AppError } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { sumPayslips } from "@/lib/payroll";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** GET /api/payroll/runs/[id] — run with all payslips (staff). */
export async function GET(_req, { params }) {
  return route(async () => {
    const ctx = await requireStaff();
    const { id } = params;

    const { data: run } = await ctx.admin
      .from("payroll_runs")
      .select("*")
      .eq("id", id)
      .single();
    if (!run) throw new AppError(404, "Payroll run not found");

    const { data: slips } = await ctx.admin
      .from("payslips")
      .select(`
        *,
        employees(id, first_name, last_name, employee_code, department_id, departments(name))
      `)
      .eq("run_id", id);
    const rows = (slips ?? []).sort((a, b) =>
      `${a.employees.last_name}`.localeCompare(`${b.employees.last_name}`)
    );

    return ok({ run, payslips: rows, totals: sumPayslips(rows) });
  });
}

/** DELETE /api/payroll/runs/[id] — remove a DRAFT run (finalized locked). */
export async function DELETE(_req, { params }) {
  return route(async () => {
    const ctx = await requireStaff();
    const { id } = params;
    const { data: run } = await ctx.admin.from("payroll_runs").select("*").eq("id", id).single();
    if (!run) throw new AppError(404, "Payroll run not found");
    if (run.status === "finalized") throw new AppError(409, "Finalized runs are locked");

    await ctx.admin.from("payroll_runs").delete().eq("id", id);
    await writeAudit(ctx.admin, ctx.profile, "delete", "payroll_run", id, run, null);
    return ok({ success: true });
  });
}
