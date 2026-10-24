"use client";

import { useState } from "react";
import { UserPlus, KeyRound, UserX, UserCheck, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { useGetUsersQuery, useCreateUserMutation, useUserActionMutation } from "@/store/api";
import { formatDate } from "@/lib/utils";
import { confirmAction, sweetCreds } from "@/lib/alerts";

/** Admin: create HR/Admin logins, reset passwords, deactivate accounts. */
export function UsersManager() {
  const { data, isLoading, refetch } = useGetUsersQuery();
  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [userAction] = useUserActionMutation();
  const [open, setOpen] = useState(false);
  const [tempCred, setTempCred] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", role: "hr" });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await createUser(form).unwrap();
      setTempCred({ email: res.email, password: res.tempPassword });
      refetch();
    } catch {
      /* toast */
    }
  };

  const act = async (user, action) => {
    if (action === "deactivate") {
      const okToGo = await confirmAction({
        title: `Deactivate ${user.email}?`,
        html: "They will be signed out immediately and cannot sign in until reactivated.",
        danger: true,
      });
      if (!okToGo) return;
    }
    try {
      const res = await userAction({ id: user.id, action }).unwrap();
      if (action === "reset_password") {
        await sweetCreds({
          title: "Password reset ✅",
          html: `A designed reset email was queued for <b>${user.email}</b>.`,
          code: res.tempPassword,
        });
      } else {
        toast.success(`${user.email} ${action === "deactivate" ? "deactivated" : "activated"}`);
      }
      refetch();
    } catch {
      /* toast */
    }
  };

  return (
    <div>
      <PageHeader
        title="Users & logins"
        description="Create HR logins, reset passwords, deactivate accounts. Employees get logins when HR registers them."
        actions={
          <Button size="sm" onClick={() => { setTempCred(null); setOpen(true); }} className="gap-2">
            <UserPlus className="h-4 w-4" /> Create login
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : u.role === "hr" ? "info" : "muted"}>{u.role.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={u.is_active ? "success" : "destructive"}>{u.is_active ? "active" : "deactivated"}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{formatDate(u.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Reset password" onClick={() => act(u, "reset_password")}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {u.is_active ? (
                        <Button variant="ghost" size="icon" title="Deactivate" className="text-destructive" onClick={() => act(u, "deactivate")}>
                          <UserX className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" title="Reactivate" className="text-success" onClick={() => act(u, "activate")}>
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!tempCred) setOpen(o); }}>
        <DialogContent>
          {tempCred ? (
            <>
              <DialogHeader>
                <DialogTitle>Login ready ✅</DialogTitle>
                <DialogDescription>Share the temporary password securely — it must be changed on first sign-in.</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border bg-muted/50 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{tempCred.email}</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="rounded bg-background px-3 py-1.5 text-lg font-bold">{tempCred.password}</code>
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(tempCred.password); toast.success("Copied"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Shown only once.</p>
              </div>
              <DialogFooter>
                <Button onClick={() => { setOpen(false); setTempCred(null); }}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={submit}>
              <DialogHeader>
                <DialogTitle>Create HR / Admin login</DialogTitle>
                <DialogDescription>Employee logins are created automatically when HR registers them.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label>Full name *</Label>
                  <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Role *</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={creating} className="gap-2">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create login
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
