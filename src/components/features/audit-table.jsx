"use client";

import { useState } from "react";
import { ScrollText, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/page-header";
import { useGetAuditQuery } from "@/store/api";
import { formatDate } from "@/lib/utils";

const ACTION_VARIANT = (a) =>
  a.startsWith("create") ? "success" :
  a.startsWith("delete") || a.includes("reject") || a.includes("deactivate") ? "destructive" :
  a.includes("finalize") ? "default" :
  a.includes("approve") ? "info" : "muted";

/** Admin-only audit log (M9): actor, action, entity, before/after JSON. */
export function AuditTable() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const { data, isLoading } = useGetAuditQuery({ page, entity: entity || undefined });
  const [detail, setDetail] = useState(null);

  const rows = data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / (data?.pageSize ?? 50)));

  return (
    <div>
      <PageHeader title="Audit log" description="Append-only trail of create, update, approve and finalize actions." />

      <div className="mb-3 flex items-center gap-2">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
          <option value="">All entities</option>
          <option value="employee">Employee</option>
          <option value="leave">Leave</option>
          <option value="attendance">Attendance</option>
          <option value="payroll_run">Payroll</option>
          <option value="user">User</option>
          <option value="organization_settings">Settings</option>
          <option value="announcement">Announcement</option>
          <option value="department">Department</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{data?.count ?? 0} entries</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries yet" description="Actions appear here as people use the system." />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead className="text-right" />
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{a.actor_name ?? "system"}</TableCell>
                  <TableCell><Badge variant={ACTION_VARIANT(a.action)}>{a.action}</Badge></TableCell>
                  <TableCell className="text-sm">{a.entity}{a.entity_id ? <span className="ml-1 font-mono text-[10px] text-muted-foreground">{a.entity_id.slice(0, 8)}</span> : null}</TableCell>
                  <TableCell className="text-right">
                    <button className="rounded-md border p-1.5 hover:bg-accent" title="Before/after" onClick={() => setDetail(a)}>
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <button className="rounded-md border px-2 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
          <span className="text-muted-foreground">{page} / {pages}</span>
          <button className="rounded-md border px-2 py-1 disabled:opacity-50" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
        </div>
      )}

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.action} · {detail?.entity}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <p className="mb-1 font-semibold text-muted-foreground">BEFORE</p>
              <pre className="max-h-48 overflow-auto scroll-thin rounded-lg bg-muted p-3 font-mono">{detail?.before ? JSON.stringify(detail.before, null, 2) : "—"}</pre>
            </div>
            <div>
              <p className="mb-1 font-semibold text-muted-foreground">AFTER</p>
              <pre className="max-h-48 overflow-auto scroll-thin rounded-lg bg-muted p-3 font-mono">{detail?.after ? JSON.stringify(detail.after, null, 2) : "—"}</pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
