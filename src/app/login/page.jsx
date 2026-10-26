"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Loader2, ShieldCheck, Eye, EyeOff, Bot, MapPin, Wallet, ArrowRight, Rocket, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { missingPublicConfig } from "@/lib/config";
import { ConfigBanner } from "@/components/config-banner";
import { useRunSetupMutation } from "@/store/api";

const BRAND_POINTS = [
  { icon: Bot, title: "AI assistant with live tools", sub: "Headcount, attendance, payroll — answered from your real numbers only." },
  { icon: MapPin, title: "Face + geofence check-in", sub: "Camera detection with server-side Haversine distance validation." },
  { icon: Wallet, title: "Payroll with slab tax & PDF", sub: "Late penalties, prorated joiners, one-click finalized payslips." },
];

export function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="blob left-[-10%] top-[-15%] h-96 w-96 bg-indigo-500/25" style={{ animation: "floaty 10s ease-in-out infinite" }} />
      <div className="blob right-[-8%] top-[20%] h-[26rem] w-[26rem] bg-fuchsia-500/20" style={{ animation: "floaty 13s ease-in-out infinite reverse" }} />
      <div className="blob bottom-[-18%] left-[25%] h-80 w-80 bg-cyan-400/20" style={{ animation: "floaty 16s ease-in-out infinite" }} />
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();

  // fresh install → "Sign up" creates the first Admin; afterwards Sign in only
  const [fresh, setFresh] = useState(null);
  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => setFresh(Boolean(d.fresh)))
      .catch(() => setFresh(false));
  }, []);

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── sign up (first Admin on a fresh install) ─────────────────────────
  const [su, setSuState] = useState({ company_name: "", full_name: "", email: "", password: "" });
  const setSu = (k) => (e) => setSuState({ ...su, [k]: e.target.value });
  const [runSetup, { isLoading: signingUp }] = useRunSetupMutation();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
        return;
      }
      toast.success("Welcome back!");
      // /go routes to the role dashboard server-side — fastest handoff
      router.push("/go");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const submitSignup = async (e) => {
    e.preventDefault();
    try {
      await runSetup(su).unwrap();
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: su.email,
        password: su.password,
      });
      if (error) {
        toast.success("Company created — sign in to continue");
        setMode("signin");
        setEmail(su.email);
        setPassword("");
        return;
      }
      toast.success("Company created — welcome!");
      router.push("/go");
      router.refresh();
    } catch {
      /* toast shown */
    }
  };

  const isSignup = mode === "signup" && fresh === true;

  return (
    <Card className="glass w-full max-w-md animate-scale-in border-white/60 shadow-2xl dark:border-white/10">
      <CardContent className="p-7 md:p-8">
        {/* mobile logo */}
        <div className="mb-6 flex items-center gap-3 lg:hidden">
          <div className="bg-brand-gradient flex h-11 w-11 items-center justify-center rounded-2xl text-base font-extrabold text-white shadow-lg">
            HC
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight leading-none">
              HCM <span className="gradient-text">Lite</span>
            </h1>
            <p className="text-[11px] text-muted-foreground">HR Management workspace</p>
          </div>
        </div>

        <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">
          {isSignup ? "Create your company" : "Sign in to your workspace"}
        </h2>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" /> Secured by Supabase Auth · role-based access
        </p>

        {search.get("error") && (
          <p className="mb-4 mt-4 animate-fade-in rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
            {search.get("error")}
          </p>
        )}

        {isSignup ? (
          <form onSubmit={submitSignup} className="mt-6 space-y-3.5">
            <div className="space-y-1.5 animate-fade-up" style={{ animationDelay: "0.06s" }}>
              <Label htmlFor="c-company">Company name</Label>
              <Input id="c-company" required value={su.company_name} onChange={setSu("company_name")} placeholder="Saylani Welfare" className="h-11" />
            </div>
            <div className="space-y-1.5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              <Label htmlFor="c-name">Your full name</Label>
              <Input id="c-name" value={su.full_name} onChange={setSu("full_name")} placeholder="Alice Khan" className="h-11" />
            </div>
            <div className="space-y-1.5 animate-fade-up" style={{ animationDelay: "0.14s" }}>
              <Label htmlFor="c-email">Admin email</Label>
              <Input id="c-email" type="email" required autoComplete="email" value={su.email} onChange={setSu("email")} placeholder="admin@company.com" className="h-11" />
            </div>
            <div className="space-y-1.5 animate-fade-up" style={{ animationDelay: "0.18s" }}>
              <Label htmlFor="c-pw">Password (min 8 chars)</Label>
              <Input id="c-pw" type="password" required minLength={8} autoComplete="new-password" value={su.password} onChange={setSu("password")} className="h-11" />
            </div>
            <Button type="submit" size="lg" className="btn-shine w-full gap-2 animate-fade-up rounded-xl" style={{ animationDelay: "0.22s" }} disabled={signingUp}>
              {signingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              {signingUp ? "Creating…" : "Create company & continue"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              You become the <b>Admin</b> — HR logins & employees are created inside the app.
            </p>
          </form>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5 animate-fade-up" style={{ animationDelay: "0.08s" }}>
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-11" />
            </div>
            <div className="space-y-1.5 animate-fade-up" style={{ animationDelay: "0.14s" }}>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={() => setShowPw((v) => !v)} className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                id="password" type={showPw ? "text" : "password"} required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11"
              />
            </div>
            <Button type="submit" size="lg" className="btn-shine w-full gap-2 animate-fade-up rounded-xl" style={{ animationDelay: "0.2s" }} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {loading ? "Signing in…" : "Sign in"}
              {!loading && <ArrowRight className="h-4 w-4 opacity-70" />}
            </Button>
          </form>
        )}

        <div className="mt-6 rounded-xl border bg-muted/40 p-3 text-center text-xs text-muted-foreground animate-fade-in">
          {fresh === true ? (
            isSignup ? (
              <>Already have an account?{" "}
                <button type="button" onClick={() => setMode("signin")} className="font-semibold text-primary underline underline-offset-2">
                  Sign in
                </button>
              </>
            ) : (
              <>New company?{" "}
                <button type="button" onClick={() => setMode("signup")} className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2">
                  <Rocket className="h-3 w-3" /> Create the first Admin account
                </button>
              </>
            )
          ) : fresh === false ? (
            <>New here? Ask your Admin to create your account.</>
          ) : (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> checking workspace…</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Left brand panel — desktop only, deep navy gradient with grid + proof points. */
function BrandPanel() {
  return (
    <div className="bg-brand-navy relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* texture + glow */}
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />

      {/* logo row */}
      <div className="relative flex items-center gap-3">
        <div className="bg-brand-gradient flex h-11 w-11 items-center justify-center rounded-2xl text-base font-extrabold text-white shadow-lg ring-1 ring-white/20">
          HC
        </div>
        <div>
          <p className="text-lg font-extrabold leading-none tracking-tight">HCM <span className="gradient-text">Lite</span></p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">Human Capital Management</p>
        </div>
      </div>

      {/* headline + proof */}
      <div className="relative max-w-lg">
        <h2 className="text-4xl font-extrabold leading-[1.12] tracking-tight text-white">
          People operations,{" "}
          <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
            run on live data.
          </span>
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-white/60">
          Attendance, leave, payroll and analytics for Admin, HR and Employees — every number
          computed on the server from what your team actually does. No dummy data, ever.
        </p>

        <ul className="mt-8 space-y-4">
          {BRAND_POINTS.map((p, i) => (
            <li key={p.title} className="flex items-start gap-3.5 animate-fade-up" style={{ animationDelay: `${0.15 + i * 0.09}s` }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 backdrop-blur">
                <p.icon className="h-5 w-5 text-indigo-200" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{p.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/50">{p.sub}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* stat strip */}
      <div className="relative grid grid-cols-4 gap-3 border-t border-white/10 pt-6">
        {[
          { v: "9", l: "modules" },
          { v: "25+", l: "features" },
          { v: "3", l: "roles" },
          { v: "100%", l: "live data" },
        ].map((s) => (
          <div key={s.l}>
            <p className="bg-gradient-to-r from-indigo-200 to-fuchsia-200 bg-clip-text text-2xl font-extrabold text-transparent">{s.v}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const missing = missingPublicConfig();
  if (missing.length) {
    return <ConfigBanner missing={missing} extra={["SUPABASE_SERVICE_ROLE_KEY", "AI_BASE_URL", "AI_API_KEY", "AI_MODEL"]} />;
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.08fr_1fr]">
      <BrandPanel />
      <div className="relative flex items-center justify-center p-4 md:p-8">
        <AuthBackdrop />
        <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-primary" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
