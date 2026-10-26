import { ok, route, readJson } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/auth/profile — own profile upkeep:
 *  - clears must_change_password after a successful password change
 *  - updates own phone / address
 */
export async function PATCH(req) {
  return route(async () => {
    const ctx = await requireAuth();
    const body = await readJson(req);

    const patch = {};
    if (body.must_change_password === false) patch.must_change_password = false;
    if (typeof body.phone === "string") patch.phone = body.phone;
    if (typeof body.address === "string") patch.address = body.address;
    if (!Object.keys(patch).length) return ok({ success: true });

    await ctx.admin.from("profiles").update(patch).eq("id", ctx.userId);

    // employees mirror contact info on their employee row
    if (ctx.employee && (patch.phone !== undefined || patch.address !== undefined)) {
      const empPatch = {};
      if (patch.phone !== undefined) empPatch.phone = patch.phone;
      if (patch.address !== undefined) empPatch.address = patch.address;
      await ctx.admin.from("employees").update(empPatch).eq("id", ctx.employee.id);
    }

    if (patch.must_change_password === false) {
      await writeAudit(ctx.admin, ctx.profile, "update", "profile", ctx.userId, null, { action: "password changed on first sign-in" });
    }

    const res = ok({ success: true });
    // keep the middleware routing-cache cookie in sync (role|must_change)
    if (patch.must_change_password === false) {
      res.cookies.set("hcm_ctx", `${ctx.profile.role}|0`, {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 30,
        sameSite: "lax",
      });
    }
    return res;
  });
}
