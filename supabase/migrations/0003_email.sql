-- ═══════════════════════════════════════════════════════════════════════
-- HCM Lite — designed system emails (run AFTER 0001 + 0002)
-- Every email the app sends is stored in email_outbox (sent or queued),
-- so Admin can review the exact designed email even without SMTP.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  kind text not null,
  html text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists email_outbox_created_idx on public.email_outbox (created_at desc);

alter table public.email_outbox enable row level security;
create policy "admin read outbox" on public.email_outbox for select using (public.is_admin());
