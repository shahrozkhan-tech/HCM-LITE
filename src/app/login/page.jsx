"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const ROLE_HOME = { admin: "/admin", hr: "/hr", employee: "/employee" };

export function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="blob left-[-10%] top-[-15%] h-96 w-96 bg-indigo-500/40" style={{ animation: "floaty 10s ease-in-out infinite" }} />
      <div className="blob right-[-8%] top-[20%] h-[26rem] w-[26rem] bg-fuchsia-500/30" style={{ animation: "floaty 13s ease-in-out infinite reverse" }} />
      <div className="blob bottom-[-18%] left-[25%] h-80 w-80 bg-cyan-400/30" style={{ animation: "floaty 16s ease-in-out infinite" }} />
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, must_change_password")
        .eq("id", data.user.id)
        .single();
      toast.success("Welcome back!");
      router.push(profile?.must_change_password ? "/change-password" : ROLE_HOME[profile?.role] ?? "/employee");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass w-full max-w-sm animate-scale-in border-white/60 shadow-2xl dark:border-white/10">
      <CardContent className="p-7">
        <div className="mb-6 text-center">
          <div className="bg-brand-gradient mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-extrabold text-white shadow-lg">
            HC
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="gradient-text">HCM Lite</span>
          </h1>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Sign in to your workspace
          </p>
        </div>

        {search.get("error") && (
          <p className="mb-4 animate-fade-in rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
            {search.get("error")}
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5 animate-fade-up" style={{ animationDelay: "0.08s" }}>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-11" />
          </div>
          <div className="space-y-1.5 animate-fade-up" style={{ animationDelay: "0.14s" }}>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          </div>
          <Button type="submit" size="lg" className="w-full gap-2 animate-fade-up" style={{ animationDelay: "0.2s" }} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Sign in
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: "0.3s" }}>
          First time here? Ask Admin to set up the system at{" "}
          <a className="font-semibold text-primary underline underline-offset-2" href="/setup">/setup</a>.
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <AuthBackdrop />
      <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-primary" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
