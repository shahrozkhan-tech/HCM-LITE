import { getSettings } from "@/lib/dates";

/**
 * Designed system emails (M9+). Branded, email-client-safe HTML (tables +
 * inline styles). Emails are stored in `email_outbox` and — when
 * RESEND_API_KEY + EMAIL_FROM are set — actually delivered via Resend.
 */

const BRAND = "#6366f1";
const BRAND_DARK = "#4f46e5";
const ACCENT = "#c026d3";

function esc(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(n) {
  return "PKR " + Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Shared gradient-header email layout. */
export function emailLayout({ company, heading, intro, blocks, footerNote }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#eef0f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f7;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px -18px rgba(79,70,229,.45);">
  <!-- header -->
  <tr><td style="background:linear-gradient(130deg,#6366f1 0%,#7c3aed 48%,#c026d3 100%);padding:30px 34px;">
    <table width="100%"><tr>
      <td style="color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-.5px;">${esc(company || "HCM Lite")}</td>
      <td align="right" style="color:rgba(255,255,255,.85);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">HCM&nbsp;Lite</td>
    </tr></table>
  </td></tr>
  <!-- body -->
  <tr><td style="background:#ffffff;padding:32px 34px 26px;">
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#171a2b;">${heading}</h1>
    ${intro ? `<p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#4b5162;">${intro}</p>` : ""}
    ${blocks || ""}
  </td></tr>
  <!-- footer -->
  <tr><td style="background:#f7f8fc;padding:18px 34px;border-top:1px solid #e7e9f3;">
    <p style="margin:0;font-size:11.5px;line-height:1.6;color:#8a90a5;">
      ${footerNote ?? "This is an automated message from your HR system."}<br/>
      <span style="color:#6366f1;font-weight:700;">${esc(company || "HCM Lite")}</span> · powered by HCM Lite · Saylani Hackathon 2026
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function infoRow(label, value) {
  return `<tr>
    <td style="padding:9px 0;font-size:13px;color:#6a7085;width:150px;">${label}</td>
    <td style="padding:9px 0;font-size:13.5px;font-weight:700;color:#171a2b;">${value}</td>
  </tr>`;
}

function codeBox(code) {
  return `<div style="margin:16px 0;padding:14px 20px;border-radius:12px;background:#eef0fe;border:1px dashed #6366f1;text-align:center;">
    <div style="font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:#6a7085;margin-bottom:5px;">Temporary password</div>
    <span style="font-family:Consolas,Menlo,monospace;font-size:21px;font-weight:800;letter-spacing:2px;color:${BRAND_DARK};">${esc(code)}</span>
    <div style="margin-top:7px;font-size:11px;color:#8a90a5;">Shown once · change it at first sign-in</div>
  </div>`;
}

function statusPill(text, color) {
  return `<span style="display:inline-block;padding:4px 14px;border-radius:999px;background:${color}1f;color:${color};font-size:12px;font-weight:800;letter-spacing:.4px;">${text}</span>`;
}

/* ── templates ─────────────────────────────────────────────────── */

export async function loginCreatedEmail(admin, { name, email, tempPassword, role }) {
  const settings = await safeSettings(admin);
  return {
    subject: `Welcome to ${settings.company_name} — your ${role.toUpperCase()} account is ready`,
    html: emailLayout({
      company: settings.company_name,
      heading: `Welcome aboard, ${esc(name)}! 🎉`,
      intro: `An account has been created for you on <b>${esc(settings.company_name)}'s</b> HCM Lite system. Use the temporary password below to sign in — you'll be asked to choose your own password immediately after.`,
      blocks: `
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e7e9f3;border-radius:14px;padding:6px 18px;margin-bottom:4px;">
          ${infoRow("Your email", esc(email))}
          ${infoRow("Role", esc(role.toUpperCase()))}
          ${infoRow("Office hours", `${esc(settings.office_start)} (+${settings.grace_minutes} min grace)`)}
        </table>
        ${codeBox(tempPassword)}`,
      footerNote: "If this wasn't you, contact your HR team immediately.",
    }),
  };
}

export async function passwordResetEmail(admin, { name, tempPassword }) {
  const settings = await safeSettings(admin);
  return {
    subject: `Your ${settings.company_name} password was reset`,
    html: emailLayout({
      company: settings.company_name,
      heading: "Password reset 🔑",
      intro: `Hi ${esc(name)}, an administrator reset your password. Sign in with the temporary password below and set a new one on first sign-in.`,
      blocks: codeBox(tempPassword),
      footerNote: "If this wasn't you, contact your HR team immediately.",
    }),
  };
}

export async function leaveDecisionEmail(admin, { name, type, start, end, days, status, comment }) {
  const settings = await safeSettings(admin);
  const ok = status === "approved";
  return {
    subject: `Leave ${status}: ${type} (${start} → ${end})`,
    html: emailLayout({
      company: settings.company_name,
      heading: `Hi ${esc(name)}, your leave request was ${status}`,
      intro: `${statusPill(status.toUpperCase(), ok ? "#0d9488" : "#e11d48")} &nbsp; Your <b>${esc(type)}</b> leave request has been reviewed by HR.`,
      blocks: `
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e7e9f3;border-radius:14px;padding:6px 18px;">
          ${infoRow("Type", esc(type))}
          ${infoRow("Dates", `${esc(start)} → ${esc(end)}`)}
          ${infoRow("Working days", esc(days))}
          ${infoRow("HR comment", comment ? esc(comment) : "—")}
        </table>`,
    }),
  };
}

export async function payslipReadyEmail(admin, { name, period, netPay, gross, deduction, tax }) {
  const settings = await safeSettings(admin);
  return {
    subject: `Payslip ready — ${period}`,
    html: emailLayout({
      company: settings.company_name,
      heading: `Your payslip for ${esc(period)} is ready 🧾`,
      intro: `Hi ${esc(name)}, the payroll for <b>${esc(period)}</b> has been finalized. Your payslip PDF is waiting in your HCM Lite dashboard.`,
      blocks: `
        <div style="margin:18px 0;padding:18px 22px;border-radius:14px;background:linear-gradient(130deg,#6366f1,#c026d3);text-align:center;">
          <div style="font-size:11px;letter-spacing:2px;color:rgba(255,255,255,.8);text-transform:uppercase;">Net pay</div>
          <div style="font-size:30px;font-weight:900;color:#ffffff;letter-spacing:-.5px;">${money(netPay)}</div>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e7e9f3;border-radius:14px;padding:6px 18px;">
          ${infoRow("Gross", money(gross))}
          ${infoRow("Deductions", "− " + money(deduction))}
          ${infoRow("Tax", "− " + money(tax))}
        </table>`,
      footerNote: "Open HCM Lite → My Payslips to download the PDF.",
    }),
  };
}

export async function announcementEmail(admin, { title, body, author }) {
  const settings = await safeSettings(admin);
  return {
    subject: `📢 ${title}`,
    html: emailLayout({
      company: settings.company_name,
      heading: esc(title),
      intro: esc(body).replace(/\n/g, "<br/>"),
      blocks: `<p style="font-size:12px;color:#8a90a5;margin-top:8px;">— ${esc(author || "Company")}</p>`,
    }),
  };
}

/* ── sending ───────────────────────────────────────────────────── */

async function safeSettings(admin) {
  try {
    return await getSettings(admin);
  } catch {
    return { company_name: "HCM Lite", office_start: "09:00", grace_minutes: 15 };
  }
}

/**
 * Stores the email in the outbox and delivers it via Resend when configured.
 * Never throws — email is best-effort and must not block the main flow.
 */
export async function sendEmail(admin, { to, subject, html, kind }) {
  if (!to) return;
  try {
    const { data: row } = await admin
      .from("email_outbox")
      .insert({ to_email: to, subject, html, kind })
      .select("id")
      .single();

    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (key && from && row) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ from, to: [to], subject, html }),
        });
        const json = await res.json().catch(() => ({}));
        await admin
          .from("email_outbox")
          .update(
            res.ok
              ? { status: "sent", provider_id: json?.id ?? null }
              : { status: "failed", error: String(json?.message ?? res.status).slice(0, 300) }
          )
          .eq("id", row.id);
      } catch (err) {
        await admin
          .from("email_outbox")
          .update({ status: "failed", error: String(err.message).slice(0, 300) })
          .eq("id", row.id);
      }
    }
  } catch (err) {
    console.error("[email] outbox insert failed", err);
  }
}
