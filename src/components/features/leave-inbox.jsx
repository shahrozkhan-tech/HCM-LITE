"use client";

import { useState } from "react";
import { Check, X, Loader2, Inbox, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader, EmptyState } from "@/components/page-header";
import { useGetLeavesQuery, useLeaveActionMutation } from "@/store/api";
import { formatDate, titleCase } from "@/lib/utils";

/**
 * Leave management (M5) — staff. `canDecide` = HR (Admin views only).
 * Inbox = pending requests; History = all with filters.
 */
export function LeaveInbox({ canDecide = false }) {
  const [tab, setTab] = useState("inbox");
  const [statusFilter, setStatusFilter] = useState("");
  const { data: inbox, isLoading: inboxLoading } = useGetLeavesQuery({ inbox: 1 });
  const { data: all, isLoading: allLoading } = useGetLeavesQuery(
    statusFilter ? { status: statusFilter } : undefined
  );
  const [leaveAction, { isLoading }] = useLeaveActionMutation();
  const [decideFor, setDecideFor] = useState(null); // {leave, approve}
  const [comment, setComment] = useState("");

  const decide = async () => {
    try {
      await leaveAction({ id: decideFor.leave.id, action: decideFor.approve ? "approve" : "reject", comment }).unwrap();
      toast.success(`Leave ${decideFor.approve ? "approved" : "rejected"} — employee notified`);
      setDecideFor(null);
      setComment("");
    } catch {
      /* toast */
    }
  };

  const LeaveRow = ({ l, pending }) => (
    <TableRow>
      <TableCell>
        <div className="font-medium">{l.employees.first_name} {l.employees.last_name}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{l.employees.employee_code}</div>
      </TableCell>
      <TableCell className="hidden sm:table-cell text-sm">{l.employees.departments?.name ?? "—"}</TableCell>
      <TableCell><Badge variant="info">{titleCase(l.type)}</Badge></TableCell>
      <TableCell className="text-sm">
        {formatDate(l.start_date)}
        {l.end_date !== l.start_date && <> → {formatDate(l.end_date)}</>}
        <div className="text-xs text-muted-foreground">{l.days} working day(s)</div>
      </TableCell>
      <TableCell className="hidden md:table-cell max-w-52">
        <p className="truncate text-xs text-muted-foreground" title={l.reason}>{l.reason}</p>
      </TableCell>
      <TableCell><StatusBadge status={l.status} /></TableCell>
      <TableCell className="text-right">
        {pending && canDecide ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="success" onClick={() => setDecideFor({ leave: l, approve: true })} className="gap-1">
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDecideFor({ leave: l, approve: false })} className="gap-1">
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        ) : (
          l.decision_comment && (
            <span className="text-xs text-muted-foreground" title={l.decision_comment}>
              <MessageSquare className="mr-1 inline h-3 w-3" />
              {l.decision_comment.slice(0, 20)}
            </span>
          )
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <div>
      <PageHeader
        title="Leave management"
        description={canDecide ? "Approve or reject requests with a comment. Quotas & overlaps are already validated." : "Company leave overview (read-only)."}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5">
            <Inbox className="h-4 w-4" /> Inbox
            {(inbox?.rows ?? []).length > 0 && (
              <span className="ml-1 rounded-full bg-warning px-1.5 text-[10px] font-bold text-warning-foreground">{inbox.rows.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          {inboxLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (inbox?.rows ?? []).length === 0 ? (
            <EmptyState icon={Inbox} title="Inbox zero 🎉" description="No pending leave requests." />
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="hidden sm:table-cell">Dept</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{canDecide ? "Decision" : ""}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(inbox?.rows ?? []).map((l) => <LeaveRow key={l.id} l={l} pending />)}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <div className="mb-3 flex items-center gap-2">
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {allLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (all?.rows ?? []).length === 0 ? (
            <EmptyState title="No leave records" />
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="hidden sm:table-cell">Dept</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {(all?.rows ?? []).map((l) => <LeaveRow key={l.id} l={l} pending={false} />)}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(decideFor)} onOpenChange={(o) => !o && setDecideFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decideFor?.approve ? "Approve" : "Reject"} leave — {decideFor?.leave?.employees?.first_name} {decideFor?.leave?.employees?.last_name}</DialogTitle>
            <DialogDescription>
              {decideFor?.leave && (
                <>
                  {titleCase(decideFor.leave.type)} · {formatDate(decideFor.leave.start_date)} → {formatDate(decideFor.leave.end_date)} ({decideFor.leave.days} working days)
                  <br />Reason: “{decideFor.leave.reason}”
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={2} placeholder="Comment (optional, shared with the employee)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecideFor(null)}>Cancel</Button>
            <Button
              variant={decideFor?.approve ? "success" : "destructive"}
              onClick={decide}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm {decideFor?.approve ? "approval" : "rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
