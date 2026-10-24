"use client";

import { useState } from "react";
import { Mail, Eye, Inbox, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/page-header";
import { useGetEmailsQuery, hcmApi } from "@/store/api";
import { useDispatch } from "react-redux";

const KIND_LABEL = {
  loginCreated: "Welcome / login created",
  passwordReset: "Password reset",
  leaveDecision: "Leave decision",
  payslipReady: "Payslip ready",
  announcement: "Announcement",
};

const STATUS_VARIANT = { sent: "success", queued: "warning", failed: "destructive" };

/** Admin: designed-email outbox + template previews. */
export function EmailsOutbox() {
  const { data, isLoading } = useGetEmailsQuery();
  const [preview, setPreview] = useState(null); // {subject, html}
  const [template, setTemplate] = useState("loginCreated");
  const dispatch = useDispatch();

  const showPreview = async (row) => {
    setPreview({ subject: row.subject, html: row.html });
  };

  const renderTemplate = async () => {
    const res = await dispatch(
      hcmApi.endpoints.getEmails.initiate(`?preview=${template}`)
    );
    if (res?.data) setPreview({ subject: res.data.subject, html: res.data.html });
  };

  return (
    <div>
      <PageHeader
        title="System emails"
        description="Every email the app sends is designed, branded and stored here. Set RESEND_API_KEY to also deliver them for real."
        actions={
          <div className="flex items-center gap-2">
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={renderTemplate} className="gap-2">
              <Palette className="h-4 w-4" /> Preview template
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (data?.rows ?? []).length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No emails yet"
          description="Welcome emails, leave decisions, payslip notifications and announcements will appear here automatically."
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>When</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead className="hidden md:table-cell">Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right" />
            </TableRow></TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="text-sm">{e.to_email}</TableCell>
                  <TableCell><Badge variant="info">{KIND_LABEL[e.kind] ?? e.kind}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell max-w-64"><p className="truncate text-sm text-muted-foreground">{e.subject}</p></TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[e.status] ?? "muted"}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="View designed email" onClick={() => showPreview(e)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> {preview?.subject}
            </DialogTitle>
            <DialogDescription>Designed email preview (exactly what the recipient sees)</DialogDescription>
          </DialogHeader>
          <iframe
            title="email-preview"
            srcDoc={preview?.html}
            className="h-[520px] w-full rounded-xl border bg-white"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
