import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

const ROLE_HOME = { admin: "/admin", hr: "/hr", employee: "/employee" };

export const dynamic = "force-dynamic";

/** Zero-UI post-auth router: sends the user straight to their role dashboard. */
export default async function GoPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.profile.must_change_password) redirect("/change-password");
  redirect(ROLE_HOME[ctx.profile.role] ?? "/employee");
}
