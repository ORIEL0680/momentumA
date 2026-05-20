-- ─────────────────────────────────────────────────────────────────────────────
-- R68 (R57) — calendar-pro upgrade layer (MVP scope).
-- Run in Supabase SQL Editor AFTER 2026-05-20-calendar-appointments.sql (R67).
--
-- Scope decision (locked with the owner): the spec listed 8 parts; this
-- migration covers only the two that the MVP UI actually uses —
--   • appointments.checklist  (Part 1 — smart vendor checklists)
--   • calendar_sync_tokens    (Part 2 — iCal feed for Google/Apple)
-- The spec's `meeting_briefs` + `calendar_shares` tables are intentionally
-- skipped: they only power Parts 5 + family-share, which are deferred.
-- Adding unused tables now just creates schema noise; a follow-up migration
-- will introduce them when those features actually ship.
-- ─────────────────────────────────────────────────────────────────────────────

-- Per-appointment checklist. Shape (jsonb array):
--   [{ "id": "q-0", "label": "...", "checked": false, "type": "question" },
--    { "id": "b-0", "label": "...", "checked": false, "type": "bring"    }]
-- Default `[]` lets existing rows keep working without a backfill.
alter table public.appointments
  add column if not exists checklist jsonb not null default '[]'::jsonb;

-- ─── iCal sync tokens ───
-- One token per user. The `/api/calendar/ics/[token]` endpoint validates
-- the token and emits an ICS feed scoped to that user_id. Token is opaque
-- and unguessable; rotating it (delete + re-insert) revokes the calendar
-- subscription instantly.
create table if not exists public.calendar_sync_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create index if not exists idx_calendar_sync_tokens_token
  on public.calendar_sync_tokens(token);

alter table public.calendar_sync_tokens enable row level security;

drop policy if exists "users manage own sync token" on public.calendar_sync_tokens;
create policy "users manage own sync token" on public.calendar_sync_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
