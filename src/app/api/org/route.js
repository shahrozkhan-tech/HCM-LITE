import { ok, route, readJson, AppError } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/org — departments, designations and holidays in one call
 * (used by org setup screens and filter dropdowns).
 */
export async function GET() {
  return route(async () => {
    const ctx = await requireAuth();
    const [departments, designations, holidays] = await Promise.all([
      ctx.admin.from("departments").select("*").order("name"),
      ctx.admin.from("designations").select("*").order("name"),
      ctx.admin.from("holidays").select("*").order("date"),
    ]);
    return ok({
      departments: departments.data ?? [],
      designations: designations.data ?? [],
      holidays: holidays.data ?? [],
    });
  });
}

/**
 * POST /api/org — Admin manages org structure.
 * body: { entity: 'department' | 'designation' | 'holiday', ...fields }
 */
export async function POST(req) {
  return route(async () => {
    const ctx = await requireRole(["admin"]);
    const body = await readJson(req);

    if (body.entity === "department") {
      if (!body.name) throw new AppError(400, "Department name is required");
      const { data, error } = await ctx.admin
        .from("departments")
        .insert({ name: body.name.trim() })
        .select()
        .single();
      if (error) throw new AppError(409, error.message.includes("duplicate") ? "Department already exists" : error.message);
      await writeAudit(ctx.admin, ctx.profile, "create", "department", data.id, null, data);
      return ok({ department: data }, 201);
    }

    if (body.entity === "designation") {
      if (!body.name) throw new AppError(400, "Designation name is required");
      const { data, error } = await ctx.admin
        .from("designations")
        .insert({ name: body.name.trim(), department_id: body.department_id || null })
        .select()
        .single();
      if (error) throw new AppError(409, error.message.includes("duplicate") ? "Designation already exists" : error.message);
      await writeAudit(ctx.admin, ctx.profile, "create", "designation", data.id, null, data);
      return ok({ designation: data }, 201);
    }

    if (body.entity === "holiday") {
      if (!body.date || !body.name) throw new AppError(400, "Holiday date and name are required");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new AppError(400, "Date must be YYYY-MM-DD");
      const { data, error } = await ctx.admin
        .from("holidays")
        .insert({ date: body.date, name: body.name.trim() })
        .select()
        .single();
      if (error) throw new AppError(409, error.message.includes("duplicate") ? "A holiday already exists on that date" : error.message);
      await writeAudit(ctx.admin, ctx.profile, "create", "holiday", data.id, null, data);
      return ok({ holiday: data }, 201);
    }

    throw new AppError(400, "entity must be department, designation or holiday");
  });
}

/** DELETE /api/org?entity=...&id=... — Admin only. */
export async function DELETE(req) {
  return route(async () => {
    const ctx = await requireRole(["admin"]);
    const url = new URL(req.url);
    const entity = url.searchParams.get("entity");
    const id = url.searchParams.get("id");
    if (!id) throw new AppError(400, "id is required");

    const table = { department: "departments", designation: "designations", holiday: "holidays" }[entity];
    if (!table) throw new AppError(400, "entity must be department, designation or holiday");

    const { error } = await ctx.admin.from(table).delete().eq("id", id);
    if (error) throw new AppError(500, error.message);
    await writeAudit(ctx.admin, ctx.profile, "delete", entity, id, null, null);
    return ok({ success: true });
  });
}
