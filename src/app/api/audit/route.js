import { ok, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/audit — Admin only; append-only audit trail. */
export async function GET(req) {
  return route(async () => {
    const ctx = await requireRole(["admin"]);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = 50;

    let q = ctx.admin
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (url.searchParams.get("entity")) q = q.eq("entity", url.searchParams.get("entity"));

    const { data, count } = await q;
    return ok({ rows: data ?? [], count: count ?? 0, page, pageSize });
  });
}
