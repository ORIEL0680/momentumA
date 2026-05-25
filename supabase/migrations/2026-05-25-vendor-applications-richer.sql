-- ─── R119 — richer vendor application data ────────────────────────────
-- Adds the fields that turn a barebones "name + category + about"
-- listing into a true catalog page: price tier, tagline, service
-- areas (where the vendor works), languages, and a free-text
-- specialty paragraph.
--
-- Every new column is nullable so existing rows survive without
-- backfill. The apply route enforces required-ness on the client +
-- server side per field, NOT in the schema, so a future change
-- (e.g. promoting one to required) doesn't break existing rows.
-- ─────────────────────────────────────────────────────────────────────

alter table public.vendor_applications
  add column if not exists tagline text,
  add column if not exists price_range text
    check (price_range is null or price_range in ('budget', 'mid', 'premium', 'luxury')),
  add column if not exists service_areas text[] default '{}',
  add column if not exists languages text[] default '{}',
  add column if not exists specialty text;

-- The check constraint can't be added inline if the column already
-- exists. Defensive recreation:
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vendor_applications'
      and column_name = 'price_range'
  ) then
    alter table public.vendor_applications
      drop constraint if exists vendor_applications_price_range_check;
    alter table public.vendor_applications
      add constraint vendor_applications_price_range_check
      check (price_range is null or price_range in ('budget', 'mid', 'premium', 'luxury'));
  end if;
end $$;
