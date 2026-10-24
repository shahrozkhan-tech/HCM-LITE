"use client";

import { useState } from "react";
import { CalendarDays, Check, X, Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { PageHeader, EmptyState } from "@/components/page-header";
import { useGetBoardQuery, useGetCorrectionsQuery, useDecideCorrectionMutation, useGetOrgQuery } from "@/store/api";
import { formatTime, formatDate } from "@/lib/utils";

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Daily attendance board (M4) — staff. HR also gets the corrections inbox.
 * `canApprove` = HR (checklist #11: Admin views, HR approves).
 */
export function AttendanceBoard({ canApprove = false }) {
  const [date, setDate] = useState(todayISO());
  const [dept, setDept] = useState("");
  const { data: org } = useGetOrgQuery();
  const { data, isLoading } = useGetBoardQuery({ date, department_id: dept || undefined });
  const { data: corrections, isLoading: corrLoading } = useGetCorrectionsQuery(undefined, { skip: !canApprove });
  const [decide, { isLoading: deciding }] = useDecideCorrectionMutation();
  const [decidingId, setDecidingId] = useState(null);

  const rows = data?.rows ?? [];
  const c = data?.counts ?? {};

  const onDecide = async (row, approved) => {
    setDecidingId(row.id);
    try {
      await decide({ id: row.id, approved, note: approved ? "HR approved correction" : "" }).unwrap();
      toast.success(`Correction ${approved ? "approved" : "rejected"}`);
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Server-stamped daily board. Absents and missing check-outs are computed from the rules automatically."
      />

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Daily board</TabsTrigger>
          {canApprove && (
            <TabsTrigger value="corrections" className="gap-1.5">
              <Wrench className="h-4 w-4" /> Corrections
              {(corrections?.rows ?? []).length > 0 && (
                <span className="ml-1 rounded-full bg-warning px-1.5 text-[10px] font-bold text-warning-foreground">
                  {corrections.rows.length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="board">
          <div className="mb-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Present" value={c.present ?? 0} tone="success" />
            <StatCard label="Late" value={c.late ?? 0} tone="warning" />
            <StatCard label="Half day" value={c.half_day ?? 0} tone="warning" />
            <StatCard label="Absent" value={c.absent ?? 0} tone="destructive" />
            <StatCard label="No checkout" value={c.missing_checkout ?? 0} />
            <StatCard label="On leave" value={c.on_leave ?? 0} />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="h-9 w-44 rounded-md border bg-background px-3 text-sm"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {(org?.departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {data && (
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDate(date)} {data.isToday && "· today"}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState title="No records for this day" description="Register employees first — records appear once they check in or rules materialize them." />
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="hidden sm:table-cell">Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead className="hidden sm:table-cell">Out</TableHead>
                    <TableHead className="hidden lg:table-cell">Hours</TableHead>
                    <TableHead className="hidden lg:table-cell">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.employees.first_name} {r.employees.last_name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{r.employees.employee_code}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{r.employees.departments?.name ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-sm">{formatTime(r.check_in)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{formatTime(r.check_out)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{r.work_hours ?? "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {r.source === "camera" ? <span title="camera + geofence">📷</span> : r.check_in ? "web" : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {canApprove && (
          <TabsContent value="corrections">
            {corrLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : (corrections?.rows ?? []).length === 0 ? (
              <EmptyState icon={Wrench} title="No pending corrections" description="Employee correction requests appear here for approval." />
            ) : (
              <div className="space-y-3">
                {(corrections?.rows ?? []).map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">
                        {r.employees.first_name} {r.employees.last_name}
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">{r.employees.employee_code}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.date)} · was <StatusBadge status={r.status} /> · reason: {r.correction_reason}
                      </p>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="success" disabled={deciding && decidingId === r.id} onClick={() => onDecide(r, true)} className="gap-1.5">
                        {deciding && decidingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve → present
                      </Button>
                      <Button size="sm" variant="destructive" disabled={deciding && decidingId === r.id} onClick={() => onDecide(r, false)} className="gap-1.5">
                        <X className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
