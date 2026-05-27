-- R148 — fix the R146/R147 catalog regression: vendor logos stopped
-- appearing.
--
-- Background: the R146 migration (`2026-05-27-catalog-reflects-
-- landing-edits.sql`) replaced the original RPC body so the catalog
-- could pick up vendor edits. In the process the WHERE clause on the
-- inner `landing_per_email` CTE changed from
--
--   where vl.hero_photo_path is not null
--
-- to
--
--   where vl.landing_published is true
--
-- That broke two cases:
--   (a) Landings that were auto-provisioned by the admin approval
--       flow but never explicitly set `landing_published = true`
--       (default depends on column default — some legacy rows are
--       false / null).
--   (b) Vendors who uploaded a photo via /dashboard/vendor-studio
--       but haven't toggled the "publish" switch yet.
--
-- Both cases LOSE the photo (and now also lose the landing-edited
-- name / about / etc.), because the `landing_per_email` CTE returns
-- no row for them — every `coalesce(lpe.*, va.*)` falls back to the
-- frozen application data.
--
-- Fix: remove the published filter entirely. Approved-application
-- gating (`va.status = 'approved' and va.deleted_at is null`) is
-- already the public visibility gate; an approved vendor is allowed
-- in the catalog regardless of whether their landing's
-- "landing_published" flag is on. A vendor who DOESN'T want to be
-- in the catalog can withdraw / be deleted from the applications
-- table; the landing-publish toggle is for the public-page-only
-- visibility (decided per-render in app/vendor/[slug]/page.tsx).
--
-- Net effect: every approved vendor sees their landing edits in the
-- catalog the moment they save, without needing to flip a separate
-- "published" toggle they probably don't even know exists.

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
    -- R148: removed `where vl.landing_published is true` — that
    -- filter cut off vendors with unpublished-by-default landings
    -- (legacy + freshly-provisioned). The application-status gate
    -- below is the real visibility check.
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
