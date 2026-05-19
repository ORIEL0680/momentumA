-- ─────────────────────────────────────────────────────────────────────────────
-- R59 (R49 admin dashboard) — server-side error log.
-- Run on Supabase (SQL Editor) AFTER 2026-05-10-vendor-applications.sql
-- (this reuses the existing `admin_emails` table for the read policy).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('auth', 'db', 'api', 'unknown')),
  message text not null,
  stack text,
  user_id uuid references auth.users(id) on delete set null,
  url text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_error_logs_created on public.error_logs(created_at desc);
create index if not exists idx_error_logs_type on public.error_logs(type, created_at desc);

alter table public.error_logs enable row level security;

-- Only admins (by JWT email, same mechanism as vendor_applications) may
-- read. Writes happen exclusively via the service-role key in
-- /api/admin/log-error, which bypasses RLS — so we deliberately add NO
-- insert policy for anon/auth roles (no client can write directly).
drop policy if exists "admin reads error logs" on public.error_logs;
create policy "admin reads error logs" on public.error_logs
  for select using (
    auth.jwt() ->> 'email' in (select email from public.admin_emails)
  );
