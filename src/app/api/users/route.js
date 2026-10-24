import { ok, route, readJson, AppError, requireFields } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { passwordGen } from "@/lib/utils";
import { loginCreatedEmail, sendEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";

/** GET /api/users — Admin: all login accounts. */
export async function GET(req) {
  return route(async () => {
    const ctx = await requireRole(["admin"]);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = 50;

    let q = ctx.admin
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (url.searchParams.get("role")) q = q.eq("role", url.searchParams.get("role"));

    const { data, count } = await q;
    return ok({ rows: data ?? [], count: count ?? 0, page, pageSize });
  });
}

/** POST /api/users — Admin creates an HR (or Admin) login with a temp password. */
export async function POST(req) {
  return route(async () => {
    const ctx = await requireRole(["admin"]);
    const body = await readJson(req);
    requireFields(body, ["email", "full_name", "role"]);
    if (!["hr", "admin"].includes(body.role)) {
      throw new AppError(400, "role must be hr or admin (employees are registered via /api/employees)");
    }

    const tempPassword = body.password || passwordGen();
    const { data: authUser, error: userErr } = await ctx.admin.auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true,
    });
    if (userErr) throw new AppError(400, userErr.message);

    const { error: profErr } = await ctx.admin.from("profiles").insert({
      id: authUser.user.id,
      email: body.email,
      full_name: body.full_name,
      role: body.role,
      must_change_password: true,
    });
    if (profErr) throw new AppError(500, profErr.message);

    await writeAudit(ctx.admin, ctx.profile, "create", "user", authUser.user.id, null, {
      email: body.email, role: body.role,
    });

    // designed welcome email (stored in outbox; sent via Resend when configured)
    const mail = await loginCreatedEmail(ctx.admin, {
      name: body.full_name, email: body.email, tempPassword, role: body.role,
    });
    await sendEmail(ctx.admin, { to: body.email, subject: mail.subject, html: mail.html, kind: "loginCreated" });

    return ok({ id: authUser.user.id, email: body.email, role: body.role, tempPassword }, 201);
  });
}
