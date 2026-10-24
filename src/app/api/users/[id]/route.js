import { ok, route, readJson, AppError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { passwordGen } from "@/lib/utils";
import { passwordResetEmail, sendEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/users/[id] — Admin account actions:
 *  { action: 'reset_password' }  → new temp password, must change on sign-in
 *  { action: 'deactivate' }      → ban login + is_active false
 *  { action: 'activate' }        → unban + is_active true
 */
export async function PATCH(req, { params }) {
  return route(async () => {
    const ctx = await requireRole(["admin"]);
    const { id } = params;
    const { action } = await readJson(req);

    const { data: profile } = await ctx.admin.from("profiles").select("*").eq("id", id).single();
    if (!profile) throw new AppError(404, "User not found");
    if (profile.id === ctx.userId && action === "deactivate") {
      throw new AppError(400, "You cannot deactivate your own account");
    }

    if (action === "reset_password") {
      const tempPassword = passwordGen();
      const { error } = await ctx.admin.auth.admin.updateUserById(id, {
        password: tempPassword,
        ban_duration: "none",
      });
      if (error) throw new AppError(500, error.message);
      await ctx.admin.from("profiles").update({ must_change_password: true, is_active: true }).eq("id", id);
      await writeAudit(ctx.admin, ctx.profile, "reset_password", "user", id, null, { email: profile.email });
      const mail = await passwordResetEmail(ctx.admin, { name: profile.full_name ?? profile.email, tempPassword });
      await sendEmail(ctx.admin, { to: profile.email, subject: mail.subject, html: mail.html, kind: "passwordReset" });
      return ok({ tempPassword });
    }

    if (action === "deactivate") {
      const { error } = await ctx.admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
      if (error) throw new AppError(500, error.message);
      await ctx.admin.from("profiles").update({ is_active: false }).eq("id", id);
      await writeAudit(ctx.admin, ctx.profile, "deactivate", "user", id, { is_active: true }, { is_active: false });
      return ok({ success: true });
    }

    if (action === "activate") {
      const { error } = await ctx.admin.auth.admin.updateUserById(id, { ban_duration: "none" });
      if (error) throw new AppError(500, error.message);
      await ctx.admin.from("profiles").update({ is_active: true }).eq("id", id);
      await writeAudit(ctx.admin, ctx.profile, "activate", "user", id, { is_active: false }, { is_active: true });
      return ok({ success: true });
    }

    throw new AppError(400, "action must be reset_password, deactivate or activate");
  });
}
