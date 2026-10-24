"use client";

import { useState } from "react";
import { Sparkles, Loader2, Send, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader, EmptyState } from "@/components/page-header";
import {
  useGetLeavesQuery, useGetBalanceQuery, useApplyLeaveMutation,
  useLeaveActionMutation, useAiSmartLeaveMutation,
} from "@/store/api";
import { formatDate, titleCase } from "@/lib/utils";
import { confirmAction, sweetSuccess } from "@/lib/alerts";

/** Employee self-service leave (M5): balances, smart-leave AI, apply, history. */
export function MyLeaves() {
  const { data: balance } = useGetBalanceQuery();
  const { data: leaves, isLoading } = useGetLeavesQuery();
  const [applyLeave, { isLoading: applying }] = useApplyLeaveMutation();
  const [leaveAction] = useLeaveActionMutation();
  const [smartLeave, { isLoading: parsing }] = useAiSmartLeaveMutation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "casual", start: "", end: "", reason: "" });
  const [smartText, setSmartText] = useState("");

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === "object" ? v?.target?.value : v }));

  const runSmart = async () => {
    if (!smartText.trim()) return;
    try {
      const res = await smartLeave({ text: smartText }).unwrap();
      if (res.ok) {
        setForm({ type: res.prefill.type, start: res.prefill.start, end: res.prefill.end, reason: res.prefill.reason });
        setOpen(true);
        toast.success("AI pre-filled your leave form — review & confirm");
      } else if (res.configured === false) {
        toast.info(res.message);
        setOpen(true);
      } else {
        toast.warning(res.message ?? "Could not parse — fill the form manually");
        setOpen(true);
      }
    } catch {
      /* toast */
    }
  };

  const submit = async (e) => {
    e?.preventDefault();
    try {
      const res = await applyLeave(form).unwrap();
      sweetSuccess(
        "Leave request submitted 🎯",
        `<b>${titleCase(form.type)}</b> · ${form.start} → ${form.end} · <b>${res.leave.days} working day(s)</b><br/>HR has been notified for approval.`
      );
      setOpen(false);
      setForm({ type: "casual", start: "", end: "", reason: "" });
      setSmartText("");
    } catch {
      /* 422/409 messages shown by toast */
    }
  };

  const cancel = async (l) => {
    const okToGo = await confirmAction({
      title: "Cancel this leave request?",
      html: `${titleCase(l.type)} · ${l.start} → ${l.end}`,
      danger: true,
    });
    if (!okToGo) return;
    try {
      await leaveAction({ id: l.id, action: "cancel" }).unwrap();
      sweetSuccess("Request cancelled");
    } catch {
      /* toast */
    }
  };

  return (
    <div>
      <PageHeader
        title="My leaves"
        description="Working days only — weekends and holidays are never deducted."
        actions={
          <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
            <Send className="h-4 w-4" /> Apply for leave
          </Button>
        }
      />

      {/* balances */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {["annual", "sick", "casual", "unpaid"].map((t) => {
          const b = balance?.balances?.[t];
          return (
            <div key={t} className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">{titleCase(t)} leave</p>
              {t === "unpaid" ? (
                <p className="mt-1 text-2xl font-bold">Unlimited</p>
              ) : (
                <p className="mt-1 text-2xl font-bold">
                  {b?.remaining ?? "—"}
                  <span className="text-sm font-normal text-muted-foreground"> / {b?.quota ?? "—"} left</span>
                </p>
              )}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                {t !== "unpaid" && b && (
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (b.used / Math.max(1, b.quota)) * 100)}%` }}
                  />
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{b?.used ?? 0} day(s) used this year</p>
            </div>
          );
        })}
      </div>

      {/* smart leave */}
      <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Smart leave — say it in plain words
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          “I need next Monday and Tuesday off for my sister's wedding” → AI fills the form; you confirm.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="e.g. Need next Monday and Tuesday off for a wedding"
            value={smartText}
            onChange={(e) => setSmartText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSmart()}
          />
          <Button onClick={runSmart} disabled={parsing || !smartText.trim()} className="gap-2 shrink-0">
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Parse with AI
          </Button>
        </div>
      </div>

      {/* history */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (leaves?.rows ?? []).length === 0 ? (
        <EmptyState title="No leave requests yet" description="Apply above or try the smart-leave box." />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead className="hidden md:table-cell">Reason</TableHead>
              <TableHead className="hidden lg:table-cell">HR comment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right" />
            </TableRow></TableHeader>
            <TableBody>
              {(leaves?.rows ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell><Badge variant="info">{titleCase(l.type)}</Badge></TableCell>
                  <TableCell className="text-sm">{formatDate(l.start_date)}{l.end_date !== l.start_date && <> → {formatDate(l.end_date)}</>}</TableCell>
                  <TableCell className="text-sm">{l.days}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-48"><p className="truncate text-xs text-muted-foreground">{l.reason}</p></TableCell>
                  <TableCell className="hidden lg:table-cell max-w-40"><p className="truncate text-xs text-muted-foreground">{l.decision_comment ?? "—"}</p></TableCell>
                  <TableCell><StatusBadge status={l.status} /></TableCell>
                  <TableCell className="text-right">
                    {l.status === "pending" && (
                      <Button variant="ghost" size="sm" onClick={() => cancel(l)} className="gap-1 text-destructive">
                        <Ban className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* apply dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Apply for leave</DialogTitle>
              <DialogDescription>Quota, overlap and working-day checks run on the server.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Leave type</Label>
                <Select value={form.type} onValueChange={set("type")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual ({balance?.balances?.annual?.remaining ?? "—"} left)</SelectItem>
                    <SelectItem value="sick">Sick ({balance?.balances?.sick?.remaining ?? "—"} left)</SelectItem>
                    <SelectItem value="casual">Casual ({balance?.balances?.casual?.remaining ?? "—"} left)</SelectItem>
                    <SelectItem value="unpaid">Unpaid (unlimited)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input required type="date" value={form.start} onChange={set("start")} />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input required type="date" value={form.end} onChange={set("end")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Textarea required rows={2} value={form.reason} onChange={set("reason")} placeholder="Family wedding, fever, …" />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={applying} className="gap-2">
                {applying && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
