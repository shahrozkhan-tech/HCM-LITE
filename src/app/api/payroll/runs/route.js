import { ok, route, readJson, AppError } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { buildPayrollRun, sumPayslips } from "@/lib/payroll";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/payroll/runs — list of runs with totals. */
export async function GET() {
  return route(async () => {
    const ctx = await requireStaff();
    const { data: runs } = await ctx.admin
      .from("payroll_runs")
      .select("*")
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false });

    const out = [];
    for (const run of runs ?? []) {
      const { data: slips } = await ctx.admin
        .from("payslips")
        .select("gross, deduction, tax, net_pay")
        .eq("run_id", run.id);
      out.push({ ...run, totals: sumPayslips(slips ?? []) });
    }
    return ok({ runs: out });
  });
}

/**
 * POST /api/payroll/runs — HR/Admin builds (or rebuilds) the monthly draft.
 * body: { month: 1-12, year }
 */
export async function POST(req) {
  return route(async () => {
    const ctx = await requireStaff();
    const { month, year } = await readJson(req);
    if (!(month >= 1 && month <= 12) || !(year >= 2020 && year <= 2100)) {
      throw new AppError(400, "month (1-12) and year are required");
    }

    const result = await buildPayrollRun(ctx.admin, year, month, ctx.userId);
    await writeAudit(ctx.admin, ctx.profile, "payroll_build", "payroll_run", result.runId, null, {
      month, year, payslips: result.payslips.length,
    });

    const totals = {
      gross: result.payslips.reduce((s, p) => s + p.gross, 0),
      net: result.payslips.reduce((s, p) => s + p.net_pay, 0),
      count: result.payslips.length,
    };
    return ok({ runId: result.runId, month, year, status: "draft", totals }, 201);
  });
}
