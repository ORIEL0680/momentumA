-- R94 — surface `vendor_landings.service_areas` through the catalog
-- RPC so the catalog page can match vendors against EVERY region
-- they serve, not just the single region inferred from their city.
--
-- Background: pre-R94, `mapApprovedRowToVendor` set
-- `Vendor.region` from a city-name regex. A caterer in חיפה who
-- chose service areas "צפון, חיפה, קריות" appeared ONLY under the
-- "haifa" filter — picking the "north" filter hid them, even
-- though they explicitly said they serve the north.
--
-- Fix is fully additive: the RPC just gets one more column
-- (`service_areas text[]`). The client mapper translates each
-- token via `regionsFromAreas()` (a substring/exact-match regex
-- table covering both city names + direct region words) and the
-- filter consults the resulting `Vendor.regions` array.
--
-- Backward compatible: pre-2026-05-28 callers that don't ask for
-- `service_areas` still get every other column they expected, and
-- vendors who never set service_areas get an empty array (the
-- mapper then falls back to the city-derived single region — same
-- behavior as before).

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
  logo_url text,
  cover_image_url text,
  image_updated_at timestamptz,
  service_areas text[],
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with landing_per_email as (
    select distinct on (lower(coalesce(au.email, vl.email)))
      lower(coalesce(au.email, vl.email)) as email_key,
      vl.name              as landing_name,
      vl.category          as landing_category,
      vl.city              as landing_city,
      vl.about_long        as landing_about,
      vl.tagline           as landing_tagline,
      vl.website           as landing_website,
      vl.instagram         as landing_instagram,
      vl.facebook          as landing_facebook,
      vl.hero_photo_path   as landing_hero,
      vl.logo_url          as landing_logo,
      vl.cover_image_url   as landing_cover,
      vl.image_updated_at  as landing_image_ts,
      vl.service_areas     as landing_areas
    from public.vendor_landings vl
    left join auth.users au on au.id = vl.owner_user_id
    order by lower(coalesce(au.email, vl.email)),
             vl.landing_updated_at desc nulls last,
             vl.created_at desc nulls last
  )
  select
    va.id,
    coalesce(nullif(trim(lpe.landing_name),     ''), va.business_name) as business_name,
    coalesce(nullif(trim(lpe.landing_category), ''), va.category)      as category,
    coalesce(nullif(trim(lpe.landing_city),     ''), va.city)          as city,
    coalesce(nullif(trim(lpe.landing_about),    ''), va.about)         as about,
    nullif(trim(lpe.landing_tagline),   '')                            as tagline,
    coalesce(nullif(trim(lpe.landing_website),  ''), va.website)       as website,
    coalesce(nullif(trim(lpe.landing_instagram),''), va.instagram)     as instagram,
    coalesce(nullif(trim(lpe.landing_facebook), ''), va.facebook)      as facebook,
    lpe.landing_hero                                                   as hero_photo_path,
    lpe.landing_logo                                                   as logo_url,
    lpe.landing_cover                                                  as cover_image_url,
    lpe.landing_image_ts                                               as image_updated_at,
    coalesce(lpe.landing_areas, '{}'::text[])                          as service_areas,
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
