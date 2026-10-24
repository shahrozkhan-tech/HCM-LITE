"use client";

import { useState } from "react";
import {
  Users, Clock, Plane, UserX, LogIn, Inbox, Wrench, Loader2, Sparkles, Flag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { LineChartCard, BarChartCard } from "@/components/charts";
import { useGetDashboardQuery, useGetOrgQuery, useGetSettingsQuery, useGetMeQuery, useAiSummaryMutation } from "@/store/api";
import { EmptyState } from "@/components/page-header";
import { HeroBanner } from "@/components/hero-banner";

export function HrDashboard() {
  const { data: me } = useGetMeQuery();
  const { data: org } = useGetOrgQuery();
  const { data: settingsData } = useGetSettingsQuery();
  const [deptFilter, setDeptFilter] = useState("");
  const { data, isLoading } = useGetDashboardQuery(deptFilter ? { department_id: deptFilter } : undefined);
  const [summarize, { isLoading: summarizing }] = useAiSummaryMutation();
  const [summary, setSummary] = useState("");

  if (isLoading || !data?.hr) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const d = data.hr;

  const runSummarize = async () => {
    try {
      const res = await summarize({
        context: "HR dashboard (last 14 days trend, 30-day absenteeism)",
        kpis: {
          headcount: d.headcount,
          presentToday: d.presentToday,
          lateToday: d.lateToday,
          onLeaveToday: d.onLeaveToday,
          absentToday: d.absentToday,
          pendingLeaveRequests: d.pendingLeaveRequests,
          pendingCorrections: d.pendingCorrections,
          absenteeismByDeptPercent: Object.fromEntries(d.absenteeismByDept.map((x) => [x.name, x.value])),
          leaveDaysByTypeLast30: Object.fromEntries(d.leaveByType.map((x) => [x.name, x.days])),
          topLateComers: d.topLateComers.map((t) => `${t.name}: ${t.lateCount}`),
        },
      }).unwrap();
      setSummary(res.summary ?? "");
    } catch {
      setSummary("");
    }
  };

  return (
    <div className="space-y-6">
      <HeroBanner
        name={me?.profile?.full_name}
        roleLabel="People Operations"
        icon={<Users className="h-6 w-6" />}
      >
        <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur text-center">
          <div className="text-xl font-extrabold leading-none">{d.presentToday}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/80">present</div>
        </div>
        <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur text-center">
          <div className="text-xl font-extrabold leading-none">{d.lateToday}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/80">late</div>
        </div>
        <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur text-center">
          <div className="text-xl font-extrabold leading-none">{d.pendingLeaveRequests}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/80">pending</div>
        </div>
      </HeroBanner>

      {/* department filter (M7 requirement) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        >
          <option value="">All departments</option>
          {(org?.departments ?? []).map((dep) => (
            <option key={dep.id} value={dep.id}>{dep.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <StatCard label="Headcount" value={d.headcount} icon={Users} tone="primary" />
        <StatCard label="Present today" value={d.presentToday} icon={LogIn} tone="success" />
        <StatCard label="Late today" value={d.lateToday} icon={Clock} tone={d.lateToday ? "warning" : "default"} />
        <StatCard label="On leave today" value={d.onLeaveToday} icon={Plane} />
        <StatCard label="Absent today" value={d.absentToday} icon={UserX} tone={d.absentToday ? "destructive" : "default"} />
        <StatCard label="Late % today" value={`${d.latePercentToday ?? 0}%`} icon={Clock} sub="late ÷ (present + late)" tone="warning" />
        <StatCard label="Pending leave requests" value={d.pendingLeaveRequests} icon={Inbox} tone={d.pendingLeaveRequests ? "warning" : "default"} />
        <StatCard label="Pending corrections" value={d.pendingCorrections} icon={Wrench} tone={d.pendingCorrections ? "warning" : "default"} />
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">AI dashboard summary</p>
                <p className="text-xs text-muted-foreground">Insights generated only from the KPIs above.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={runSummarize} disabled={summarizing} className="gap-2">
              {summarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Summarize
            </Button>
          </div>
          {summary && (
            <div className="mt-3 whitespace-pre-wrap rounded-lg border bg-background p-3 text-sm leading-relaxed">
              {summary}
              <p className="mt-2 text-[10px] text-muted-foreground">AI-generated · numbers from live dashboard KPIs</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Attendance rate — last 14 days</CardTitle></CardHeader>
          <CardContent>
            <LineChartCard data={d.attendanceTrend} xKey="date" series={[{ key: "rate", name: "Rate %" }]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Absenteeism by department (30 days, %)</CardTitle></CardHeader>
          <CardContent>
            {d.absenteeismByDept.length ? (
              <BarChartCard data={d.absenteeismByDept} xKey="name" series={[{ key: "value", name: "Absent %" }]} />
            ) : (
              <EmptyState title="No employees yet" description="Register employees to see absenteeism." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Leave days by type (30 days)</CardTitle></CardHeader>
          <CardContent>
            <BarChartCard data={d.leaveByType} xKey="name" series={[{ key: "days", name: "Approved days" }]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Leave utilization YTD (approved ÷ quota)</CardTitle></CardHeader>
          <CardContent>
            <BarChartCard
              data={(d.leaveUtilization ?? []).map((u) => ({ name: u.name, pct: u.value }))}
              xKey="name"
              series={[{ key: "pct", name: "Utilization %" }]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Top 5 late-comers this month</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {d.topLateComers.length === 0 && <p className="text-sm text-muted-foreground">No late arrivals this month. 🎉</p>}
            {d.topLateComers.map((t, i) => (
              <div key={t.code} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning/15 text-xs font-bold text-warning">{i + 1}</span>
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground">{t.code}</span>
                <span className="ml-auto rounded bg-muted px-2 py-0.5 text-xs">{t.lateCount} late</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* bonus: absence anomaly flags */}
        {d.anomalyFlags?.length > 0 && (
          <Card className="border-destructive/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Flag className="h-4 w-4 text-destructive" /> Absence anomalies 🚩 (bonus)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.anomalyFlags.map((f) => (
                <div key={f.code} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{f.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{f.code}</span>
                  <span className="flex flex-wrap gap-1">
                    {f.flags.map((flag, i) => (
                      <span key={i} className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
                        {flag}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* company rules — HR view (checklist #3/#4) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Company rules (view-only · managed by Admin)</CardTitle>
          </CardHeader>
          <CardContent>
            {settingsData?.settings ? (
              <div className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <span className="text-muted-foreground">Office start</span><span>{settingsData.settings.office_start}</span>
                <span />
                <span className="text-muted-foreground">Grace period</span><span>{settingsData.settings.grace_minutes} min</span>
                <span />
                <span className="text-muted-foreground">Half-day under</span><span>{settingsData.settings.half_day_hours} h</span>
                <span />
                <span className="text-muted-foreground">Weekend</span><span>Sat + Sun</span>
                <span />
                <span className="text-muted-foreground">Quotas (A/S/C)</span>
                <span>{settingsData.settings.annual_quota} / {settingsData.settings.sick_quota} / {settingsData.settings.casual_quota}</span>
                <span />
                <span className="text-muted-foreground">Departments</span>
                <span>{(org?.departments ?? []).length} · {(org?.holidays ?? []).length} holidays set</span>
              </div>
            ) : (
              <Skeleton className="h-16" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
