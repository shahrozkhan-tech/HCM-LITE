import { ok, route, readJson } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/notifications — own notifications, latest first. */
export async function GET() {
  return route(async () => {
    const ctx = await requireAuth();
    const { data } = await ctx.admin
      .from("notifications")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return ok({ rows: data ?? [] });
  });
}

/** PATCH /api/notifications — mark some ({ ids }) or all as read. */
export async function PATCH(req) {
  return route(async () => {
    const ctx = await requireAuth();
    const { ids } = await readJson(req);

    let q = ctx.admin
      .from("notifications")
      .update({ read: true })
      .eq("user_id", ctx.userId)
      .eq("read", false);
    if (Array.isArray(ids) && ids.length) q = q.in("id", ids);

    await q;
    return ok({ success: true });
  });
}
