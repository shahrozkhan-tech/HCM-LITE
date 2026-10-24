import { ok, route, readJson, AppError, requireFields } from "@/lib/api";
import { requireAuth, requireStaff } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { announcementEmail, sendEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";

/** GET /api/announcements — latest first (all signed-in users). */
export async function GET() {
  return route(async () => {
    const ctx = await requireAuth();
    const { data } = await ctx.admin
      .from("announcements")
      .select("*, author:profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(50);
    return ok({ rows: data ?? [] });
  });
}

/** POST /api/announcements — Admin/HR post an announcement. */
export async function POST(req) {
  return route(async () => {
    const ctx = await requireStaff();
    const body = await readJson(req);
    requireFields(body, ["title", "body"]);

    const { data, error } = await ctx.admin
      .from("announcements")
      .insert({ title: body.title, body: body.body, author_id: ctx.userId })
      .select("*, author:profiles(full_name)")
      .single();
    if (error) throw new AppError(500, error.message);

    await writeAudit(ctx.admin, ctx.profile, "create", "announcement", data.id, null, {
      title: body.title,
    });

    // designed announcement email to every active employee
    const mail = await announcementEmail(ctx.admin, {
      title: body.title, body: body.body, author: ctx.profile.full_name,
    });
    const { data: recipients } = await ctx.admin
      .from("employees")
      .select("email")
      .in("status", ["active", "probation"]);
    for (const r of recipients ?? []) {
      await sendEmail(ctx.admin, {
        to: r.email, subject: mail.subject, html: mail.html, kind: "announcement",
      });
    }

    return ok({ announcement: data }, 201);
  });
}
