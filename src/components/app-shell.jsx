"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarClock, Plane, Wallet, Building2,
  UserCog, Megaphone, ScrollText, LogOut, Sun, Moon, Sparkles, Bell,
  Menu, CircleUser, Download, Mail,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AiAssistant } from "@/components/ai-assistant";
import { useGetNotificationsQuery, useMarkNotificationsReadMutation } from "@/store/api";

const ICONS = {
  dashboard: LayoutDashboard, employees: Users, attendance: CalendarClock,
  leaves: Plane, payroll: Wallet, org: Building2, users: UserCog,
  announcements: Megaphone, audit: ScrollText, profile: CircleUser,
  payslips: Download, emails: Mail,
};

const NAV = {
  admin: [
    { label: "Dashboard", href: "/admin", icon: "dashboard" },
    { label: "Employees", href: "/admin/employees", icon: "employees" },
    { label: "Attendance", href: "/admin/attendance", icon: "attendance" },
    { label: "Leaves", href: "/admin/leaves", icon: "leaves" },
    { label: "Payroll", href: "/admin/payroll", icon: "payroll" },
    { label: "Organization", href: "/admin/settings", icon: "org" },
    { label: "Users", href: "/admin/users", icon: "users" },
    { label: "Announcements", href: "/admin/announcements", icon: "announcements" },
    { label: "Emails", href: "/admin/emails", icon: "emails" },
    { label: "Audit Log", href: "/admin/audit", icon: "audit" },
  ],
  hr: [
    { label: "Dashboard", href: "/hr", icon: "dashboard" },
    { label: "Employees", href: "/hr/employees", icon: "employees" },
    { label: "Attendance", href: "/hr/attendance", icon: "attendance" },
    { label: "Leaves", href: "/hr/leaves", icon: "leaves" },
    { label: "Payroll", href: "/hr/payroll", icon: "payroll" },
    { label: "Announcements", href: "/hr/announcements", icon: "announcements" },
  ],
  employee: [
    { label: "Dashboard", href: "/employee", icon: "dashboard" },
    { label: "My Attendance", href: "/employee/attendance", icon: "attendance" },
    { label: "My Leaves", href: "/employee/leaves", icon: "leaves" },
    { label: "My Payslips", href: "/employee/payslips", icon: "payslips" },
    { label: "My Profile", href: "/employee/profile", icon: "profile" },
  ],
};

const ROLE_LABEL = { admin: "Admin", hr: "HR", employee: "Employee" };

function Logo({ companyName, role }) {
  return (
    <div className="flex h-14 items-center gap-2.5 border-b px-4">
      <div className="bg-brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-extrabold text-white shadow-md">
        HC
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold leading-tight">{companyName || "HCM Lite"}</div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          HCM Lite · {ROLE_LABEL[role]}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ profile, companyName, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV[profile.role] ?? NAV.employee;

  const { data: notifications } = useGetNotificationsQuery();
  const [markRead] = useMarkNotificationsReadMutation();
  const unread = (notifications?.rows ?? []).filter((n) => !n.read).length;

  const logout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    toast.success("Signed out — see you soon!");
    router.push("/login");
    router.refresh();
  };

  const NavLinks = ({ onNavigate }) => (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item, i) => {
        const Icon = ICONS[item.icon];
        const isRoot = item.href === "/admin" || item.href === "/hr" || item.href === "/employee";
        const active = pathname === item.href || (!isRoot && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            style={{ animationDelay: `${0.03 * i}s` }}
            className={cn(
              "group relative flex animate-fade-up items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-brand-gradient text-white shadow-md"
                : "text-muted-foreground hover:translate-x-1 hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {active && <span className="nav-active-bar -left-3" />}
            <Icon className={cn("h-4 w-4 transition-transform duration-200", !active && "group-hover:scale-110")} />
            {item.label}
            {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/90 ping-dot" />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="blob left-[-8%] top-[-10%] h-72 w-72 bg-indigo-400/30 dark:bg-indigo-600/15" style={{ animation: "floaty 11s ease-in-out infinite" }} />
        <div className="blob right-[-6%] top-[30%] h-80 w-80 bg-fuchsia-400/25 dark:bg-fuchsia-600/12" style={{ animation: "floaty 14s ease-in-out infinite reverse" }} />
        <div className="blob bottom-[-12%] left-[30%] h-72 w-72 bg-cyan-400/20 dark:bg-cyan-600/10" style={{ animation: "floaty 17s ease-in-out infinite" }} />
      </div>

      {/* desktop sidebar */}
      <aside className="hidden lg:flex glass fixed inset-y-0 left-0 z-30 w-64 flex-col border-r">
        <Logo companyName={companyName} role={profile.role} />
        <div className="flex-1 overflow-y-auto scroll-thin">
          <NavLinks />
        </div>
        <div className="border-t p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-muted/60 p-2.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{profile.full_name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{profile.full_name || profile.email}</p>
              <p className="truncate text-[10px] text-muted-foreground">{profile.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="lg:pl-64 flex min-h-screen flex-col">
        {/* topbar */}
        <header className="glass sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo companyName={companyName} role={profile.role} />
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="lg:hidden text-sm font-bold gradient-text">{companyName || "HCM Lite"}</div>

          <div className="ml-auto flex items-center gap-1.5">
            <AiAssistant role={profile.role} />

            {/* notifications */}
            <DropdownMenu onOpenChange={(open) => open && unread > 0 && markRead({})}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ping-dot">
                      {unread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto scroll-thin">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(notifications?.rows ?? []).length === 0 && (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">No notifications yet</div>
                )}
                {(notifications?.rows ?? []).slice(0, 8).map((n) => (
                  <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 py-2">
                    <div className="flex w-full items-center gap-2">
                      <span className="text-sm font-medium leading-none">{n.title}</span>
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary ping-dot" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* theme */}
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-500 dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-500 dark:rotate-0 dark:scale-100" />
            </Button>

            {/* user */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 flex items-center gap-2 rounded-full outline-none ring-ring transition-transform hover:scale-105 focus-visible:ring-2">
                  <Avatar className="h-9 w-9 border-2 border-primary/30">
                    <AvatarFallback>{profile.full_name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{profile.full_name || "User"}</div>
                  <div className="text-xs font-normal text-muted-foreground">{profile.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Badge variant="info" className="mx-2 mb-1">{ROLE_LABEL[profile.role]}</Badge>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main key={pathname} className="flex-1 p-4 md:p-6 animate-fade-up">{children}</main>
        <Separator />
        <footer className="px-6 py-3 text-center text-[11px] text-muted-foreground">
          <span className="gradient-text font-bold">HCM Lite</span> · Saylani Hackathon 2026 · answers from live data only
        </footer>
      </div>
    </div>
  );
}
