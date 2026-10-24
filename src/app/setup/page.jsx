"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetSetupStatusQuery, useRunSetupMutation } from "@/store/api";
import { AuthBackdrop } from "@/app/login/page";

/** First-run wizard (M2): company profile + Admin account on a fresh install. */
export default function SetupPage() {
  const router = useRouter();
  const { data, isLoading } = useGetSetupStatusQuery();
  const [setup, { isLoading: saving }] = useRunSetupMutation();
  const [form, setForm] = useState({
    company_name: "", full_name: "", email: "", password: "",
    office_start: "09:00", grace_minutes: 15, timezone: "Asia/Karachi",
    office_lat: "", office_lng: "", geofence_radius: 150,
  });

  useEffect(() => {
    if (data?.envAdmin?.email) {
      setForm((f) => ({ ...f, email: f.email || data.envAdmin.email }));
    }
  }, [data]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await setup({
        ...form,
        grace_minutes: Number(form.grace_minutes),
        geofence_radius: Number(form.geofence_radius),
        office_lat: form.office_lat ? Number(form.office_lat) : undefined,
        office_lng: form.office_lng ? Number(form.office_lng) : undefined,
      }).unwrap();
      toast.success("Setup complete — sign in with your Admin account");
      router.push("/login");
    } catch {
      /* toast shown */
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <AuthBackdrop />
      <Card className="glass w-full max-w-2xl animate-scale-in border-white/60 shadow-2xl dark:border-white/10">
        <CardContent className="p-7">
          <div className="mb-6 text-center">
            <div className="bg-brand-gradient mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-extrabold text-white shadow-lg">
              HC
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Welcome to <span className="gradient-text">HCM Lite</span>
            </h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Fresh install detected — set up your company and create the first Admin account.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking system state…
            </div>
          ) : data && !data.fresh ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">Setup is already complete. Sign in to continue.</p>
              <Button onClick={() => router.push("/login")}>Go to sign in</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="stagger sm:col-span-2 space-y-1.5">
                  <Label htmlFor="company">Company name *</Label>
                  <Input id="company" required value={form.company_name} onChange={set("company_name")} placeholder="Saylani Welfare" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Admin full name</Label>
                  <Input id="name" value={form.full_name} onChange={set("full_name")} placeholder="Alice Khan" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Admin email *</Label>
                  <Input id="email" type="email" required value={form.email} onChange={set("email")} placeholder="admin@company.com" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw">Password * (min 8 chars)</Label>
                  <Input id="pw" type="password" required minLength={8} value={form.password} onChange={set("password")} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tz">Timezone</Label>
                  <Input id="tz" value={form.timezone} onChange={set("timezone")} placeholder="Asia/Karachi" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="start">Office start</Label>
                  <Input id="start" type="time" value={form.office_start} onChange={set("office_start")} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grace">Grace minutes</Label>
                  <Input id="grace" type="number" min={0} max={120} value={form.grace_minutes} onChange={set("grace_minutes")} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lat">Office latitude (optional)</Label>
                  <Input id="lat" value={form.office_lat} onChange={set("office_lat")} placeholder="24.8607" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lng">Office longitude (optional)</Label>
                  <Input id="lng" value={form.office_lng} onChange={set("office_lng")} placeholder="67.0011" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="radius">Geofence radius (m)</Label>
                  <Input id="radius" type="number" min={30} max={2000} value={form.geofence_radius} onChange={set("geofence_radius")} className="h-11" />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full gap-2" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Create Admin & finish setup
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
