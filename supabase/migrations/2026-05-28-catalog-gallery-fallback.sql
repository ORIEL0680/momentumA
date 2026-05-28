-- R103 — extend list_approved_vendors RPC to also return
-- `gallery_paths` so the catalog tile mapper can fall back to the
-- first gallery photo when the vendor hasn't set a dedicated
-- hero / cover / logo.
--
-- Symptom this fixes: a vendor uploads 2 photos through the
-- studio editor's "גלריית עבודות" section (sets gallery_paths)
-- but never touches the "תמונת פרופיל / לוגו" section
-- (hero_photo_path stays NULL). The catalog falls all the way
-- through cover_image_url → logo_url → hero_photo_path → all
-- null → renders the monogram placeholder. User assumes the
-- upload is broken when in fact the data is there, just unused.
--
-- Fix: surface `gallery_paths` (text[]) in the RPC return. Mapper
-- adds it as the LAST priority in the photoUrl chain so the
-- catalog uses gallery_paths[0] when nothing else is set.
-- Backward compatible — old callers that don't ask for
-- gallery_paths still get every other column.

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
  gallery_paths text[],
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
      vl.gallery_paths     as landing_gallery,
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
    coalesce(lpe.landing_gallery, '{}'::text[])                        as gallery_paths,
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
