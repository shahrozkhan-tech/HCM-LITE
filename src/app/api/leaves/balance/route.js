import { ok, route } from "@/lib/api";
import { requireAuth, requireStaff } from "@/lib/auth";
import { getBalances } from "@/lib/leave";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaves/balance            — own balances
 * GET /api/leaves/balance?employee_id=… — staff view of an employee's balances
 */
export async function GET(req) {
  return route(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const employeeId = url.searchParams.get("employee_id");

    if (employeeId && employeeId !== ctx.employee?.id) {
      await requireStaff();
      const balances = await getBalances(ctx.admin, employeeId, new Date().getFullYear());
      return ok({ balances });
    }

    if (!ctx.employee) return ok({ balances: null });
    const balances = await getBalances(ctx.admin, ctx.employee.id, new Date().getFullYear());
    return ok({ balances });
  });
}
