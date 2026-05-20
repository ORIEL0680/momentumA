-- ─────────────────────────────────────────────────────────────────────────────
-- R67 (R56) — calendar appointments + Wedding Brain.
-- Run in Supabase SQL Editor.
--
-- Spec-adaptation notes (same as R49/R59/R65 pattern):
--   - The spec FK'd `event_id` to a `events` table and `vendor_id` to a
--     `vendor_profiles` table. Neither exists in this project (events
--     are JSON in `app_states`, the canonical vendor table is
--     `vendor_applications`). So:
--       • event_id: kept as text (callers can pass the JSON event UUID
--         or any opaque ref — there's no FK, and the column is purely
--         informational for the UI).
--       • vendor_id: uuid nullable, FK'd to `vendor_applications.id`
--         (the closest real table; SET NULL on vendor deletion).
--   - The spec's "user_profiles.calendar_seeded" gate doesn't exist
--     either; idempotency lives in the seed-brain API route (checks
--     existing rows) + localStorage on the client.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Soft references — no FK to keep the schema decoupled from the
  -- JSON-blob event model + the application's vendor-applications model.
  event_id text,
  vendor_id uuid references public.vendor_applications(id) on delete set null,

  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  location text,
  color text default '#D4B068',
  category text not null check (category in (
    'venue', 'catering', 'photo', 'dj', 'flowers',
    'dress', 'hair', 'personal', 'milestone', 'other'
  )),
  source text not null default 'manual' check (source in ('manual', 'ai_suggestion')),
  ai_status text check (ai_status in ('pending', 'accepted', 'dismissed')),
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_user_date
  on public.appointments(user_id, start_at);
create index if not exists idx_appointments_ai_pending
  on public.appointments(user_id, ai_status)
  where source = 'ai_suggestion';

alter table public.appointments enable row level security;

drop policy if exists "users manage own appointments" on public.appointments;
create policy "users manage own appointments" on public.appointments
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Auto-update updated_at on every change.
create or replace function public.appointments_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists appointments_touch_updated_at on public.appointments;
create trigger appointments_touch_updated_at
before update on public.appointments
for each row execute function public.appointments_touch_updated_at();
