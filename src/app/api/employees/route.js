import { ok, route, readJson, AppError, requireFields } from "@/lib/api";
import { requireAuth, requireStaff } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { passwordGen } from "@/lib/utils";
import { loginCreatedEmail, sendEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";

const EMPLOYEE_SELECT = "*, departments(name), designations(name)";

/**
 * GET /api/employees — directory with server-side search, filters, paging.
 * Staff see everyone; an employee gets only their own row.
 */
export async function GET(req) {
  return route(async () => {
    const ctx = await requireAuth();
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.min(50, Number(url.searchParams.get("pageSize") ?? 20));

    if (ctx.profile.role === "employee") {
      const { data } = await ctx.admin
        .from("employees")
        .select(EMPLOYEE_SELECT)
        .eq("id", ctx.employee?.id)
        .maybeSingle();
      return ok({ rows: data ? [data] : [], count: data ? 1 : 0, page: 1, pageSize: 1 });
    }

    let q = ctx.admin
      .from("employees")
      .select(EMPLOYEE_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const search = url.searchParams.get("q")?.trim();
    if (search) {
      q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,employee_code.ilike.%${search}%`);
    }
    if (url.searchParams.get("department_id")) q = q.eq("department_id", url.searchParams.get("department_id"));
    if (url.searchParams.get("status")) q = q.eq("status", url.searchParams.get("status"));

    const { data, count } = await q;
    return ok({ rows: data ?? [], count: count ?? 0, page, pageSize });
  });
}

/**
 * POST /api/employees — HR/Admin registers an employee; this also creates
 * their login with a temporary password (changed on first sign-in).
 */
export async function POST(req) {
  return route(async () => {
    const ctx = await requireStaff();
    const body = await readJson(req);
    requireFields(body, ["first_name", "email", "join_date", "basic_salary"]);
    const basic = Number(body.basic_salary);
    if (!Number.isFinite(basic) || basic <= 0) {
      throw new AppError(400, "basic_salary must be greater than 0");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.join_date)) {
      throw new AppError(400, "join_date must be YYYY-MM-DD");
    }
    if (body.exit_date && body.exit_date < body.join_date) {
      throw new AppError(400, "exit_date cannot be before join_date");
    }

    // auto employee code (EMP-001…) when not supplied
    let employee_code = body.employee_code?.trim();
    if (!employee_code) {
      const { count } = await ctx.admin.from("employees").select("id", { count: "exact", head: true });
      employee_code = `EMP-${String((count ?? 0) + 1).padStart(3, "0")}`;
    }

    const { data: dupCode } = await ctx.admin
      .from("employees").select("id").eq("employee_code", employee_code).maybeSingle();
    if (dupCode) throw new AppError(409, `Employee code ${employee_code} already exists`);
    const { data: dupEmail } = await ctx.admin
      .from("employees").select("id").eq("email", body.email.toLowerCase()).maybeSingle();
    if (dupEmail) throw new AppError(409, "An employee with this email already exists");

    // create the login first
    const tempPassword = passwordGen();
    const { data: authUser, error: userErr } = await ctx.admin.auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true,
    });
    if (userErr) throw new AppError(400, userErr.message);

    await ctx.admin.from("profiles").insert({
      id: authUser.user.id,
      email: body.email,
      full_name: `${body.first_name} ${body.last_name ?? ""}`.trim(),
      role: "employee",
      must_change_password: true,
    });

    const { data: emp, error: empErr } = await ctx.admin
      .from("employees")
      .insert({
        user_id: authUser.user.id,
        employee_code,
        first_name: body.first_name.trim(),
        last_name: body.last_name?.trim() ?? "",
        email: body.email.toLowerCase(),
        department_id: body.department_id || null,
        designation_id: body.designation_id || null,
        join_date: body.join_date,
        exit_date: body.exit_date || null,
        status: body.status || "active",
        basic_salary: basic,
        gender: body.gender || null,
        dob: body.dob || null,
        phone: body.phone || null,
        address: body.address || null,
      })
      .select(EMPLOYEE_SELECT)
      .single();
    if (empErr) {
      // roll the login back so a retry does not hit a duplicate email
      await ctx.admin.auth.admin.deleteUser(authUser.user.id);
      throw new AppError(500, empErr.message);
    }

    await writeAudit(ctx.admin, ctx.profile, "create", "employee", emp.id, null, {
      code: employee_code, name: `${emp.first_name} ${emp.last_name}`, email: emp.email,
    });

    const mail = await loginCreatedEmail(ctx.admin, {
      name: `${emp.first_name} ${emp.last_name}`.trim(),
      email: emp.email, tempPassword, role: "employee",
    });
    await sendEmail(ctx.admin, { to: emp.email, subject: mail.subject, html: mail.html, kind: "loginCreated" });

    return ok({ employee: emp, tempPassword }, 201);
  });
}
