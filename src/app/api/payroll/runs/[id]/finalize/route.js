import { ok, route, AppError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { writeAudit, notify } from "@/lib/audit";
import { monthName } from "@/lib/dates";
import { payslipReadyEmail, sendEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";

/** POST /api/payroll/runs/[id]/finalize — Admin only; locks the month. */
export async function POST(_req, { params }) {
  return route(async () => {
    const ctx = await requireRole(["admin"]);
    const { id } = params;

    const { data: run } = await ctx.admin
      .from("payroll_runs")
      .select("*")
      .eq("id", id)
      .single();
    if (!run) throw new AppError(404, "Payroll run not found");
    if (run.status === "finalized") throw new AppError(409, "This run is already finalized");

    const { data: updated, error } = await ctx.admin
      .from("payroll_runs")
      .update({
        status: "finalized",
        finalized_by: ctx.userId,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new AppError(500, error.message);

    await writeAudit(ctx.admin, ctx.profile, "payroll_finalize", "payroll_run", id, run, updated);

    // notify every employee in the run + designed payslip email
    const { data: slips } = await ctx.admin
      .from("payslips")
      .select("gross, deduction, tax, net_pay, employee_id, employees(user_id, first_name, email)")
      .eq("run_id", id);
    const period = `${monthName(run.period_month)} ${run.period_year}`;
    for (const s of slips ?? []) {
      await notify(
        ctx.admin,
        s.employees?.user_id,
        "Payslip ready",
        `Your payslip for ${period} has been finalized and is ready to download.`
      );
      const mail = await payslipReadyEmail(ctx.admin, {
        name: s.employees?.first_name ?? "Employee",
        period, netPay: s.net_pay, gross: s.gross,
        deduction: Number(s.deduction) + Number(s.tax ?? 0), tax: 0,
      });
      await sendEmail(ctx.admin, {
        to: s.employees?.email, subject: mail.subject, html: mail.html, kind: "payslipReady",
      });
    }

    return ok({ run: updated });
  });
}
