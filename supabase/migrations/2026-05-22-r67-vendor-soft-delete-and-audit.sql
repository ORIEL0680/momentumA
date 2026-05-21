-- ─────────────────────────────────────────────────────────────────────────────
-- R67 (R84) — soft-delete column on vendor_applications + admin audit log.
--
-- The R67 spec referenced a `vendor_profiles` table that doesn't exist in
-- this project. The actual catalog source is `vendor_applications` (via
-- the `list_approved_vendors` RPC). This migration adapts the spec to
-- reality:
--   1. Adds `deleted_at`, `deleted_by_email`, `deletion_reason` to
--      vendor_applications for admin soft-delete.
--   2. Updates `list_approved_vendors` to filter out soft-deleted rows.
--   3. Creates `admin_audit_log` for tracking admin actions.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Soft-delete columns on vendor_applications.
alter table public.vendor_applications
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_email text,
  add column if not exists deletion_reason text;

-- Index speeds up the "approved AND not deleted" filter used by the
-- catalog RPC (where most of the table will live long-term).
create index if not exists vendor_applications_active_idx
  on public.vendor_applications(status, created_at desc)
  where status = 'approved' and deleted_at is null;

-- 2. Replace the catalog RPC so it excludes soft-deleted rows.
-- The function stays `security definer` so anon callers can read the
-- public-safe columns of approved vendors.
create or replace function list_approved_vendors()
returns table (
  id uuid,
  business_name text,
  category text,
  city text,
  about text,
  website text,
  instagram text,
  facebook text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    id,
    business_name,
    category,
    city,
    about,
    website,
    instagram,
    facebook,
    created_at
  from vendor_applications
  where status = 'approved'
    and deleted_at is null
  order by created_at desc
  limit 1000;
$$;

-- Grants survive `create or replace`, but re-issuing is harmless and
-- defensive.
grant execute on function list_approved_vendors() to anon, authenticated;

-- 3. Admin audit log — append-only record of admin actions.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action text not null,
  target_id text,
  reason text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

-- Admins can read their own actions; the service role (used by the
-- delete/restore routes) bypasses RLS entirely so inserts always work.
drop policy if exists "admin reads own audit" on public.admin_audit_log;
create policy "admin reads own audit" on public.admin_audit_log
  for select using (admin_email = (auth.jwt() ->> 'email'));
