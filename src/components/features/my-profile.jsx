"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useGetMeQuery, useUpdateProfileMutation } from "@/store/api";
import { formatDate, formatMoney } from "@/lib/utils";

/** Employee self-profile: view job details, edit only phone & address. */
export function MyProfile() {
  const { data } = useGetMeQuery();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const emp = data?.employee;
  useEffect(() => {
    if (emp) {
      setPhone(emp.phone ?? "");
      setAddress(emp.address ?? "");
    }
  }, [emp]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await updateProfile({ phone, address }).unwrap();
      toast.success("Profile updated");
    } catch {
      /* toast */
    }
  };

  return (
    <div>
      <PageHeader title="My profile" description="Job details are managed by HR — you can update your contact info." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCircle2 className="h-5 w-5 text-primary" />
              {emp ? `${emp.first_name} ${emp.last_name}` : data?.profile?.full_name}
            </CardTitle>
            <CardDescription>{data?.profile?.email}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <span className="text-muted-foreground">Employee code</span>
            <span className="font-mono">{emp?.employee_code ?? "—"}</span>
            <span className="text-muted-foreground">Department</span>
            <span>{emp?.departments?.name ?? "—"}</span>
            <span className="text-muted-foreground">Designation</span>
            <span>{emp?.designations?.name ?? "—"}</span>
            <span className="text-muted-foreground">Joined</span>
            <span>{emp ? formatDate(emp.join_date) : "—"}</span>
            <span className="text-muted-foreground">Status</span>
            <span><Badge variant="success">{emp?.status ?? "—"}</Badge></span>
            <span className="text-muted-foreground">Gross salary</span>
            <span className="font-medium">{emp ? formatMoney(emp.basic_salary * 1.5) : "—"}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact details</CardTitle>
            <CardDescription>Phone and address — the only fields you can edit.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <Button type="submit" disabled={isLoading} className="gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
