import { ok, route, readJson, AppError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAudit, notify } from "@/lib/audit";
import { leaveDecisionEmail, sendEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/leaves/[id]
 *  employee: { action: 'cancel' }                     — own pending request
 *  HR:       { action: 'approve'|'reject', comment? } — decision with comment
 */
export async function PATCH(req, { params }) {
  return route(async () => {
    const ctx = await requireAuth();
    const { id } = params;
    const body = await readJson(req);

    const { data: leave } = await ctx.admin
      .from("leaves")
      .select("*")
      .eq("id", id)
      .single();
    if (!leave) throw new AppError(404, "Leave request not found");

    if (body.action === "cancel") {
      if (leave.employee_id !== ctx.employee?.id) {
        throw new AppError(403, "You can only cancel your own leave requests");
      }
      if (leave.status !== "pending") {
        throw new AppError(409, `Only pending requests can be cancelled (this one is ${leave.status})`);
      }
      const { data: updated } = await ctx.admin
        .from("leaves")
        .update({ status: "cancelled" })
        .eq("id", id)
        .select("*")
        .single();
      await writeAudit(ctx.admin, ctx.profile, "cancel", "leave", id, leave, updated);
      return ok({ leave: updated });
    }

    if (body.action === "approve" || body.action === "reject") {
      // checklist #13: HR approves/rejects; Admin views
      if (ctx.profile.role !== "hr") {
        throw new AppError(403, "Only HR can approve or reject leave requests");
      }
      if (leave.status !== "pending") {
        throw new AppError(409, `This request was already ${leave.status}`);
      }
      const status = body.action === "approve" ? "approved" : "rejected";
      const { data: updated } = await ctx.admin
        .from("leaves")
        .update({
          status,
          approver_id: ctx.userId,
          decision_comment: body.comment ?? null,
          decided_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      await writeAudit(ctx.admin, ctx.profile, `leave_${status}`, "leave", id, leave, {
        status, comment: body.comment ?? null,
      });

      const { data: emp } = await ctx.admin
        .from("employees")
        .select("user_id, first_name, email")
        .eq("id", leave.employee_id)
        .maybeSingle();
      await notify(
        ctx.admin,
        emp?.user_id,
        `Leave request ${status}`,
        `Your ${leave.type} leave (${leave.start_date} → ${leave.end_date}) was ${status}${body.comment ? `: ${body.comment}` : "."}`
      );

      const mail = await leaveDecisionEmail(ctx.admin, {
        name: emp?.first_name ?? "Employee",
        type: leave.type, start: leave.start_date, end: leave.end_date,
        days: leave.days, status, comment: body.comment,
      });
      await sendEmail(ctx.admin, { to: emp?.email, subject: mail.subject, html: mail.html, kind: "leaveDecision" });

      return ok({ leave: updated });
    }

    throw new AppError(400, "action must be cancel, approve or reject");
  });
}
