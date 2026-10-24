"use client";

import { useState } from "react";
import { Wrench, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/page-header";
import { useGetMyAttendanceQuery, useRequestCorrectionMutation } from "@/store/api";
import { formatDate, titleCase, cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_HEADINGS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS = {
  present: "bg-success/15 text-success border-success/40",
  late: "bg-warning/15 text-warning border-warning/40",
  half_day: "bg-orange-500/15 text-orange-600 border-orange-500/40",
  absent: "bg-destructive/15 text-destructive border-destructive/40",
  missing_checkout: "bg-muted text-muted-foreground border-border",
  on_leave: "bg-primary/10 text-primary border-primary/30",
};

/** Employee's own attendance calendar (M4) + correction requests. */
export function AttendanceCalendar() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data, isLoading } = useGetMyAttendanceQuery({ month, year });
  const [requestCorrection, { isLoading: requesting }] = useRequestCorrectionMutation();
  const [corrFor, setCorrFor] = useState(null);
  const [reason, setReason] = useState("");

  const shift = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };

  const byDate = new Map((data?.rows ?? []).map((r) => [r.date, r]));

  // calendar grid
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const submitCorrection = async () => {
    try {
      await requestCorrection({ date: corrFor, reason }).unwrap();
      toast.success("Correction request sent to HR");
      setCorrFor(null);
      setReason("");
    } catch {
      /* toast */
    }
  };

  return (
    <div>
      <PageHeader title="My attendance" description="Your daily records with the same rules HR sees." />

      <div className="mb-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Present" value={data?.counts?.present ?? 0} tone="success" />
        <StatCard label="Late" value={data?.counts?.late ?? 0} tone="warning" />
        <StatCard label="Half days" value={data?.counts?.half_day ?? 0} tone="warning" />
        <StatCard label="Absent" value={data?.counts?.absent ?? 0} tone="destructive" />
        <StatCard label="No checkout" value={data?.counts?.missing_checkout ?? 0} />
        <StatCard label="On leave" value={data?.counts?.on_leave ?? 0} tone="primary" />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="w-36 text-center text-sm font-semibold">{MONTHS[month - 1]} {year}</span>
        <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
        <div className="ml-auto flex flex-wrap gap-1.5 text-[10px]">
          {Object.entries(STATUS_COLORS).map(([k, cls]) => (
            <span key={k} className={cn("rounded border px-1.5 py-0.5", cls)}>{titleCase(k)}</span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_HEADINGS.map((d) => (
            <div key={d} className="pb-1 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
          ))}
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={`e${i}`} />;
            const rec = byDate.get(dateStr);
            const isFuture = dateStr > (data?.today ?? "9999");
            const weekend = [0, 6].includes(new Date(dateStr + "T12:00:00").getDay());
            return (
              <button
                key={dateStr}
                disabled={!rec || isFuture}
                onClick={() => setCorrFor(dateStr)}
                title={rec ? `${titleCase(rec.status)}${rec.work_hours ? ` · ${rec.work_hours}h` : ""} — click to request correction` : ""}
                className={cn(
                  "aspect-square rounded-lg border p-1.5 text-left transition-all",
                  !rec && (weekend ? "bg-muted/30 border-dashed" : "bg-card"),
                  !rec && "opacity-60",
                  rec && STATUS_COLORS[rec.status],
                  rec && !isFuture && "hover:ring-2 hover:ring-primary/50 cursor-pointer"
                )}
              >
                <div className="text-[11px] font-semibold leading-none">{Number(dateStr.slice(8))}</div>
                {rec && (
                  <div className="mt-1 text-[9px] leading-tight font-medium">
                    {titleCase(rec.status === "missing_checkout" ? "no out" : rec.status)}
                    {rec.check_in && <div className="opacity-75">{rec.check_in.slice(11, 16)}</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Click any past day to request a correction (goes to HR for approval).
      </p>

      <Dialog open={Boolean(corrFor)} onOpenChange={(o) => !o && setCorrFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request correction — {corrFor && formatDate(corrFor)}</DialogTitle>
            <DialogDescription>
              Current status: {corrFor ? <StatusBadge status={byDate.get(corrFor)?.status} /> : null}. Explain what should be corrected; HR will review it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason *</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. I forgot to check out — left at 6 pm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrFor(null)}>Cancel</Button>
            <Button onClick={submitCorrection} disabled={requesting || !reason.trim()} className="gap-2">
              {requesting && <Loader2 className="h-4 w-4 animate-spin" />} <Wrench className="h-4 w-4" /> Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
