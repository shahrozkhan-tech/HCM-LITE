"use client";

import { Clock, AlertTriangle, Megaphone, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { CheckInWidget } from "@/components/check-in-widget";
import { HeroBanner } from "@/components/hero-banner";
import { UserRound } from "lucide-react";
import { useGetDashboardQuery, useGetMeQuery } from "@/store/api";
import { formatMoney, formatDate, titleCase } from "@/lib/utils";

export function EmployeeDashboard() {
  const { data: me } = useGetMeQuery();
  const { data, isLoading } = useGetDashboardQuery();

  if (isLoading || !data?.employee) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }

  const d = data.employee;

  return (
    <div className="space-y-6">
      <HeroBanner
        name={me?.profile?.full_name}
        roleLabel={me?.employee ? `${me.employee.employee_code} · ${me.employee.departments?.name ?? "Team"}` : "Employee"}
        icon={<UserRound className="h-6 w-6" />}
      >
        {d.todayStatus && (
          <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur text-center">
            <div className="text-[10px] uppercase tracking-wider text-white/80">today</div>
            <div className="text-sm font-extrabold leading-tight">{titleCase(d.todayStatus)}</div>
          </div>
        )}
        <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur text-center">
          <div className="text-xl font-extrabold leading-none">{d.hoursThisWeek}h</div>
          <div className="text-[10px] uppercase tracking-wider text-white/80">this week / 40h</div>
        </div>
      </HeroBanner>

      <div className="grid gap-4 lg:grid-cols-3 stagger">
        <div className="lg:col-span-1">
          <CheckInWidget />
        </div>

        <StatCard
          label="Hours this week"
          value={`${d.hoursThisWeek} h`}
          sub="target 40 h"
          icon={Clock}
          tone={d.hoursThisWeek >= 40 ? "success" : d.hoursThisWeek >= 30 ? "default" : "warning"}
        />
        <StatCard
          label="Late arrivals this month"
          value={d.lateThisMonth}
          icon={AlertTriangle}
          tone={d.lateThisMonth > 0 ? "warning" : "success"}
        />
      </div>

      {/* leave balances */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">My leave balance ({new Date().getFullYear()})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {["annual", "sick", "casual", "unpaid"].map((t) => {
              const b = d.balances?.[t];
              return (
                <div key={t} className="rounded-xl border p-4">
                  <p className="text-xs font-medium text-muted-foreground">{titleCase(t)}</p>
                  {t === "unpaid" ? (
                    <p className="mt-1 text-xl font-bold">Unlimited</p>
                  ) : (
                    <p className="mt-1 text-xl font-bold">
                      {b?.remaining ?? "—"}
                      <span className="text-sm font-normal text-muted-foreground"> / {b?.quota ?? "—"} left</span>
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t === "unpaid" ? `${b?.used ?? 0} days used` : `${b?.used ?? 0} used this year`}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* last payslip */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Download className="h-4 w-4 text-primary" /> Last payslip</CardTitle>
          </CardHeader>
          <CardContent>
            {d.lastPayslip ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Period</p>
                  <p className="font-medium">{formatDate(`${d.lastPayslip.period_year}-${String(d.lastPayslip.period_month).padStart(2, "0")}-01`)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="font-medium">{formatMoney(d.lastPayslip.gross)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net pay</p>
                  <p className="font-semibold text-success">{formatMoney(d.lastPayslip.net_pay)}</p>
                </div>
                <a
                  href={`/api/payroll/runs/${d.lastPayslip.run_id}/payslip-pdf`}
                  className="ml-auto text-primary underline text-sm"
                >
                  Download PDF
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No payslip yet — appears after HR runs payroll and Admin finalizes it.</p>
            )}
          </CardContent>
        </Card>

        {/* announcements */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Megaphone className="h-4 w-4 text-primary" /> Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(d.announcements ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            )}
            {(d.announcements ?? []).map((a) => (
              <div key={a.id} className="border-b pb-2 last:border-0 last:pb-0">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {a.author?.full_name ?? "Company"} · {formatDate(a.created_at)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
