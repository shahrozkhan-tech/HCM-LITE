import { ok, route } from "@/lib/api";
import { requireEmployeeRecord } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/payroll/me — employee's own payslips across all runs. */
export async function GET() {
  return route(async () => {
    const ctx = await requireEmployeeRecord();
    const { data } = await ctx.admin
      .from("payslips")
      .select("*, payroll_runs(id, period_month, period_year, status, finalized_at)")
      .eq("employee_id", ctx.employee.id)
      .order("created_at", { ascending: false });
    return ok({ payslips: data ?? [] });
  });
}
