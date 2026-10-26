"use client";

import { useState } from "react";
import {
  BarChart3, Users, Clock, UserX, Wallet, Download, CalendarDays, Plane,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { BarChartCard, PieChartCard } from "@/components/charts";
import { PageHeader, EmptyState } from "@/components/page-header";
import { useGetReportsQuery, useGetOrgQuery } from "@/store/api";
import { formatMoney, titleCase } from "@/lib/utils";

/** Current month as YYYY-MM for the month input default. */
function currentMonth() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Shared Admin/HR monthly Reports & Analytics view — attendance summary,
 * leave usage and payroll outcome for any month, with CSV export.
 */
export function ReportsView() {
  const [month, setMonth] = useState(currentMonth());
  const [dept, setDept] = useState("all");
  const { data: org } = useGetOrgQuery();
  const { data, isLoading } = useGetReportsQuery({
    month,
    ...(dept !== "all" ? { department_id: dept } : {}),
  });

  const csvHref = `/api/reports?month=${month}${dept !== "all" ? `&department_id=${dept}` : ""}&format=csv`;

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const t = data.totals;
  const totalDays = t.present + t.late + t.half_day + t.absent + t.on_leave + t.missing_checkout;
  const absencePct = totalDays > 0 ? Math.round((t.absent / totalDays) * 1000) / 10 : 0;
  const punctuality = totalDays > 0 ? Math.round(((totalDays - t.late) / totalDays) * 1000) / 10 : 100;

  const leavePie = Object.entries(data.leaves.approvedDaysByType)
    .filter(([, days]) => days > 0)
    .map(([name, days]) => ({ name: titleCase(name), value: days }));

  const hoursChart = [...data.rows]
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 12)
    .map((r) => ({ name: r.name.split(" ")[0], hours: r.hours }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description={`Monthly attendance, leave and payroll roll-up — ${data.label}. Computed server-side from live records.`}
        actions={
          <a href={csvHref}>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </a>
        }
      />

      {/* filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Month</p>
            <Input type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value || currentMonth())} className="w-44" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Department</p>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {(org?.departments ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            {data.employees} employees in scope · {data.range.first.slice(8)}–{data.range.last.slice(8)} {data.label}
          </div>
        </CardContent>
      </Card>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <StatCard label="People in scope" value={data.employees} sub={`${data.rows.length} with records`} icon={Users} tone="primary" />
        <StatCard label="Absence rate" value={`${absencePct}%`} sub={`${t.absent} absent day${t.absent === 1 ? "" : "s"}`} icon={UserX} tone={absencePct > 10 ? "destructive" : "default"} />
        <StatCard label="Punctuality" value={`${punctuality}%`} sub={`${t.late} late arrival${t.late === 1 ? "" : "s"}`} icon={Clock} tone={t.late > 10 ? "warning" : "success"} />
        <StatCard
          label={data.payroll ? "Payroll net" : "Payroll"}
          value={data.payroll ? formatMoney(data.payroll.net) : "—"}
          sub={data.payroll ? `${titleCase(data.payroll.status)} · ${data.payroll.employees} payslips` : "No run for this month"}
          icon={Wallet}
        />
      </div>

      {/* leave pending banner */}
      {data.leaves.pendingRequests > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          <Plane className="h-4 w-4" />
          {data.leaves.pendingRequests} leave request{data.leaves.pendingRequests === 1 ? "" : "s"} still pending for this month — decide them in the Leaves inbox.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Work hours — top 12</CardTitle></CardHeader>
          <CardContent>
            {hoursChart.some((h) => h.hours > 0) ? (
              <BarChartCard data={hoursChart} xKey="name" series={[{ key: "hours", name: "Hours" }]} />
            ) : (
              <EmptyState icon={Clock} title="No attendance yet" description="Records appear once people start checking in this month." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-sm">Approved leave days by type</CardTitle></CardHeader>
          <CardContent>
            {leavePie.length ? (
              <PieChartCard data={leavePie} />
            ) : (
              <EmptyState icon={Plane} title="No approved leave this month" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* per-employee table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-primary" /> Per-employee attendance summary</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Code</th>
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Department</th>
                <th className="py-2 pr-3 text-center font-semibold">Present</th>
                <th className="py-2 pr-3 text-center font-semibold">Late</th>
                <th className="py-2 pr-3 text-center font-semibold">Half</th>
                <th className="py-2 pr-3 text-center font-semibold">Absent</th>
                <th className="py-2 pr-3 text-center font-semibold">Leave</th>
                <th className="py-2 pr-3 text-right font-semibold">Hours</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No employees in this scope.</td></tr>
              )}
              {data.rows.map((r) => (
                <tr key={r.employee_code} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="py-2 pr-3 font-mono text-xs">{r.employee_code}</td>
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.department}</td>
                  <td className="py-2 pr-3 text-center tabular-nums">{r.present}</td>
                  <td className={`py-2 pr-3 text-center tabular-nums ${r.late ? "text-warning font-semibold" : ""}`}>{r.late}</td>
                  <td className="py-2 pr-3 text-center tabular-nums">{r.half_day}</td>
                  <td className={`py-2 pr-3 text-center tabular-nums ${r.absent ? "text-destructive font-semibold" : ""}`}>{r.absent}</td>
                  <td className="py-2 pr-3 text-center tabular-nums">{r.on_leave}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.hours}</td>
                </tr>
              ))}
            </tbody>
            {data.rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 text-xs font-bold">
                  <td className="py-2 pr-3" colSpan={3}>Total</td>
                  <td className="py-2 pr-3 text-center tabular-nums">{t.present}</td>
                  <td className="py-2 pr-3 text-center tabular-nums">{t.late}</td>
                  <td className="py-2 pr-3 text-center tabular-nums">{t.half_day}</td>
                  <td className="py-2 pr-3 text-center tabular-nums">{t.absent}</td>
                  <td className="py-2 pr-3 text-center tabular-nums">{t.on_leave}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{t.hours}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>

      {data.payroll && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Payroll outcome — {data.label}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            {[
              { l: "Gross", v: formatMoney(data.payroll.gross) },
              { l: "Deductions", v: formatMoney(data.payroll.deductions) },
              { l: "Tax", v: formatMoney(data.payroll.tax) },
              { l: "Net paid", v: formatMoney(data.payroll.net) },
            ].map((x) => (
              <div key={x.l} className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">{x.l}</p>
                <p className="mt-0.5 font-bold tabular-nums">{x.v}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
