import { ok, route, readJson, AppError, requireFields } from "@/lib/api";
import { requireAuth, requireEmployeeRecord, requireRole } from "@/lib/auth";
import { writeAudit, notify } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/corrections — pending correction requests (staff).
 */
export async function GET() {
  return route(async () => {
    const ctx = await requireRole(["admin", "hr"]);
    const { data } = await ctx.admin
      .from("attendance")
      .select(`
        *,
        employees(id, first_name, last_name, employee_code, departments(name))
      `)
      .eq("correction_status", "pending")
      .order("date", { ascending: false });
    return ok({ rows: data ?? [] });
  });
}

/**
 * POST /api/attendance/corrections — employee requests a correction.
 * body: { date: 'YYYY-MM-DD', reason: string }
 */
export async function POST(req) {
  return route(async () => {
    const ctx = await requireEmployeeRecord();
    const body = await readJson(req);
    requireFields(body, ["date", "reason"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new AppError(400, "date must be YYYY-MM-DD");

    const { data: row } = await ctx.admin
      .from("attendance")
      .select("*")
      .eq("employee_id", ctx.employee.id)
      .eq("date", body.date)
      .maybeSingle();
    if (!row) throw new AppError(404, "No attendance record found for that date");
    if (row.correction_status === "pending") {
      throw new AppError(409, "A correction request is already pending for that day");
    }

    const { data: updated, error } = await ctx.admin
      .from("attendance")
      .update({
        correction_requested: true,
        correction_reason: body.reason,
        correction_status: "pending",
      })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw new AppError(500, error.message);

    await writeAudit(ctx.admin, ctx.profile, "correction_request", "attendance", row.id, row, {
      date: body.date, reason: body.reason,
    });
    return ok({ attendance: updated }, 201);
  });
}

/**
 * PATCH /api/attendance/corrections — HR approves/rejects.
 * body: { id, approved: boolean, note?: string }
 * Approved → day is marked present (HR correction wins).
 */
export async function PATCH(req) {
  return route(async () => {
    const ctx = await requireRole(["hr"]);
    const { id, approved, note } = await readJson(req);
    if (!id) throw new AppError(400, "id is required");

    const { data: row } = await ctx.admin
      .from("attendance")
      .select("*")
      .eq("id", id)
      .single();
    if (!row) throw new AppError(404, "Attendance record not found");
    if (row.correction_status !== "pending") {
      throw new AppError(409, "This correction was already decided");
    }

    const patch = approved
      ? {
          status: "present",
          correction_status: "approved",
          corrected_by: ctx.userId,
          work_hours: 8,
        }
      : {
          correction_status: "rejected",
          corrected_by: ctx.userId,
        };

    const { data: updated, error } = await ctx.admin
      .from("attendance")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new AppError(500, error.message);

    await writeAudit(ctx.admin, ctx.profile, approved ? "correction_approve" : "correction_reject", "attendance", id, row, { ...patch, note });

    // notify the employee
    const { data: emp } = await ctx.admin
      .from("employees")
      .select("user_id")
      .eq("id", row.employee_id)
      .maybeSingle();
    await notify(
      ctx.admin,
      emp?.user_id,
      approved ? "Attendance correction approved" : "Attendance correction rejected",
      `Your correction for ${row.date} was ${approved ? "approved" : "rejected"}${note ? `: ${note}` : "."}`
    );

    return ok({ attendance: updated });
  });
}
