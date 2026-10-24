"use client";

import { useState } from "react";
import { Loader2, Lock, RefreshCw, Trash2, Download, Wallet, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { PageHeader, EmptyState } from "@/components/page-header";
import {
  useGetRunsQuery, useGetRunQuery, useCreateRunMutation,
  useFinalizeRunMutation, useDeleteRunMutation,
} from "@/store/api";
import { formatMoney } from "@/lib/utils";
import { monthName } from "@/lib/dates";
import { confirmAction, sweetSuccess } from "@/lib/alerts";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Payroll Lite (M6) — staff. `canFinalize` = Admin only (locks the month).
 * HR builds/reviews drafts; finalized runs are read-only.
 */
export function PayrollView({ canFinalize = false }) {
  const { data: runsData, isLoading } = useGetRunsQuery();
  const [selected, setSelected] = useState(null);
  const { data: runData, isLoading: runLoading, refetch: refetchRun } = useGetRunQuery(selected, { skip: !selected });

  const [createRun, { isLoading: creating }] = useCreateRunMutation();
  const [finalizeRun, { isLoading: finalizing }] = useFinalizeRunMutation();
  const [deleteRun] = useDeleteRunMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() === 0 ? 12 : now.getMonth()));
  const [year, setYear] = useState(String(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()));

  const runs = runsData?.runs ?? [];

  const create = async () => {
    try {
      const res = await createRun({ month: Number(month), year: Number(year) }).unwrap();
      toast.success(`Draft built for ${monthName(Number(month))} ${year} — ${res.totals.count} payslip(s)`);
      setCreateOpen(false);
      setSelected(res.runId);
    } catch {
      /* 409 finalized etc. */
    }
  };

  const finalize = async (run) => {
    const okToGo = await confirmAction({
      title: `Finalize ${monthName(run.period_month)} ${run.period_year}?`,
      html: "The month <b>locks permanently</b> — payslips become downloadable and no further edits are possible.",
      confirmText: "🔒 Finalize month",
      icon: "warning",
    });
    if (!okToGo) return;
    try {
      await finalizeRun(run.id).unwrap();
      sweetSuccess("Payroll finalized 🔒", "Payslips unlocked — employees have been notified.");
      refetchRun();
    } catch {
      /* toast */
    }
  };

  const remove = async (run) => {
    const okToGo = await confirmAction({
      title: `Delete draft for ${monthName(run.period_month)} ${run.period_year}?`,
      html: "This removes the draft run and all its payslips.",
      danger: true,
    });
    if (!okToGo) return;
    try {
      await deleteRun(run.id).unwrap();
      if (selected === run.id) setSelected(null);
      sweetSuccess("Draft deleted");
    } catch {
      /* toast */
    }
  };

  const current = runData?.run;
  const slips = runData?.payslips ?? [];
  const totals = runData?.totals;

  return (
    <div>
      <PageHeader
        title="Payroll Lite"
        description="Gross = 1.5 × basic (HRA 40% + medical 10%). Deductions: absent + unpaid + 0.5 × half days. Tax slab on gross × 12."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Build / refresh draft
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* runs list */}
        <div className="space-y-2">
          {isLoading && [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          {!isLoading && runs.length === 0 && (
            <EmptyState icon={Wallet} title="No payroll runs" description="Build the monthly draft to get started." />
          )}
          {runs.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id)}
              className={`w-full rounded-xl border p-3 text-left transition-all ${
                selected === r.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-accent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{monthName(r.period_month)} {r.period_year}</span>
                <Badge variant={r.status === "finalized" ? "success" : "muted"}>{r.status}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.totals?.count ?? 0} payslips · net {formatMoney(r.totals?.net ?? 0)}
              </p>
            </button>
          ))}
        </div>

        {/* run detail */}
        <div>
          {!selected ? (
            <EmptyState icon={Wallet} title="Select a run" description="Pick a month on the left to review its payslips." />
          ) : runLoading || !current ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <StatCard label="Employees" value={totals.count} />
                <StatCard label="Gross" value={formatMoney(totals.gross)} />
                <StatCard label="Deductions + tax" value={formatMoney(totals.deductions + totals.tax)} tone="warning" />
                <StatCard label="Net pay" value={formatMoney(totals.net)} tone="success" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={current.status === "finalized" ? "success" : "warning"}>
                  {current.status === "finalized" ? "🔒 finalized — locked" : "draft"}
                </Badge>
                {current.status === "draft" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => refetchRun()} className="gap-2">
                      <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                    {canFinalize ? (
                      <Button size="sm" onClick={() => finalize(current)} disabled={finalizing} className="gap-2">
                        {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Finalize month
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Only Admin can finalize.</span>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(current)} className="gap-2 text-destructive">
                      <Trash2 className="h-4 w-4" /> Delete draft
                    </Button>
                  </>
                )}
              </div>

              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="hidden sm:table-cell">Dept</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Gross</TableHead>
                    <TableHead className="hidden md:table-cell text-center">A/U/H/L</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Deduct</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Tax</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead />
                  </TableRow></TableHeader>
                  <TableBody>
                    {slips.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{p.employees.first_name} {p.employees.last_name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{p.employees.employee_code}{p.prorated ? " · prorated" : ""}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{p.employees.departments?.name ?? "—"}</TableCell>
                        <TableCell className="text-right text-sm">{formatMoney(p.basic)}</TableCell>
                        <TableCell className="hidden md:table-cell text-right text-sm">{formatMoney(p.gross)}</TableCell>
                        <TableCell className="hidden md:table-cell text-center text-sm font-mono text-xs">
                          {p.absent_days}/{p.unpaid_days}/{p.half_days}/{p.late_days ?? 0}
                          {(p.late_penalty_days ?? 0) > 0 && (
                            <span className="ml-1 text-warning" title={`late penalty −${p.late_penalty_days} day`}>−{p.late_penalty_days}d</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right text-sm text-destructive">-{formatMoney(p.deduction)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right text-sm text-destructive">-{formatMoney(p.tax)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-success">{formatMoney(p.net_pay)}</TableCell>
                        <TableCell>
                          <a
                            href={`/api/payroll/runs/${current.id}/payslip-pdf?employee_id=${p.employee_id}`}
                            title="Download payslip PDF"
                            className="inline-flex rounded-md border p-1.5 hover:bg-accent"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                    {slips.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">No payslips — register employees first.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Build monthly draft</DialogTitle>
            <DialogDescription>
              Recomputes every payslip from live attendance + leaves. Finalized months are locked (409).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Month</span>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{monthName(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Year</span>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() + 1].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Build draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
