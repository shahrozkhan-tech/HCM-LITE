import { route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { employeesToCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** GET /api/employees/export — HR/Admin: CSV export of the directory. */
export async function GET() {
  return route(async () => {
    const ctx = await requireStaff();
    const { data } = await ctx.admin
      .from("employees")
      .select("*, departments(name), designations(name)")
      .order("employee_code");
    const csv = employeesToCsv(data ?? []);

    await writeAudit(ctx.admin, ctx.profile, "export", "employees", null, null, {
      count: (data ?? []).length,
    });

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="employees-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });
}
