-- ─────────────────────────────────────────────────────────────────────────────
-- R64 (R79) — Admin bootstrap + hardening.
--
-- The admin_emails table was first created in 2026-05-10-vendor-applications
-- as just `(email text primary key)`. It SHOULD already contain
-- 'talhemo132@gmail.com' from that migration's seed insert. If it doesn't
-- (table truncated by hand, prod DB drift, etc.), nobody can read the
-- /admin surface — this migration restores the founder row idempotently
-- and locks the table down so it can only be edited from the SQL editor /
-- via the service role.
--
-- Idempotent on every step — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Make sure the table exists. Matches the original column shape
-- (just `email text primary key`) so we don't break the existing
-- inline `from('admin_emails').select('email').eq('email', …)` queries.
create table if not exists public.admin_emails (
  email text primary key
);

-- 2. RLS on. The existing policy "user can read own row" was added in
--    2026-05-14-rls-hardening; we re-create it here defensively in case
--    it was dropped. RLS already prevents client writes unless an
--    INSERT/UPDATE/DELETE policy is added — which we explicitly do
--    NOT add, so writes can only happen via the service role or the
--    SQL editor.
alter table public.admin_emails enable row level security;

drop policy if exists "user can read own admin row" on public.admin_emails;
create policy "user can read own admin row" on public.admin_emails
  for select using (
    email = (select email from auth.users where id = auth.uid())
  );

-- 3. Restore the founder row. Idempotent — `on conflict do nothing`
--    means re-running this is a no-op if the row already exists.
insert into public.admin_emails (email)
values ('talhemo132@gmail.com')
on conflict (email) do nothing;

-- 4. Sanity-check query — uncomment locally in the SQL editor to verify.
-- select * from public.admin_emails;
-- Expected: at least one row with email='talhemo132@gmail.com'.
