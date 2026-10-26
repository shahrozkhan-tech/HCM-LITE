"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2, Sparkles, ShieldCheck, Users, CalendarClock, Plane, Wallet,
  LayoutDashboard, Megaphone, ScrollText, KeyRound, Camera, Moon, Smartphone,
  TrendingDown, Flag, Timer, Languages, ArrowRight, LogIn, Rocket, BarChart3,
  CheckCircle2, Bot, Lock, Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, titleCase } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const ROLE_HOME = { admin: "/admin", hr: "/hr", employee: "/employee" };

/* ── scroll reveal wrapper ─────────────────────────────────────────── */
function Reveal({ children, delay = 0, className }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVis(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={cn(className, vis ? "animate-fade-up" : "opacity-0")}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

const MODULES = [
  { icon: KeyRound, name: "M1 · Auth & Access", desc: "JWT login, 3 roles, role + data-scope guard on every request." },
  { icon: Building2, name: "M2 · Organization", desc: "Departments, designations, leave quotas, holidays, office rules & geofence." },
  { icon: Users, name: "M3 · Employees", desc: "Directory & search, Employee 360, CSV import with dry-run + export." },
  { icon: CalendarClock, name: "M4 · Attendance", desc: "Web check-in/out, auto status rules, corrections, camera + location." },
  { icon: Plane, name: "M5 · Leave", desc: "Apply, balances, overlap & holiday checks, HR approval inbox." },
  { icon: Wallet, name: "M6 · Payroll Lite", desc: "Salary structure, monthly run, tax slab, locked finalize, payslip PDF." },
  { icon: LayoutDashboard, name: "M7 · Dashboards", desc: "Role-based KPIs, trends & insights — all computed on the server. Plus a monthly Reports & Analytics page with CSV export." },
  { icon: Bot, name: "M8 · AI Assistant", desc: "Chat with tools, dashboard summaries, smart leave, policy Q&A." },
  { icon: Megaphone, name: "M9 · Comms & Audit", desc: "Announcements, in-app notifications, designed emails, audit log." },
];

const ROLES = [
  {
    icon: ShieldCheck,
    title: "Admin",
    tag: "Company level",
    points: [
      "Company setup, rules & office geofence",
      "Create HR logins, reset & deactivate accounts",
      "Finalize payroll — only Admin locks the month",
      "Headcount, attrition, payroll-cost analytics",
      "Full audit log of every important action",
    ],
  },
  {
    icon: Users,
    title: "HR",
    tag: "People operations",
    points: [
      "Register employees — logins auto-created",
      "Daily attendance board & corrections",
      "Approve / reject leave with a comment",
      "Build & review the monthly payroll draft",
      "Late-comers, absenteeism & anomaly insights",
    ],
  },
  {
    icon: CalendarClock,
    title: "Employee",
    tag: "Self-service",
    points: [
      "Web + camera check-in / out",
      "Own attendance calendar & corrections",
      "Leave in plain words — AI pre-fills the form",
      "Balances, history & payslip PDF downloads",
      "Ask AI about own data & company policy",
    ],
  },
];

const BONUS = [
  { icon: Camera, label: "Camera check-in", sub: "face detection + GPS geofence" },
  { icon: TrendingDown, label: "Attrition risk score", sub: "heuristic with reasons" },
  { icon: Flag, label: "Anomaly flags", sub: "absence patterns detected" },
  { icon: Timer, label: "Late penalty", sub: "3 lates = 0.5 day in payroll" },
  { icon: Languages, label: "Roman Urdu AI", sub: "apo apni zuban mein poochein" },
  { icon: Moon, label: "Dark mode", sub: "system-aware, everywhere" },
  { icon: Smartphone, label: "PWA", sub: "installable app experience" },
  { icon: ScrollText, label: "Audit trail", sub: "before/after JSON history" },
];

const STATS = [
  { value: "9", label: "Integrated modules" },
  { value: "25+", label: "Checklist functionalities" },
  { value: "3", label: "Roles with server-side scope" },
  { value: "100%", label: "Live data — zero dummy rows" },
];

const STEPS = [
  { icon: Building2, title: "Sign up as Admin", desc: "The first sign-up creates the company: office hours, grace period, weekends, office geofence, departments & holidays." },
  { icon: Users, title: "Register your people", desc: "HR adds employees — logins are created automatically with a temporary password and a forced first sign-in change." },
  { icon: CalendarClock, title: "Track every day", desc: "Web or camera check-in/out, leave in plain words, HR approvals — every rule enforced on the server." },
  { icon: Wallet, title: "Pay & analyze", desc: "HR builds the payroll draft, Admin locks the month, payslips go out — then Reports turn records into insight." },
];

/* ── page ──────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [home, setHome] = useState(null); // role home when already signed in

  useEffect(() => {
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const res = await fetch("/api/auth/me");
          if (res.ok) {
            const me = await res.json();
            setHome(ROLE_HOME[me.profile?.role] ?? "/employee");
          }
        }
      } catch {
        /* stay logged-out view */
      }
    })();
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="blob left-[-10%] top-[-12%] h-[30rem] w-[30rem] bg-indigo-500/25 dark:bg-indigo-600/12" style={{ animation: "floaty 12s ease-in-out infinite" }} />
        <div className="blob right-[-8%] top-[22%] h-[28rem] w-[28rem] bg-fuchsia-500/20 dark:bg-fuchsia-600/10" style={{ animation: "floaty 15s ease-in-out infinite reverse" }} />
        <div className="blob bottom-[-14%] left-[28%] h-[26rem] w-[26rem] bg-cyan-400/20 dark:bg-cyan-600/10" style={{ animation: "floaty 18s ease-in-out infinite" }} />
      </div>

      {/* ── navbar ──────────────────────────────────────────────────── */}
      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <div className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold text-white shadow-md">
            HC
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            HCM <span className="gradient-text">Lite</span>
          </span>
          <nav className="ml-6 hidden items-center gap-5 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#modules" className="transition-colors hover:text-foreground">Modules</a>
            <a href="#roles" className="transition-colors hover:text-foreground">Roles</a>
            <a href="#ai" className="transition-colors hover:text-foreground">AI Assistant</a>
            <a href="#bonus" className="transition-colors hover:text-foreground">Bonus</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-500 dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-500 dark:rotate-0 dark:scale-100" />
            </Button>
            {home ? (
              <Button asChild size="sm" className="gap-2">
                <a href={home}><LogIn className="h-4 w-4" /> Go to dashboard</a>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <a href="/login">Sign in</a>
                </Button>
                <Button asChild size="sm" className="gap-2">
                  <a href="/login">
                    <Rocket className="h-4 w-4" /> Get started
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── hero ────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 md:pt-20">
        <div className="stagger flex flex-col items-center text-center">
          <Badge variant="info" className="animate-none gap-1.5 px-3 py-1 text-[11px] font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> Saylani Hackathon 2026 · 9 modules · 25 features · AI built-in
          </Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl">
            Human Capital Management,{" "}
            <span className="gradient-text">made intelligent.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            One workspace for Admin, HR and Employees — attendance, leave, payroll and analytics
            that run on <b className="text-foreground">real data only</b>, with an AI assistant that
            answers from your live numbers. No dummy data, ever.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2 rounded-xl">
              <a href="/login">
                {home ? "Open my dashboard" : "Sign in / Sign up"}
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-xl">
              <a href="#modules">Explore the 9 modules</a>
            </Button>
          </div>

          {/* trust row */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Server-side RBAC + RLS</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Payslip PDFs + tax slabs</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Face + geofence check-in</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Designed system emails</span>
          </div>
        </div>

        {/* dashboard mockup */}
        <Reveal delay={0.15} className="relative mx-auto mt-14 max-w-4xl">
          <div className="absolute inset-x-8 -top-6 h-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="glass relative overflow-hidden rounded-2xl border shadow-2xl">
            <div className="flex items-center gap-1.5 border-b bg-card/70 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-3 rounded-md bg-muted px-2.5 py-0.5 text-[10px] text-muted-foreground">hcm-lite · dashboard</span>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3 md:grid-cols-4">
              {[
                { label: "Headcount", value: "42", tone: "text-primary" },
                { label: "Present", value: "36", tone: "text-success" },
                { label: "On leave", value: "5", tone: "text-foreground" },
                { label: "Late", value: "3", tone: "text-warning" },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border bg-card p-3 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
                  <p className={cn("mt-1 text-2xl font-extrabold tabular-nums", k.tone)}>{k.value}</p>
                </div>
              ))}
              {/* fake chart */}
              <div className="rounded-xl border bg-card p-3 sm:col-span-2 md:col-span-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Attendance trend — 14 days</p>
                <div className="flex h-24 items-end gap-1.5">
                  {[38, 62, 48, 75, 60, 85, 70, 92, 66, 78, 88, 58, 80, 95].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-600 to-violet-400"
                      style={{ height: `${h}%`, animation: `fadeUp .7s ${0.05 * i}s cubic-bezier(.16,1,.3,1) both` }}
                    />
                  ))}
                </div>
              </div>
              {/* AI chip */}
              <div className="flex flex-col justify-between rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-primary"><Bot className="h-3.5 w-3.5" /> AI asks back</p>
                <p className="mt-1 text-left text-[11px] leading-snug text-muted-foreground">
                  “Who is on leave today?”<br />
                  <span className="font-semibold text-foreground">5 employees — 3 casual, 2 sick.</span>
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── stats band ──────────────────────────────────────────────── */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 stagger md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="gradient-text text-3xl font-extrabold tracking-tight md:text-4xl">{s.value}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── how it works ────────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <Reveal className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">From empty workspace to payslips</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            A guided four-step flow — the demo story judges can walk through in five minutes.
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={0.06 * i}>
              <div className="card-hover relative h-full rounded-2xl border bg-card p-5">
                <span className="absolute right-4 top-3 text-4xl font-extrabold text-muted-foreground/15">{i + 1}</span>
                <div className="bg-brand-gradient mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md">
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="font-bold">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── modules ─────────────────────────────────────────────────── */}
      <section id="modules" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <Reveal className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">Nine modules, one flow</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Rules set in Organization decide attendance and leave status; attendance and unpaid leave
            decide payroll; dashboards aggregate it all — and the AI answers from the same services.
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <Reveal key={m.name} delay={0.04 * i}>
              <div className="card-hover group h-full rounded-2xl border bg-card p-5">
                <div className="bg-brand-gradient mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <m.icon className="h-5 w-5" />
                </div>
                <p className="font-bold">{m.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── roles ───────────────────────────────────────────────────── */}
      <section id="roles" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <Reveal className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">Three roles, three worlds</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Own menu, own data scope, own dashboard — enforced on the server for every request,
            not just hidden buttons. The AI works with exactly the same access.
          </p>
        </Reveal>
        <div className="grid gap-5 lg:grid-cols-3">
          {ROLES.map((r, i) => (
            <Reveal key={r.title} delay={0.08 * i}>
              <div className="card-hover h-full rounded-2xl border bg-card p-6">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-gradient-soft flex h-11 w-11 items-center justify-center rounded-xl border text-primary">
                    <r.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-extrabold">{r.title}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{r.tag}</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── AI section ──────────────────────────────────────────────── */}
      <section id="ai" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <Badge variant="info" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Module M8</Badge>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">
              An assistant that <span className="gradient-text">reads your database</span>
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The model never touches the database. It picks a tool — the backend runs it with
              <b className="text-foreground"> your</b> scope and the same permission checks as the REST
              API — then writes the answer from those numbers only.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                "7 live tools: headcount, attendance, late-comers, leave, payroll, balances, search",
                "Dashboard “Summarize” → 3–5 bullets from the exact KPI JSON",
                "Smart leave: “next Monday-Tuesday off for a wedding” → pre-filled form",
                "Policy Q&A straight from the rulebook — or it says it doesn't know",
                "Roman Urdu samajhta hai — apni zuban mein poochein",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Lock className="h-4 w-4 text-success" /> API key lives on the server · 15 s timeout · rate-limited · every call logged
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="glass rounded-2xl border p-5 shadow-2xl">
              <div className="mb-4 flex items-center gap-2.5 border-b pb-3">
                <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white"><Bot className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm font-bold">HCM Assistant</p>
                  <p className="text-[10px] text-muted-foreground">live data · role-scoped</p>
                </div>
                <Badge variant="outline" className="ml-auto text-[9px]">AI-generated</Badge>
              </div>
              <div className="space-y-3">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-gradient px-3.5 py-2.5 text-sm text-white shadow">
                  How many active employees are in Engineering?
                </div>
                <div className="max-w-[90%] animate-fade-up rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5 text-sm shadow-sm">
                  Engineering currently has <b>14 active employees</b> (out of 42 company-wide).
                  <div className="mt-1.5 flex gap-1">
                    <Badge variant="muted" className="font-mono text-[9px]">get_headcount</Badge>
                  </div>
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-gradient px-3.5 py-2.5 text-sm text-white shadow">
                  What is Bilal's salary? 😏
                </div>
                <div className="max-w-[90%] animate-fade-up rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5 text-sm shadow-sm">
                  I can't share another employee's salary — you can only see your own payslip data.
                  Want your own net pay for this month?
                  <div className="mt-1.5 flex gap-1">
                    <Badge variant="destructive" className="text-[9px]">scope guard</Badge>
                  </div>
                </div>
                <div className="typing-dots px-1 py-2"><span /><span /><span /></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── bonus ───────────────────────────────────────────────────── */}
      <section id="bonus" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <Reveal className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">Bonus points, included</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Everything from the brief's bonus list ships out of the box.</p>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {BONUS.map((b, i) => (
            <Reveal key={b.label} delay={0.05 * i}>
              <div className="card-hover h-full rounded-2xl border bg-card p-4 text-center">
                <div className="bg-brand-gradient-soft mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl border text-primary">
                  <b.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold">{b.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{b.sub}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-6">
        <Reveal>
          <div className="bg-brand-gradient relative overflow-hidden rounded-3xl p-10 text-center text-white shadow-2xl md:p-14">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-fuchsia-300/25 blur-3xl" />
            <h2 className="relative text-3xl font-extrabold tracking-tight md:text-4xl">
              Ready to run HR on live data?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm text-white/85 md:text-base">
              Fresh install starts empty — set up your company, create an Admin, register your team.
              Every number after that comes from what people actually do.
            </p>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" variant="secondary" className="gap-2 rounded-xl font-bold">
                <a href={home ?? "/login"}>
                  {home ? "Go to my dashboard" : "Sign in / Sign up"}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" className="rounded-xl border border-white/40 bg-white/10 text-white shadow-none backdrop-blur hover:bg-white/20">
                <a href="/sample-payslip.pdf" target="_blank" rel="noreferrer">
                  <BarChart3 className="mr-2 h-4 w-4" /> See a sample payslip PDF
                </a>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── footer ──────────────────────────────────────────────────── */}
      <footer className="border-t py-10">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="bg-brand-gradient flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-extrabold text-white">HC</div>
              <span className="font-extrabold">HCM Lite</span>
            </div>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-muted-foreground">
              AI-assisted Human Capital Management for Admin, HR and Employees —
              built for the Saylani Hackathon 2026 with Next.js, Supabase & Redux Toolkit.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Product</p>
            <div className="mt-3 grid gap-2 text-sm">
              <a href="/login" className="text-muted-foreground transition-colors hover:text-foreground">Sign in</a>
              <a href="/login" className="text-muted-foreground transition-colors hover:text-foreground">Sign up / Sign in</a>
              <a href="#how" className="text-muted-foreground transition-colors hover:text-foreground">How it works</a>
              <a href="/sample-payslip.pdf" target="_blank" rel="noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">Sample payslip PDF</a>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Highlights</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Geo attendance", "Slab-tax payroll", "Leave workflows", "AI assistant", "Payslip PDFs", "Audit trail"].map((t) => (
                <span key={t} className="rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t px-4 pt-6 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} HCM Lite · Saylani Hackathon 2026 · every number on every page comes from live data only
        </div>
      </footer>
    </div>
  );
}
