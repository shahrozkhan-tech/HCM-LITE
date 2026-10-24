import { ok, route } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getAdminStats, getHrStats, getEmployeeStats } from "@/lib/dashboard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/dashboard?department_id=… — role-scoped KPIs, trends and lists.
 * Numbers are computed server-side (see lib/dashboard.js).
 */
export async function GET(req) {
  return route(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("department_id") || null;

    if (ctx.profile.role === "admin") {
      return ok({ scope: "admin", admin: await getAdminStats(ctx.admin, { departmentId }) });
    }
    if (ctx.profile.role === "hr") {
      return ok({ scope: "hr", hr: await getHrStats(ctx.admin, { departmentId }) });
    }
    return ok({ scope: "employee", employee: await getEmployeeStats(ctx) });
  });
}
