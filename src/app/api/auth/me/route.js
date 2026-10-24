import { ok, route } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getSettings } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — current profile + employee row + org settings. */
export async function GET() {
  return route(async () => {
    const ctx = await requireAuth();
    let settings = null;
    try {
      settings = await getSettings(ctx.admin);
    } catch {
      settings = null;
    }
    const { count: unread } = await ctx.admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .eq("read", false);

    return ok({
      profile: ctx.profile,
      employee: ctx.employee,
      settings,
      unreadNotifications: unread ?? 0,
    });
  });
}
