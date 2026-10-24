import { route, AppError } from "@/lib/api";
import { requireAuth, requireStaff } from "@/lib/auth";
import { generatePayslipPdf } from "@/lib/pdf";
import { getSettings, monthName } from "@/lib/dates";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/payroll/runs/[id]/payslip-pdf?employee_id=…
 * Staff download any payslip; employees can only download their own.
 */
export async function GET(req, { params }) {
  return route(async () => {
    const ctx = await requireAuth();
    const { id } = params;
    const url = new URL(req.url);
    let employeeId = url.searchParams.get("employee_id");

    if (ctx.profile.role === "employee") {
      if (employeeId && employeeId !== ctx.employee?.id) {
        throw new AppError(403, "You can only download your own payslips");
      }
      employeeId = ctx.employee?.id;
    }
    if (!employeeId) throw new AppError(400, "employee_id is required");
    if (ctx.profile.role !== "employee") await requireStaff();

    const { data: run } = await ctx.admin
      .from("payroll_runs")
      .select("*")
      .eq("id", id)
      .single();
    if (!run) throw new AppError(404, "Payroll run not found");

    const { data: slip } = await ctx.admin
      .from("payslips")
      .select("*")
      .eq("run_id", id)
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (!slip) throw new AppError(404, "No payslip for that employee in this run");

    const { data: employee } = await ctx.admin
      .from("employees")
      .select("*, departments(name), designations(name)")
      .eq("id", employeeId)
      .single();

    const settings = await getSettings(ctx.admin);
    const pdf = await generatePayslipPdf({ settings, run, slip, employee });

    if (ctx.profile.role !== "employee") {
      await writeAudit(ctx.admin, ctx.profile, "payslip_download", "payslip", slip.id, null, {
        employee: employeeId, period: `${run.period_month}/${run.period_year}`,
      });
    }

    const filename = `payslip-${employee.employee_code}-${run.period_year}-${String(run.period_month).padStart(2, "0")}.pdf`;
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  });
}
