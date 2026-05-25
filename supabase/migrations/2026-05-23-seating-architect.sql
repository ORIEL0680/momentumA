-- ─── R80 — Seating Architect schema (NO-OP) ──────────────────────────
--
-- IMPORTANT: This migration is intentionally a no-op.
--
-- The original spec assumed normalized `events` and `seating_tables`
-- tables existed and proposed ALTER TABLE statements against them.
-- They DON'T exist in this app's schema.
--
-- Every event-related entity (event details, seating tables, guests,
-- assignments, etc.) lives inside `public.app_states.payload`, a
-- JSONB column synced wholesale per user (see schema.sql + the R13
-- with-check migration). The new R80 fields are added directly to
-- the in-app TypeScript types:
--
--   • lib/types.ts → SeatingTable.positionX / positionY / color /
--                    shape / label
--   • lib/types.ts → EventInfo.venueLayout
--
-- Because they're part of the AppState payload, they're persisted
-- automatically by the existing app_states sync — no DDL needed.
--
-- This file stays committed (instead of being deleted) so that:
--   1. Anyone reading the migrations in order has a paper trail
--      explaining why no DDL ran for R80.
--   2. If the schema later normalizes (e.g. promoting seating_tables
--      out of the JSON blob), this is the natural place to add the
--      real ALTER statements.
--
-- Running this migration in Supabase SQL Editor is safe — it does
-- nothing and returns no errors.
-- ─────────────────────────────────────────────────────────────────────

do $$
begin
  raise notice 'R80 seating-architect: no DDL required — fields live in app_states.payload (JSONB)';
end $$;
