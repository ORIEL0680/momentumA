-- ─────────────────────────────────────────────────────────────────────────────
-- R60 (R51) — scheduled outbound emails (the welcome flow).
-- Run in Supabase SQL Editor.
--
-- Notes on the spec adaptation:
--   The spec referenced a `user_profiles` table + trigger on its INSERT.
--   This project has no such table — auth lives in `auth.users` and
--   per-user app state is a JSON blob in `app_states`. So the trigger
--   fires on `auth.users` INSERT instead. The shape is identical.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null check (email_type in ('welcome')),
  send_at timestamptz not null,
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_scheduled_pending
  on public.scheduled_emails(send_at)
  where sent_at is null;
create index if not exists idx_scheduled_user
  on public.scheduled_emails(user_id);

-- Idempotency: at most one scheduled welcome per user, ever.
create unique index if not exists uq_scheduled_welcome_per_user
  on public.scheduled_emails(user_id) where email_type = 'welcome';

-- RLS: deny everything by default. Reads + writes happen only via the
-- service-role key in /api/send-scheduled (and the trigger below, which
-- runs SECURITY DEFINER so it bypasses RLS).
alter table public.scheduled_emails enable row level security;
-- No policies on purpose. Service-role key bypasses RLS.

-- ─── Trigger ─────────────────────────────────────────────────────────────
-- Schedule a welcome email 1 hour after a new auth user is created.
-- SECURITY DEFINER so it can write to public.scheduled_emails even
-- though `auth.users` INSERTs run under the auth service role context.
-- ON CONFLICT keeps the function idempotent if a row somehow exists.

create or replace function public.schedule_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.scheduled_emails (user_id, email_type, send_at)
  values (new.id, 'welcome', now() + interval '1 hour')
  on conflict (user_id) where email_type = 'welcome' do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_welcome on auth.users;
create trigger on_auth_user_created_welcome
  after insert on auth.users
  for each row execute function public.schedule_welcome_email();
