"use client";

import { useState } from "react";
import {
  Users, UserMinus, Wallet, BadgeDollarSign, Clock, Plane, LogIn, Loader2, Sparkles, TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { BarChartCard, PieChartCard } from "@/components/charts";
import { HeroBanner } from "@/components/hero-banner";
import { Building2 } from "lucide-react";
import { useGetDashboardQuery, useGetMeQuery, useAiSummaryMutation } from "@/store/api";
import { formatMoney, formatDate, cn } from "@/lib/utils";
import { EmptyState } from "@/components/page-header";
import { CelebrationsWidget } from "@/components/features/celebrations-widget";

export function AdminDashboard() {
  const { data: me } = useGetMeQuery();
  const { data, isLoading } = useGetDashboardQuery();
  const [summarize, { isLoading: summarizing }] = useAiSummaryMutation();
  const [summary, setSummary] = useState("");

  if (isLoading || !data?.admin) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const d = data.admin;

  const runSummarize = async () => {
    try {
      const res = await summarize({
        context: "Admin company dashboard",
        kpis: {
          headcount: d.headcount,
          probation: d.probation,
          exitsYTD: d.exitsYtd,
          attritionPercentYTD: d.attritionYtd,
          payrollCostYTD: d.payrollCostYtd,
          averageGrossSalary: d.avgGross,
          presentToday: d.presentToday,
          lateToday: d.lateToday,
          onLeaveToday: d.onLeaveToday,
          headcountByDepartment: Object.fromEntries(d.headcountByDept.map((x) => [x.name, x.value])),
          payrollGrossByDepartment: Object.fromEntries((d.payrollByDept ?? []).map((x) => [x.name, x.gross])),
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
        roleLabel="Company Overview"
        icon={<Building2 className="h-6 w-6" />}
      >
        <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur text-center">
          <div className="text-xl font-extrabold leading-none">{d.headcount}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/80">people</div>
        </div>
        <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur text-center">
          <div className="text-xl font-extrabold leading-none">{d.attritionYtd}%</div>
          <div className="text-[10px] uppercase tracking-wider text-white/80">attrition YTD</div>
        </div>
      </HeroBanner>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <StatCard label="Headcount" value={d.headcount} sub={`${d.probation} on probation`} icon={Users} tone="primary" />
        <StatCard label="Attrition YTD" value={`${d.attritionYtd}%`} sub={`${d.exitsYtd} exits`} icon={UserMinus} tone={d.attritionYtd > 10 ? "destructive" : "default"} />
        <StatCard label="Payroll cost YTD" value={formatMoney(d.payrollCostYtd.gross)} sub={`net ${formatMoney(d.payrollCostYtd.net)}`} icon={Wallet} />
        <StatCard label="Average salary" value={formatMoney(d.avgGross)} sub="gross / month" icon={BadgeDollarSign} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 stagger">
        <StatCard label="Present today" value={d.presentToday} icon={LogIn} tone="success" />
        <StatCard label="Late today" value={d.lateToday} icon={Clock} tone={d.lateToday ? "warning" : "default"} />
        <StatCard label="On leave today" value={d.onLeaveToday} icon={Plane} />
      </div>

      {/* AI summary */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">AI dashboard summary</p>
                <p className="text-xs text-muted-foreground">3–5 insights generated from the KPIs above only.</p>
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
          <CardHeader className="pb-0"><CardTitle className="text-sm">Headcount by department</CardTitle></CardHeader>
          <CardContent>
            {d.headcountByDept.length ? (
              <BarChartCard data={d.headcountByDept} xKey="name" series={[{ key: "value", name: "Employees" }]} />
            ) : (
              <EmptyState icon={Users} title="No departments yet" description="Create departments in Organization settings first." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Payroll cost by month</CardTitle></CardHeader>
          <CardContent>
            {d.payrollCostByMonth.length ? (
              <BarChartCard
                data={d.payrollCostByMonth}
                xKey="month"
                series={[{ key: "gross", name: "Gross" }, { key: "net", name: "Net" }]}
              />
            ) : (
              <EmptyState icon={Wallet} title="No payroll runs yet" description="HR creates the monthly draft; you finalize it." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Payroll cost by department (YTD)</CardTitle></CardHeader>
          <CardContent>
            {(d.payrollByDept ?? []).length ? (
              <BarChartCard
                data={d.payrollByDept}
                xKey="name"
                series={[{ key: "gross", name: "Gross" }, { key: "net", name: "Net" }]}
              />
            ) : (
              <EmptyState icon={Wallet} title="No payroll data yet" description="Appears after the first payroll run." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Average salary by designation</CardTitle></CardHeader>
          <CardContent>
            {(d.avgGrossByDesignation ?? []).length ? (
              <BarChartCard data={d.avgGrossByDesignation} xKey="name" series={[{ key: "value", name: "Avg gross" }]} />
            ) : (
              <EmptyState title="No designations set" description="Assign designations to employees to see this." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Gender split</CardTitle></CardHeader>
          <CardContent>
            {d.genderSplit.length ? <PieChartCard data={d.genderSplit} /> : <EmptyState title="No employees yet" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Tenure distribution</CardTitle></CardHeader>
          <CardContent>
            <BarChartCard data={d.tenureBuckets} xKey="name" series={[{ key: "value", name: "Employees" }]} />
          </CardContent>
        </Card>

        <CelebrationsWidget />
      </div>

      {/* bonus: attrition risk score */}
      {d.attritionRisk?.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingDown className="h-4 w-4 text-warning" /> Attrition risk — top 5 (bonus heuristic)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {d.attritionRisk.map((r) => (
              <div key={r.code} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{r.code}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    r.level === "high" && "bg-destructive/15 text-destructive",
                    r.level === "medium" && "bg-warning/15 text-warning",
                    r.level === "low" && "bg-success/15 text-success"
                  )}
                >
                  {r.score}/100 {r.level}
                </span>
                <span className="text-xs text-muted-foreground">{r.reasons.join(" · ")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* audit feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent audit activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {d.auditFeed.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          {d.auditFeed.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 border-b pb-2 text-sm last:border-0 last:pb-0">
              <span className="font-medium">{a.actor_name ?? "system"}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{a.action}</span>
              <span className="text-muted-foreground">on {a.entity}{a.entity_id ? ` (${a.entity_id.slice(0, 8)})` : ""}</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
