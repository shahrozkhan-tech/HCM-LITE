-- ═══════════════════════════════════════════════════════════════════════
-- HCM Lite — bonus features (run AFTER 0001_init.sql)
--  · late_days / late_penalty_days on payslips (rule: 3 lates = 0.5 day)
-- ═══════════════════════════════════════════════════════════════════════

alter table public.payslips
  add column if not exists late_days numeric not null default 0,
  add column if not exists late_penalty_days numeric not null default 0;
