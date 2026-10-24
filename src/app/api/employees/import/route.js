import { ok, route, readJson, AppError } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { validateEmployeeCsv } from "@/lib/csv";
import { passwordGen } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/employees/import  (HR)
 *  { csv: "...", commit: false } → dry run: per-row/field/reason error report
 *  { csv: "...", commit: true }  → insert valid rows + create their logins
 */
export async function POST(req) {
  return route(async () => {
    const ctx = await requireStaff();
    const { csv, commit } = await readJson(req);
    if (!csv || typeof csv !== "string") throw new AppError(400, "csv text is required");

    const { valid, errors } = await validateEmployeeCsv(ctx.admin, csv);

    if (!commit) {
      return ok({
        dryRun: true,
        totalRows: valid.length + errors.length,
        validRows: valid.length,
        errorRows: errors.length,
        errors,
        preview: valid.slice(0, 10),
      });
    }

    const inserted = [];
    const failed = [];
    for (const rec of valid) {
      const tempPassword = passwordGen();
      try {
        const { data: authUser, error: userErr } = await ctx.admin.auth.admin.createUser({
          email: rec.email,
          password: tempPassword,
          email_confirm: true,
        });
        if (userErr) throw new Error(userErr.message);

        await ctx.admin.from("profiles").insert({
          id: authUser.user.id,
          email: rec.email,
          full_name: `${rec.first_name} ${rec.last_name ?? ""}`.trim(),
          role: "employee",
          must_change_password: true,
        });

        const { data: emp, error: empErr } = await ctx.admin
          .from("employees")
          .insert({
            user_id: authUser.user.id,
            employee_code: rec.employee_code,
            first_name: rec.first_name,
            last_name: rec.last_name ?? "",
            email: rec.email.toLowerCase(),
            department_id: rec._department_id ?? null,
            designation_id: rec.designation ? await findDesignation(ctx.admin, rec.designation) : null,
            join_date: rec.join_date,
            basic_salary: Number(rec.basic_salary),
            gender: rec.gender || null,
            phone: rec.phone || null,
          })
          .select("id, employee_code, email")
          .single();
        if (empErr) throw new Error(empErr.message);

        inserted.push({ ...emp, tempPassword });
        await writeAudit(ctx.admin, ctx.profile, "create", "employee", emp.id, null, {
          code: emp.employee_code, imported: true,
        });
      } catch (err) {
        failed.push({ row: rec.employee_code, reason: err.message });
      }
    }

    return ok({
      dryRun: false,
      insertedCount: inserted.length,
      failedCount: failed.length + errors.length,
      failed: [...errors, ...failed],
      employees: inserted, // temp passwords shown once
    });
  });
}

async function findDesignation(admin, name) {
  const { data } = await admin.from("designations").select("id").ilike("name", name).limit(1);
  return data?.[0]?.id ?? null;
}
