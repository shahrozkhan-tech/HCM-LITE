"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUpdateProfileMutation } from "@/store/api";
import { AuthBackdrop } from "@/app/login/page";

const ROLE_HOME = { admin: "/admin", hr: "/hr", employee: "/employee" };

export default function ChangePasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [updateProfile] = useUpdateProfileMutation();

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords do not match");

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        toast.error(error.message);
        return;
      }
      await updateProfile({ must_change_password: false });
      toast.success("Password updated — welcome!");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      router.push(ROLE_HOME[profile?.role] ?? "/employee");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <AuthBackdrop />
      <Card className="glass w-full max-w-sm animate-scale-in border-white/60 shadow-2xl dark:border-white/10">
        <CardContent className="p-7">
          <div className="mb-6 text-center">
            <div className="bg-brand-gradient mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">Set your password</h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Temporary passwords must be changed before continuing.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5 animate-fade-up" style={{ animationDelay: "0.08s" }}>
              <Label htmlFor="pw">New password (min 8 chars)</Label>
              <Input id="pw" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1.5 animate-fade-up" style={{ animationDelay: "0.14s" }}>
              <Label htmlFor="cpw">Confirm password</Label>
              <Input id="cpw" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" />
            </div>
            <Button type="submit" size="lg" className="w-full gap-2 animate-fade-up" style={{ animationDelay: "0.2s" }} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Save & continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
