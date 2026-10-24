import { ok, route, readJson, AppError, requireFields } from "@/lib/api";
import { requireAuth, requireEmployeeRecord, requireStaff } from "@/lib/auth";
import { validateAndCountLeave } from "@/lib/leave";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaves — role-scoped list.
 *  employee             → own history
 *  staff ?inbox=1       → pending approval inbox
 *  staff                → all with optional filters (status, employee_id, from, to)
 */
export async function GET(req) {
  return route(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);

    let q = ctx.admin
      .from("leaves")
      .select(`
        *,
        employees(id, first_name, last_name, employee_code, departments(name))
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (ctx.profile.role === "employee") {
      if (!ctx.employee) return ok({ rows: [] });
      q = q.eq("employee_id", ctx.employee.id);
    } else if (url.searchParams.get("inbox") === "1") {
      q = q.eq("status", "pending");
    } else {
      if (url.searchParams.get("status")) q = q.eq("status", url.searchParams.get("status"));
      if (url.searchParams.get("employee_id")) q = q.eq("employee_id", url.searchParams.get("employee_id"));
      if (url.searchParams.get("from")) q = q.gte("start_date", url.searchParams.get("from"));
      if (url.searchParams.get("to")) q = q.lte("end_date", url.searchParams.get("to"));
    }

    const { data, error } = await q;
    if (error) throw new AppError(500, error.message);
    return ok({ rows: data ?? [] });
  });
}

/**
 * POST /api/leaves — apply (employee). Working days only; overlap or
 * over-balance → 422.
 */
export async function POST(req) {
  return route(async () => {
    const ctx = await requireEmployeeRecord();
    const body = await readJson(req);
    requireFields(body, ["type", "start", "end", "reason"]);
    if (!["annual", "sick", "casual", "unpaid"].includes(body.type)) {
      throw new AppError(400, "type must be annual, sick, casual or unpaid");
    }

    const days = await validateAndCountLeave(ctx.admin, {
      employeeId: ctx.employee.id,
      type: body.type,
      start: body.start,
      end: body.end,
    });

    const { data: leave, error } = await ctx.admin
      .from("leaves")
      .insert({
        employee_id: ctx.employee.id,
        type: body.type,
        start_date: body.start,
        end_date: body.end,
        days,
        reason: body.reason,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new AppError(500, error.message);

    await writeAudit(ctx.admin, ctx.profile, "create", "leave", leave.id, null, {
      type: body.type, from: body.start, to: body.end, days,
    });
    return ok({ leave }, 201);
  });
}
