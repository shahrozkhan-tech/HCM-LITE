import { ok, route, AppError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import {
  loginCreatedEmail, passwordResetEmail, leaveDecisionEmail,
  payslipReadyEmail, announcementEmail,
} from "@/lib/emails";

export const dynamic = "force-dynamic";

/** GET /api/emails — Admin: outbox list. ?preview=kind renders a sample. */
export async function GET(req) {
  return route(async () => {
    const ctx = await requireRole(["admin"]);
    const url = new URL(req.url);
    const preview = url.searchParams.get("preview");

    if (preview) {
      const samples = {
        loginCreated: () => loginCreatedEmail(ctx.admin, { name: "Ayesha Khan", email: "ayesha@company.com", tempPassword: "Temp#9x4Kq2", role: "employee" }),
        passwordReset: () => passwordResetEmail(ctx.admin, { name: "Ayesha Khan", tempPassword: "Rz7#pQm2" }),
        leaveDecision: () => leaveDecisionEmail(ctx.admin, { name: "Ayesha Khan", type: "casual", start: "2026-10-26", end: "2026-10-27", days: 2, status: "approved", comment: "Enjoy the wedding!" }),
        payslipReady: () => payslipReadyEmail(ctx.admin, { name: "Ayesha Khan", period: "October 2026", netPay: 111818, gross: 120000, deduction: 8182, tax: 0 }),
        announcement: () => announcementEmail(ctx.admin, { title: "Team dinner this Friday 🍕", body: "Join us at 7 PM on the rooftop.", author: "HR Team" }),
      };
      const fn = samples[preview];
      if (!fn) throw new AppError(400, "preview must be one of: loginCreated, passwordReset, leaveDecision, payslipReady, announcement");
      const { subject, html } = await fn();
      return ok({ kind: preview, subject, html });
    }

    const { data } = await ctx.admin
      .from("email_outbox")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return ok({ rows: data ?? [] });
  });
}
