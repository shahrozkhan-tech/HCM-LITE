"use client";

import { useState } from "react";
import { Megaphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/page-header";
import { useGetAnnouncementsQuery, usePostAnnouncementMutation } from "@/store/api";
import { formatDate } from "@/lib/utils";

/** Announcements (M9) — Admin/HR post; visible on every dashboard. */
export function AnnouncementsManager() {
  const { data, isLoading } = useGetAnnouncementsQuery();
  const [post, { isLoading: posting }] = usePostAnnouncementMutation();
  const [form, setForm] = useState({ title: "", body: "" });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await post(form).unwrap();
      toast.success("Announcement posted");
      setForm({ title: "", body: "" });
    } catch {
      /* toast */
    }
  };

  return (
    <div>
      <PageHeader title="Announcements" description="Posted to every role's dashboard and read by all employees." />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Team dinner on Friday" />
            </div>
            <div className="space-y-1.5">
              <Label>Message *</Label>
              <Textarea required rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <Button type="submit" disabled={posting} className="gap-2">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />} Post announcement
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : (data?.rows ?? []).length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" />
      ) : (
        <div className="space-y-3">
          {(data?.rows ?? []).map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{a.title}</p>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">— {a.author?.full_name ?? "Company"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
