-- R146 — catalog now reflects vendor_landings edits.
--
-- Problem: pre-R146 the public catalog (`list_approved_vendors` RPC)
-- pulled business name, about, city, website, instagram, facebook,
-- category from the frozen `vendor_applications` row. Only
-- `hero_photo_path` was joined in from `vendor_landings`. So when a
-- vendor edited their landing in /dashboard/vendor-studio — changed
-- the business name, updated the bio, swapped social links, switched
-- cities — NONE OF IT appeared in the catalog. The application
-- submission was effectively a one-shot snapshot.
--
-- User report: "אני רוצה שאם ספק מבצע עריכה בדף הספק שלו מבחינת
-- תמונות משפטים לוגו וכו, זה ישתקף בקטלוג לעיני הציבור".
--
-- Fix: COALESCE the landing fields over the application fields. The
-- landing is the live, editable source of truth; the application is
-- the fallback for fields the vendor never edited (or rows that
-- predate the landing-editor era). hero_photo_path was already
-- landing-first; this migration extends the same pattern to every
-- other catalog-facing field.
--
-- Schema impact: signature of the RPC is unchanged (same column
-- names + types). Only the body changes, so callers don't need
-- updates. `tagline` is added so the catalog can show the vendor's
-- one-liner tagline if they wrote one in the editor; existing
-- callers that ignore it still work.
--
-- Migration order:
--   1. Drop the existing function (signature is changing → we need
--      drop-and-recreate, not CREATE OR REPLACE).
--   2. Recreate with the COALESCE'd projection.
--   3. Re-grant execute to anon + authenticated.

drop function if exists public.list_approved_vendors();

create function public.list_approved_vendors()
returns table (
  id uuid,
  business_name text,
  category text,
  city text,
  about text,
  tagline text,
  website text,
  instagram text,
  facebook text,
  hero_photo_path text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  -- One landing row per vendor email — vendors should have exactly
  -- one landing, but historical data may have orphans. Pick the most
  -- recently updated one as the canonical source.
  with landing_per_email as (
    select distinct on (lower(coalesce(au.email, vl.email)))
      lower(coalesce(au.email, vl.email)) as email_key,
      vl.name           as landing_name,
      vl.category       as landing_category,
      vl.city           as landing_city,
      vl.about_long     as landing_about,
      vl.tagline        as landing_tagline,
      vl.website        as landing_website,
      vl.instagram      as landing_instagram,
      vl.facebook       as landing_facebook,
      vl.hero_photo_path as landing_hero
    from vendor_landings vl
    -- left join so landings whose owner_user_id is null (orphans the
    -- admin pre-created from the application before the vendor
    -- signed up) still match by their own `email` column.
    left join auth.users au on au.id = vl.owner_user_id
    where vl.landing_published is true
    order by lower(coalesce(au.email, vl.email)),
             vl.landing_updated_at desc nulls last,
             vl.created_at desc nulls last
  )
  select
    va.id,
    -- COALESCE pattern: landing wins when present, fall back to
    -- application. `nullif(..., '')` so an empty-string landing
    -- field doesn't override a meaningful application value.
    coalesce(nullif(trim(lpe.landing_name),     ''), va.business_name) as business_name,
    coalesce(nullif(trim(lpe.landing_category), ''), va.category)      as category,
    coalesce(nullif(trim(lpe.landing_city),     ''), va.city)          as city,
    coalesce(nullif(trim(lpe.landing_about),    ''), va.about)         as about,
    nullif(trim(lpe.landing_tagline),   '')                            as tagline,
    coalesce(nullif(trim(lpe.landing_website),  ''), va.website)       as website,
    coalesce(nullif(trim(lpe.landing_instagram),''), va.instagram)     as instagram,
    coalesce(nullif(trim(lpe.landing_facebook), ''), va.facebook)      as facebook,
    lpe.landing_hero                                                   as hero_photo_path,
    va.created_at
  from public.vendor_applications va
  left join landing_per_email lpe on lpe.email_key = lower(va.email)
  where va.status = 'approved'
    and va.deleted_at is null
  order by
    va.featured_at desc nulls last,
    va.featured_rank asc nulls last,
    va.created_at desc
  limit 1000;
$$;

grant execute on function public.list_approved_vendors() to anon, authenticated;
