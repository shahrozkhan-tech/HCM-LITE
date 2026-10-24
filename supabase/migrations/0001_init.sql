-- ═══════════════════════════════════════════════════════════════════════
-- HCM Lite — initial schema
-- Run in Supabase SQL Editor (or `supabase db push`) on a fresh project.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Profiles (one row per auth user) ────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'employee' check (role in ('admin', 'hr', 'employee')),
  must_change_password boolean not null default false,
  is_active boolean not null default true,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

-- ── Organization settings (single row) ──────────────────────────────────
create table public.organization_settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'My Company',
  timezone text not null default 'Asia/Karachi',
  office_start text not null default '09:00',        -- 24h HH:MM
  grace_minutes int not null default 15,
  half_day_hours numeric not null default 5,
  weekend_days int[] not null default '{6,0}',       -- 0=Sun .. 6=Sat
  office_lat double precision,
  office_lng double precision,
  geofence_radius int not null default 150,          -- metres
  annual_quota int not null default 14,
  sick_quota int not null default 8,
  casual_quota int not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.organization_settings (id) values (1) on conflict do nothing;

-- ── Org structure ───────────────────────────────────────────────────────
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.designations (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments (id) on delete set null,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- ── Employees ───────────────────────────────────────────────────────────
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  employee_code text not null unique,
  first_name text not null,
  last_name text not null default '',
  email text not null unique,
  department_id uuid references public.departments (id) on delete set null,
  designation_id uuid references public.designations (id) on delete set null,
  join_date date not null,
  exit_date date,
  status text not null default 'active' check (status in ('active', 'probation', 'exited')),
  basic_salary numeric not null default 0 check (basic_salary >= 0),
  gender text check (gender in ('male', 'female', 'other')),
  dob date,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employees_dept_idx on public.employees (department_id);
create index employees_status_idx on public.employees (status);

-- ── Attendance (one row per employee per day) ───────────────────────────
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status text not null check (status in ('present', 'late', 'half_day', 'missing_checkout', 'absent', 'on_leave')),
  source text check (source in ('web', 'camera')),
  location jsonb,
  work_hours numeric,
  correction_requested boolean not null default false,
  correction_reason text,
  correction_status text check (correction_status in ('pending', 'approved', 'rejected')),
  corrected_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (employee_id, date)
);
create index attendance_date_idx on public.attendance (date);
create index attendance_emp_date_idx on public.attendance (employee_id, date desc);

-- ── Leaves ──────────────────────────────────────────────────────────────
create table public.leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  type text not null check (type in ('annual', 'sick', 'casual', 'unpaid')),
  start_date date not null,
  end_date date not null,
  days numeric not null,
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approver_id uuid references public.profiles (id),
  decision_comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index leaves_emp_idx on public.leaves (employee_id);
create index leaves_status_idx on public.leaves (status);

-- ── Payroll ─────────────────────────────────────────────────────────────
create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_month int not null check (period_month between 1 and 12),
  period_year int not null,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  created_by uuid references public.profiles (id),
  finalized_by uuid references public.profiles (id),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (period_year, period_month)
);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  basic numeric not null default 0,
  hra numeric not null default 0,
  medical numeric not null default 0,
  gross numeric not null default 0,
  working_days numeric not null default 0,
  expected_days numeric not null default 0,
  absent_days numeric not null default 0,
  unpaid_days numeric not null default 0,
  half_days numeric not null default 0,
  deduction numeric not null default 0,
  tax numeric not null default 0,
  net_pay numeric not null default 0,
  prorated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (run_id, employee_id)
);
create index payslips_run_idx on public.payslips (run_id);
create index payslips_emp_idx on public.payslips (employee_id);

-- ── Comms & audit ───────────────────────────────────────────────────────
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  actor_name text,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_created_idx on public.audit_logs (created_at desc);

create table public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  question text not null,
  tools_called text[] not null default '{}',
  answer text,
  created_at timestamptz not null default now()
);
create index ai_logs_user_time_idx on public.ai_logs (user_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════
-- Helper functions + Row Level Security
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.my_role() = 'admin'; $$;

create or replace function public.is_hr() returns boolean
language sql stable as $$ select public.my_role() = 'hr'; $$;

create or replace function public.is_staff() returns boolean  -- admin or hr
language sql stable as $$ select public.my_role() in ('admin', 'hr'); $$;

create or replace function public.my_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select e.id from employees e where e.user_id = auth.uid();
$$;

alter table public.profiles            enable row level security;
alter table public.organization_settings enable row level security;
alter table public.departments         enable row level security;
alter table public.designations        enable row level security;
alter table public.holidays            enable row level security;
alter table public.employees           enable row level security;
alter table public.attendance          enable row level security;
alter table public.leaves              enable row level security;
alter table public.payroll_runs        enable row level security;
alter table public.payslips            enable row level security;
alter table public.announcements       enable row level security;
alter table public.notifications       enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.ai_logs             enable row level security;

-- profiles: everyone reads own; admin/hr read all (HR needs names); admin writes
create policy "read own profile" on public.profiles for select using (id = auth.uid());
create policy "staff read profiles" on public.profiles for select using (public.is_staff());
create policy "admin update profiles" on public.profiles for update using (public.is_admin());

-- settings / departments / designations / holidays: signed-in read, admin write
create policy "read settings" on public.organization_settings for select using (auth.uid() is not null);
create policy "admin write settings" on public.organization_settings for update using (public.is_admin());

create policy "read departments" on public.departments for select using (auth.uid() is not null);
create policy "admin write departments" on public.departments for insert with check (public.is_admin());
create policy "admin del departments" on public.departments for delete using (public.is_admin());

create policy "read designations" on public.designations for select using (auth.uid() is not null);
create policy "admin write designations" on public.designations for insert with check (public.is_admin());
create policy "admin del designations" on public.designations for delete using (public.is_admin());

create policy "read holidays" on public.holidays for select using (auth.uid() is not null);
create policy "admin write holidays" on public.holidays for insert with check (public.is_admin());
create policy "admin del holidays" on public.holidays for delete using (public.is_admin());

-- employees: employee reads own row; staff read/insert/update all
create policy "read own employee" on public.employees for select using (user_id = auth.uid());
create policy "staff read employees" on public.employees for select using (public.is_staff());
create policy "staff write employees" on public.employees for insert with check (public.is_staff());
create policy "staff update employees" on public.employees for update using (public.is_staff());

-- attendance: employee reads own, inserts own check-in; staff read/update all
create policy "read own attendance" on public.attendance for select using (employee_id = public.my_employee_id());
create policy "staff read attendance" on public.attendance for select using (public.is_staff());
create policy "insert own attendance" on public.attendance for insert with check (employee_id = public.my_employee_id());
create policy "staff update attendance" on public.attendance for update using (public.is_staff());

-- leaves: employee reads/inserts own, updates own (cancel); staff read/update all
create policy "read own leaves" on public.leaves for select using (employee_id = public.my_employee_id());
create policy "staff read leaves" on public.leaves for select using (public.is_staff());
create policy "insert own leaves" on public.leaves for insert with check (employee_id = public.my_employee_id());
create policy "update own leaves" on public.leaves for update using (employee_id = public.my_employee_id());
create policy "staff update leaves" on public.leaves for update using (public.is_staff());

-- payroll: employee reads own payslips + run status; staff read all + write drafts
create policy "read own payslips" on public.payslips for select using (
  employee_id in (select id from employees where user_id = auth.uid())
);
create policy "staff read payslips" on public.payslips for select using (public.is_staff());
create policy "hr write payslips" on public.payslips for insert with check (public.is_staff());
create policy "admin del payslips" on public.payslips for delete using (public.is_staff());

create policy "read runs" on public.payroll_runs for select using (auth.uid() is not null);
create policy "staff write runs" on public.payroll_runs for insert with check (public.is_staff());
create policy "staff update runs" on public.payroll_runs for update using (public.is_staff());
create policy "staff del runs" on public.payroll_runs for delete using (public.is_staff());

-- announcements: any signed-in user reads; admin/hr post
create policy "read announcements" on public.announcements for select using (auth.uid() is not null);
create policy "staff post announcements" on public.announcements for insert with check (public.is_staff());

-- notifications: own only
create policy "own notifications" on public.notifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit logs: admin read only (writes happen via service role)
create policy "admin read audit" on public.audit_logs for select using (public.is_admin());

-- ai logs: admin read (writes via service role)
create policy "admin read ai logs" on public.ai_logs for select using (public.is_admin());
