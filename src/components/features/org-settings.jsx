"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Trash2, Loader2, CalendarDays, Briefcase, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { useGetSettingsQuery, useUpdateSettingsMutation, useGetOrgQuery, useAddOrgEntityMutation, useDeleteOrgEntityMutation } from "@/store/api";
import { formatDate } from "@/lib/utils";
import { confirmAction } from "@/lib/alerts";

/** Admin organization setup (M2): rules, departments, designations, holidays. */
export function OrgSettings() {
  const { data: settingsData } = useGetSettingsQuery();
  const { data: org, refetch: refetchOrg } = useGetOrgQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateSettingsMutation();
  const [addEntity] = useAddOrgEntityMutation();
  const [deleteEntity] = useDeleteOrgEntityMutation();

  const [form, setForm] = useState(null);
  useEffect(() => {
    if (settingsData?.settings && !form) setForm(settingsData.settings);
  }, [settingsData]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    try {
      await updateSettings({
        company_name: form.company_name,
        timezone: form.timezone,
        office_start: form.office_start,
        grace_minutes: Number(form.grace_minutes),
        half_day_hours: Number(form.half_day_hours),
        office_lat: form.office_lat === "" || form.office_lat == null ? null : Number(form.office_lat),
        office_lng: form.office_lng === "" || form.office_lng == null ? null : Number(form.office_lng),
        geofence_radius: Number(form.geofence_radius),
        annual_quota: Number(form.annual_quota),
        sick_quota: Number(form.sick_quota),
        casual_quota: Number(form.casual_quota),
      }).unwrap();
      toast.success("Settings saved — new rules apply to NEW records only");
    } catch {
      /* toast */
    }
  };

  const add = async (entity, payload) => {
    try {
      await addEntity({ entity, ...payload }).unwrap();
      toast.success("Added");
      refetchOrg();
      return true;
    } catch {
      return false;
    }
  };

  const remove = async (entity, id, name) => {
    const okToGo = await confirmAction({
      title: `Delete "${name}"?`,
      html: "Employees linked to it will become unassigned.",
      danger: true,
    });
    if (!okToGo) return;
    try {
      await deleteEntity({ entity, id }).unwrap();
      refetchOrg();
    } catch {
      /* toast */
    }
  };

  if (!form) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading settings…</div>;
  }

  return (
    <div>
      <PageHeader title="Organization" description="Company profile, work rules, org structure and holidays." />
      <Tabs defaultValue="rules">
        <TabsList className="flex-wrap">
          <TabsTrigger value="rules" className="gap-1.5"><Building2 className="h-4 w-4" /> Company & rules</TabsTrigger>
          <TabsTrigger value="departments" className="gap-1.5"><Briefcase className="h-4 w-4" /> Departments</TabsTrigger>
          <TabsTrigger value="designations">Designations</TabsTrigger>
          <TabsTrigger value="holidays" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Holidays</TabsTrigger>
        </TabsList>

        {/* rules */}
        <TabsContent value="rules">
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Company name</Label>
                <Input value={form.company_name} onChange={set("company_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Input value={form.timezone} onChange={set("timezone")} placeholder="Asia/Karachi" />
              </div>
              <div className="space-y-1.5">
                <Label>Office start (late after start + grace)</Label>
                <Input type="time" value={form.office_start} onChange={set("office_start")} />
              </div>
              <div className="space-y-1.5">
                <Label>Grace minutes</Label>
                <Input type="number" min={0} max={180} value={form.grace_minutes} onChange={set("grace_minutes")} />
              </div>
              <div className="space-y-1.5">
                <Label>Half-day threshold (hours)</Label>
                <Input type="number" min={1} max={12} step="0.5" value={form.half_day_hours} onChange={set("half_day_hours")} />
              </div>
              <div className="space-y-1.5">
                <Label>Geofence radius (m)</Label>
                <Input type="number" min={30} max={5000} value={form.geofence_radius} onChange={set("geofence_radius")} />
              </div>
              <div className="space-y-1.5">
                <Label>Office latitude</Label>
                <Input value={form.office_lat ?? ""} onChange={set("office_lat")} placeholder="24.8607" />
              </div>
              <div className="space-y-1.5">
                <Label>Office longitude</Label>
                <Input value={form.office_lng ?? ""} onChange={set("office_lng")} placeholder="67.0011" />
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="mb-2 text-sm font-semibold">Yearly leave quotas</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Annual</Label>
                  <Input type="number" min={0} value={form.annual_quota} onChange={set("annual_quota")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sick</Label>
                  <Input type="number" min={0} value={form.sick_quota} onChange={set("sick_quota")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Casual</Label>
                  <Input type="number" min={0} value={form.casual_quota} onChange={set("casual_quota")} />
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Unpaid leave is unlimited. Weekend: Saturday–Sunday.</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* departments */}
        <TabsContent value="departments">
          <SimpleListManager
            title="Department"
            items={org?.departments ?? []}
            onAdd={(name) => add("department", { name })}
            onDelete={(item) => remove("department", item.id, item.name)}
          />
        </TabsContent>

        <TabsContent value="designations">
          <SimpleListManager
            title="Designation"
            items={org?.designations ?? []}
            onAdd={(name) => add("designation", { name })}
            onDelete={(item) => remove("designation", item.id, item.name)}
          />
        </TabsContent>

        {/* holidays */}
        <TabsContent value="holidays">
          <HolidayManager
            items={org?.holidays ?? []}
            onAdd={(date, name) => add("holiday", { date, name })}
            onDelete={(item) => remove("holiday", item.id, item.name)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SimpleListManager({ title, items, onAdd, onDelete }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="max-w-xl">
      <div className="mb-4 flex gap-2">
        <Input placeholder={`New ${title.toLowerCase()} name`} value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          className="gap-2 shrink-0"
          disabled={!name.trim() || busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onAdd(name.trim());
            if (ok) setName("");
            setBusy(false);
          }}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="flex items-center rounded-lg border bg-card px-3 py-2">
            <span className="text-sm font-medium">{item.name}</span>
            <Button variant="ghost" size="icon" className="ml-auto text-destructive" onClick={() => onDelete(item)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function HolidayManager({ items, onAdd, onDelete }) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="max-w-xl">
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input placeholder="Holiday name (e.g. Eid ul Fitr)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          className="gap-2 shrink-0"
          disabled={!date || !name.trim() || busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onAdd(date, name.trim());
            if (ok) { setDate(""); setName(""); }
            setBusy(false);
          }}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Name</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>
            {items.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="text-sm">{formatDate(h.date)}</TableCell>
                <TableCell className="text-sm font-medium">{h.name}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(h)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={3} className="py-4 text-center text-sm text-muted-foreground">No public holidays yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
