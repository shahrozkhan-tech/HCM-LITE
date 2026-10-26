"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, CornerDownLeft, Loader2, LayoutDashboard, Users,
  CalendarClock, Plane, Wallet, Building2, UserCog, Megaphone, ScrollText,
  CircleUser, Download, Mail, BarChart3, Bot,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { cn, initials } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useGetEmployeesQuery } from "@/store/api";

const ICONS = {
  dashboard: LayoutDashboard, employees: Users, attendance: CalendarClock,
  leaves: Plane, payroll: Wallet, org: Building2, users: UserCog,
  announcements: Megaphone, audit: ScrollText, profile: CircleUser,
  payslips: Download, emails: Mail, reports: BarChart3, ai: Bot,
};

const NAV = {
  admin: [
    { label: "Dashboard", href: "/admin", icon: "dashboard", group: "Go to" },
    { label: "Reports & Analytics", href: "/admin/reports", icon: "reports", group: "Go to" },
    { label: "Employees", href: "/admin/employees", icon: "employees", group: "Go to" },
    { label: "Attendance", href: "/admin/attendance", icon: "attendance", group: "Go to" },
    { label: "Leaves", href: "/admin/leaves", icon: "leaves", group: "Go to" },
    { label: "Payroll", href: "/admin/payroll", icon: "payroll", group: "Go to" },
    { label: "Organization", href: "/admin/settings", icon: "org", group: "Manage" },
    { label: "Users", href: "/admin/users", icon: "users", group: "Manage" },
    { label: "Announcements", href: "/admin/announcements", icon: "announcements", group: "Manage" },
    { label: "Emails", href: "/admin/emails", icon: "emails", group: "Manage" },
    { label: "Audit Log", href: "/admin/audit", icon: "audit", group: "Manage" },
  ],
  hr: [
    { label: "Dashboard", href: "/hr", icon: "dashboard", group: "Go to" },
    { label: "Reports & Analytics", href: "/hr/reports", icon: "reports", group: "Go to" },
    { label: "Employees", href: "/hr/employees", icon: "employees", group: "Go to" },
    { label: "Attendance", href: "/hr/attendance", icon: "attendance", group: "Go to" },
    { label: "Leaves", href: "/hr/leaves", icon: "leaves", group: "Go to" },
    { label: "Payroll", href: "/hr/payroll", icon: "payroll", group: "Go to" },
    { label: "Announcements", href: "/hr/announcements", icon: "announcements", group: "Manage" },
  ],
  employee: [
    { label: "Dashboard", href: "/employee", icon: "dashboard", group: "Go to" },
    { label: "My Attendance", href: "/employee/attendance", icon: "attendance", group: "Go to" },
    { label: "My Leaves", href: "/employee/leaves", icon: "leaves", group: "Go to" },
    { label: "My Payslips", href: "/employee/payslips", icon: "payslips", group: "Go to" },
    { label: "My Profile", href: "/employee/profile", icon: "profile", group: "Go to" },
  ],
};

/**
 * Ctrl/Cmd + K command palette: jump to pages, search the employee
 * directory (staff roles) and quick actions.
 */
export function CommandPalette({ role, onSignOut, open: openProp, setOpen: setOpenProp }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = setOpenProp ?? setOpenState;
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef(null);

  const isStaff = role === "admin" || role === "hr";
  const searchQ = q.trim();
  const { data: people, isFetching } = useGetEmployeesQuery(
    { q: searchQ, pageSize: 6 },
    { skip: !isStaff || !open || searchQ.length < 2 }
  );

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setCursor(0);
    }
  }, [open]);

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    const navItems = (NAV[role] ?? NAV.employee)
      .filter((n) => !query || n.label.toLowerCase().includes(query))
      .map((n) => ({ kind: "page", ...n }));

    const actions = [];
    if (!query || "dark mode theme toggle".includes(query) || "theme".includes(query)) {
      actions.push({
        kind: "action", id: "theme", group: "Actions", icon: "dashboard",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      });
    }
    if (onSignOut && (!query || "sign out logout".includes(query))) {
      actions.push({ kind: "action", id: "logout", group: "Actions", icon: "dashboard", label: "Sign out", run: onSignOut });
    }
    const actionItems = actions.filter((a) => !query || a.label.toLowerCase().includes(query));

    const peopleItems = (people?.rows ?? []).map((p) => ({
      kind: "person", id: p.id, group: "People", icon: "employees",
      label: `${p.first_name} ${p.last_name}`.trim(), sub: `${p.employee_code} · ${p.departments?.name ?? "—"}`,
      href: isStaff ? `/admin/employees?id=${p.id}` : null,
    }));

    return [...navItems, ...actionItems, ...peopleItems];
  }, [q, role, people, theme, setTheme, onSignOut, isStaff]);

  useEffect(() => setCursor(0), [q]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const pick = (item) => {
    setOpen(false);
    if (item.kind === "action") item.run?.();
    else if (item.href) router.push(item.href);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(items.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter" && items[cursor]) {
      e.preventDefault();
      pick(items[cursor]);
    }
  };

  let lastGroup = null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[22%] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, people, actions…"
            className="h-6 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto scroll-thin p-2">
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches for “{q}”
            </p>
          )}
          {items.map((item, idx) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            const Icon = ICONS[item.icon] ?? Search;
            return (
              <div key={`${item.kind}-${item.id ?? item.href ?? item.label}`}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {item.group}
                  </p>
                )}
                <button
                  data-idx={idx}
                  onClick={() => pick(item)}
                  onMouseEnter={() => setCursor(idx)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    cursor === idx ? "bg-primary/10 text-primary" : "text-foreground"
                  )}
                >
                  {item.kind === "person" ? (
                    <span className="bg-brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white">
                      {initials(item.label)}
                    </span>
                  ) : (
                    <Icon className="h-4 w-4 shrink-0 opacity-70" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                  {item.sub && <span className="hidden truncate text-[11px] text-muted-foreground sm:block">{item.sub}</span>}
                  {cursor === idx && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="rounded border bg-background px-1 font-semibold">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="rounded border bg-background px-1 font-semibold">↵</kbd> open</span>
          <span className="ml-auto flex items-center gap-1">
            <Bot className="h-3 w-3" /> HCM Lite command palette
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small topbar button that opens the palette (Ctrl/Cmd + K). */
export function CommandPaletteButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="hidden items-center gap-2 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:flex"
    >
      <Search className="h-3.5 w-3.5" />
      Search…
      <kbd className="rounded border bg-background px-1 py-0.5 text-[9px] font-semibold">Ctrl K</kbd>
    </button>
  );
}
