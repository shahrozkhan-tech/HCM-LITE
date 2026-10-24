"use client";

import { useState } from "react";
import {
  Plus, Search, Loader2, Copy, FileUp, FileDown, Eye, Pencil, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader, EmptyState } from "@/components/page-header";
import {
  useGetEmployeesQuery, useGetEmployeeQuery, useCreateEmployeeMutation,
  useUpdateEmployeeMutation, useGetOrgQuery, useImportEmployeesMutation,
} from "@/store/api";
import { formatMoney, formatDate, titleCase } from "@/lib/utils";

const EMPTY_FORM = {
  first_name: "", last_name: "", email: "", employee_code: "",
  department_id: "", designation_id: "", join_date: "", basic_salary: "",
  gender: "", phone: "", address: "", status: "active",
};

/**
 * Employee directory (M3) shared by HR (manage) and Admin (view).
 * canManage: register/edit/CSV import (HR) — Admin sees everything read-only.
 */
export function EmployeesDirectory({ canManage = false }) {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data: org } = useGetOrgQuery();
  const { data, isLoading } = useGetEmployeesQuery({
    q: q || undefined,
    department_id: dept || undefined,
    status: status || undefined,
    page,
    pageSize: 12,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [view360, setView360] = useState(null);
  const [csvOpen, setCsvOpen] = useState(false);

  const rows = data?.rows ?? [];
  const count = data?.count ?? 0;
  const pageSize = data?.pageSize ?? 12;
  const pages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div>
      <PageHeader
        title="Employees"
        description={canManage ? "Register employees, set salary, import/export CSV." : "Company directory (read-only)."}
        actions={
          canManage ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)} className="gap-2">
                <FileUp className="h-4 w-4" /> CSV import
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a href="/api/employees/export"><FileDown className="h-4 w-4" /> Export</a>
              </Button>
              <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Register employee
              </Button>
            </>
          ) : undefined
        }
      />

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, code, email…"
            className="pl-8"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }}>
          <option value="">All departments</option>
          {(org?.departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="probation">Probation</option>
          <option value="exited">Exited</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{count} employee(s)</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={canManage ? "No employees yet" : "Directory is empty"}
          description={canManage ? "Register your first employee — their login is created automatically with a temporary password." : "HR has not registered employees yet."}
          action={canManage && <Button size="sm" onClick={() => setFormOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Register employee</Button>}
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.employee_code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{e.first_name} {e.last_name}</div>
                    <div className="text-xs text-muted-foreground">{e.email}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{e.departments?.name ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{formatDate(e.join_date)}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Employee 360" onClick={() => setView360(e.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManage && (
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(e); setFormOpen(true); }}>
                          <Pencil className="h-4 w-4" />
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

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        org={org}
      />
      <Employee360 open={Boolean(view360)} onOpenChange={(o) => !o && setView360(null)} id={view360} />
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} />
    </div>
  );
}

/* ── register / edit form ─────────────────────────────────────────────── */

function EmployeeForm({ open, onOpenChange, editing, org }) {
  const isEdit = Boolean(editing);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tempPassword, setTempPassword] = useState("");
  const [createEmp, { isLoading }] = useCreateEmployeeMutation();
  const [updateEmp] = useUpdateEmployeeMutation();
  const [initialized, setInitialized] = useState(null);

  // sync form when opening
  if (open && initialized !== (editing?.id ?? "new")) {
    setInitialized(editing?.id ?? "new");
    setTempPassword("");
    setForm(
      isEdit
        ? {
            first_name: editing.first_name ?? "", last_name: editing.last_name ?? "",
            email: editing.email ?? "", employee_code: editing.employee_code ?? "",
            department_id: editing.department_id ?? "", designation_id: editing.designation_id ?? "",
            join_date: editing.join_date ?? "", basic_salary: editing.basic_salary ?? "",
            gender: editing.gender ?? "", phone: editing.phone ?? "", address: editing.address ?? "",
            status: editing.status ?? "active",
          }
        : EMPTY_FORM
    );
  }
  if (!open && initialized !== null) setInitialized(null);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === "object" ? v?.target?.value : v }));

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      department_id: form.department_id || null,
      designation_id: form.designation_id || null,
      basic_salary: Number(form.basic_salary),
      employee_code: form.employee_code || undefined,
      gender: form.gender || null,
      exit_date: form.status === "exited" && !isEdit ? new Date().toISOString().slice(0, 10) : undefined,
    };
    try {
      if (isEdit) {
        await updateEmp({ id: editing.id, ...payload }).unwrap();
        toast.success("Employee updated");
      } else {
        const res = await createEmp(payload).unwrap();
        setTempPassword(res.tempPassword);
        toast.success(`${res.employee.first_name} registered — login created`);
        return; // keep dialog open to show the temp password
      }
      onOpenChange(false);
    } catch {
      /* toast shown */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!tempPassword) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        {tempPassword ? (
          <>
            <DialogHeader>
              <DialogTitle>Employee registered ✅</DialogTitle>
              <DialogDescription>
                Their login was created with a temporary password. Share it securely — they must change it on first sign-in.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Temporary password for {form.email}</p>
              <div className="flex items-center justify-center gap-2">
                <code className="rounded bg-background px-3 py-1.5 text-lg font-bold tracking-wide">{tempPassword}</code>
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success("Copied"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Shown only once.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{isEdit ? `Edit ${editing?.first_name}` : "Register employee"}</DialogTitle>
              <DialogDescription>
                {isEdit ? "Update job details or salary structure." : "A login with a temporary password is created automatically."}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name *</Label>
                <Input required value={form.first_name} onChange={set("first_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input value={form.last_name} onChange={set("last_name")} />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" required disabled={isEdit} value={form.email} onChange={set("email")} />
              </div>
              <div className="space-y-1.5">
                <Label>Employee code</Label>
                <Input placeholder="auto (EMP-001)" value={form.employee_code} onChange={set("employee_code")} />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={form.department_id} onValueChange={set("department_id")}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {(org?.departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Designation</Label>
                <Select value={form.designation_id} onValueChange={set("designation_id")}>
                  <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                  <SelectContent>
                    {(org?.designations ?? [])
                      .filter((d) => !form.department_id || !d.department_id || d.department_id === form.department_id)
                      .map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Join date * (YYYY-MM-DD)</Label>
                <Input required type="date" value={form.join_date} onChange={set("join_date")} />
              </div>
              <div className="space-y-1.5">
                <Label>Basic salary *</Label>
                <Input required type="number" min={1} step="any" value={form.basic_salary} onChange={set("basic_salary")} />
                <p className="text-[10px] text-muted-foreground">Gross = 1.5 × basic (HRA 40%, medical 10%)</p>
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={set("gender")}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={set("status")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="probation">Probation</SelectItem>
                    <SelectItem value="exited">Exited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={set("phone")} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Textarea rows={2} value={form.address} onChange={set("address")} />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isLoading} className="gap-2">
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? "Save changes" : "Register & create login"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Employee 360 ─────────────────────────────────────────────────────── */

function Employee360({ open, onOpenChange, id }) {
  const { data, isLoading } = useGetEmployeeQuery(id, { skip: !id });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Employee 360</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start gap-4">
              <div>
                <p className="text-lg font-bold">{data.employee.first_name} {data.employee.last_name}</p>
                <p className="text-sm text-muted-foreground">{data.employee.employee_code} · {data.employee.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <StatusBadge status={data.employee.status} />
                  <Badge variant="muted">{data.employee.departments?.name ?? "No department"}</Badge>
                  <Badge variant="muted">{data.employee.designations?.name ?? "No designation"}</Badge>
                </div>
              </div>
              <div className="ml-auto grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <span className="text-muted-foreground">Joined</span><span>{formatDate(data.employee.join_date)}</span>
                <span className="text-muted-foreground">Basic</span><span>{formatMoney(data.employee.basic_salary)}</span>
                <span className="text-muted-foreground">Gross (1.5×)</span><span className="font-medium">{formatMoney(data.employee.basic_salary * 1.5)}</span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Leave balance</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {Object.entries(data.balances ?? {}).map(([k, b]) => (
                  <div key={k} className="rounded-lg border p-2.5">
                    <p className="text-xs text-muted-foreground">{titleCase(k)}</p>
                    <p className="font-bold">{k === "unpaid" ? "∞" : `${b.remaining}/${b.quota}`}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">This month's attendance</p>
              <div className="max-h-44 overflow-y-auto scroll-thin rounded-lg border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Hours</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(data.attendance_month ?? []).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{formatDate(a.date)}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                        <TableCell className="text-sm">{a.work_hours ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {(data.attendance_month ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-4">No records this month</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="mb-2 text-sm font-semibold">Recent leaves</p>
                <div className="space-y-1.5">
                  {(data.leaves ?? []).slice(0, 5).map((l) => (
                    <div key={l.id} className="flex items-center gap-2 text-sm">
                      <StatusBadge status={l.status} />
                      <span>{titleCase(l.type)} · {formatDate(l.start_date)}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{l.days}d</span>
                    </div>
                  ))}
                  {(data.leaves ?? []).length === 0 && <p className="text-sm text-muted-foreground">None</p>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Recent payslips</p>
                <div className="space-y-1.5">
                  {(data.payslips ?? []).slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <Badge variant={p.payroll_runs?.status === "finalized" ? "success" : "muted"}>
                        {p.payroll_runs?.period_month}/{p.payroll_runs?.period_year}
                      </Badge>
                      <span>{formatMoney(p.net_pay)} net</span>
                      <a className="ml-auto text-xs text-primary underline" href={`/api/payroll/runs/${p.run_id}/payslip-pdf?employee_id=${p.employee_id}`}>PDF</a>
                    </div>
                  ))}
                  {(data.payslips ?? []).length === 0 && <p className="text-sm text-muted-foreground">None</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── CSV import with dry-run ──────────────────────────────────────────── */

const CSV_TEMPLATE = "employee_code,first_name,last_name,email,department,join_date,basic_salary,gender,phone\nEMP-101,Ali,Raza,ali@example.com,Engineering,2026-01-15,80000,male,03001234567";

function CsvImportDialog({ open, onOpenChange }) {
  const [csv, setCsv] = useState("");
  const [report, setReport] = useState(null);
  const [importCsv, { isLoading }] = useImportEmployeesMutation();

  const dryRun = async () => {
    try {
      const res = await importCsv({ csv, commit: false }).unwrap();
      setReport(res);
    } catch {
      /* toast */
    }
  };

  const commit = async () => {
    try {
      const res = await importCsv({ csv, commit: true }).unwrap();
      setReport(res);
      toast.success(`Imported ${res.insertedCount} employee(s)`);
    } catch {
      /* toast */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o === false) { setReport(null); setCsv(""); } onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>CSV import (dry run first)</DialogTitle>
          <DialogDescription>
            Columns: employee_code, first_name, last_name, email, department, designation, join_date, basic_salary, gender, phone.
            Validated: required fields, unique code/email, valid email, known department, ISO date, salary &gt; 0.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          rows={6}
          className="font-mono text-xs"
          placeholder={CSV_TEMPLATE}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setCsv(CSV_TEMPLATE)}>Paste sample</Button>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" disabled={!csv.trim() || isLoading} onClick={dryRun} className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Dry run
            </Button>
            {report?.dryRun && report.validRows > 0 && (
              <Button size="sm" onClick={commit} disabled={isLoading} className="gap-2">
                <FileUp className="h-4 w-4" /> Import {report.validRows} row(s)
              </Button>
            )}
          </div>
        </div>

        {report && (
          <div className="rounded-lg border max-h-72 overflow-y-auto scroll-thin text-sm">
            <div className="flex gap-3 border-b bg-muted/50 p-3">
              <span>Total: <b>{report.totalRows ?? report.insertedCount + report.failedCount}</b></span>
              <span className="text-success">Valid: <b>{report.validRows ?? report.insertedCount}</b></span>
              <span className="text-destructive">Errors: <b>{report.errorRows ?? report.failedCount}</b></span>
            </div>
            {(report.errors ?? report.failed ?? []).length > 0 && (
              <div className="p-3 space-y-1">
                <p className="text-xs font-semibold text-destructive">Error report (row · field · reason)</p>
                {(report.errors ?? report.failed).map((e, i) => (
                  <div key={i} className="font-mono text-xs text-destructive">
                    row {e.row ?? e.row ?? "—"} · {e.field ?? "—"} · {e.reason}
                  </div>
                ))}
              </div>
            )}
            {report.employees && (
              <div className="border-t p-3 space-y-2">
                <p className="text-xs font-semibold">Created logins — temporary passwords (shown once)</p>
                {report.employees.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-xs">
                    <code className="rounded bg-muted px-1.5 py-0.5">{e.employee_code}</code>
                    <span>{e.email}</span>
                    <code className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">{e.tempPassword}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(e.tempPassword); toast.success("Copied"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
