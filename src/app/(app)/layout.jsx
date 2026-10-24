import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getSettings } from "@/lib/dates";

/** Authenticated shell — every child route is role-guarded by middleware. */
export default async function AppLayout({ children }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.profile.must_change_password) redirect("/change-password");

  let companyName = "HCM Lite";
  try {
    const settings = await getSettings(ctx.admin);
    companyName = settings.company_name;
  } catch {
    /* settings not ready */
  }

  return (
    <AppShell profile={ctx.profile} companyName={companyName}>
      {children}
    </AppShell>
  );
}
