-- ─── R80 — Seating Architect schema ──────────────────────────────────
-- Adds the canvas-position + venue-layout fields needed for the new 2D
-- top-down architect view (components/seating/ArchitectCanvas.tsx).
--
-- Every column is nullable / has a default so existing rows survive
-- without a backfill. The app reads localStorage as the source of
-- truth today; this migration is the schema target for when the
-- seating canvas moves to cloud sync.
-- ─────────────────────────────────────────────────────────────────────

-- 1) venue_layout on events.
--    Shape:
--      {
--        width: 1200, height: 800,
--        danceFloor: { x, y, w, h },
--        bar:        { x, y, w, h },
--        stage:      { x, y, w, h },
--        entrance:   { x, y }
--      }
--    Empty object {} means "use the app's default layout" — the canvas
--    falls back to hardcoded coordinates so the page renders even when
--    the host hasn't customized anything yet.
alter table public.events
  add column if not exists venue_layout jsonb default '{}'::jsonb;

-- 2) seating_tables — position + cosmetic fields.
--
-- position_x / position_y: 0-based SVG coordinates within the venue
--   viewBox (1200×800 by default). Stored as numeric so the value
--   survives sub-pixel rounding during drag.
-- color: hex string the host picked for this table (defaults to the
--   gold accent).
-- shape: "round" (default) | "rect" — the canvas renders an ellipse
--   or rectangle accordingly.
-- label: an optional override for the display label (e.g. "שולחן
--   ההורים"). When null, the canvas falls back to the existing
--   `number`/`name` logic.
alter table public.seating_tables
  add column if not exists position_x numeric default 0,
  add column if not exists position_y numeric default 0,
  add column if not exists color text default '#D4B068',
  add column if not exists shape text default 'round'
    check (shape is null or shape in ('round', 'rect')),
  add column if not exists label text;

-- Defensive recreation: if the shape column already existed without
-- the check constraint (e.g. an older partial migration), recreate it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'seating_tables'
      and column_name = 'shape'
  ) then
    alter table public.seating_tables
      drop constraint if exists seating_tables_shape_check;
    alter table public.seating_tables
      add constraint seating_tables_shape_check
      check (shape is null or shape in ('round', 'rect'));
  end if;
end $$;

-- 3) Index for "all tables for this event" lookups — already the
--    primary access pattern for /seating, but the canvas hits this
--    on every autosave so an explicit index keeps the round-trip
--    snappy even with 60+ tables.
create index if not exists idx_seating_tables_event
  on public.seating_tables(event_id);
