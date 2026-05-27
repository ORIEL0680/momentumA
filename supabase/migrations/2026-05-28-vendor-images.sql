-- R86 — split the single `hero_photo_path` into three distinct concepts:
--   • logo_url        — small brand mark, overlay on the hero
--   • cover_image_url — large full-bleed background of the public page
--   • gallery_urls    — array of additional work samples (was gallery_paths)
--
-- Pre-R86, vendor_landings.hero_photo_path was used for BOTH the logo
-- on the catalog tile AND the giant cover background on /vendor/[slug].
-- Photogenic vendors needed two different images — a clean square logo
-- for the tile + a wide-aspect cover for the landing page. Pinning both
-- to one column meant choosing between "logo that crops weirdly on
-- the hero" or "hero that's too detailed for the tile".
--
-- Migration design:
--   1. Add the three new nullable columns. Existing rows pick up NULL,
--      so the code's fallback chain (cover_image_url ?? hero_photo_path
--      → logo_url ?? hero_photo_path) keeps things working unchanged
--      until the vendor explicitly fills the new fields.
--   2. `image_updated_at` is a timestamptz; the touch trigger sets it
--      automatically whenever any image field changes. The Vercel
--      revalidate(30) on /vendor/[slug] + /vendors page (server
--      components) re-renders within 30s; we also append
--      `?v=image_updated_at` to URLs to bust the browser image cache
--      for paths that didn't change name.
--   3. `gallery_urls` already existed as `gallery_paths` (storage
--      paths) — left alone; the new schema is purely additive.
--
-- The fields store FULL URLs (https://…) not Storage paths. This is a
-- deliberate departure from `hero_photo_path` / `gallery_paths` (which
-- store paths and rely on `getVendorPhotoUrl(path)` to resolve). Both
-- conventions are now supported via that helper's
-- `startsWith("http")` short-circuit, so vendors who paste an external
-- URL (their existing brand asset hosted on imgix, Cloudflare, etc.)
-- still work without re-uploading to our bucket.

alter table public.vendor_landings
  add column if not exists logo_url text,
  add column if not exists cover_image_url text,
  add column if not exists image_updated_at timestamptz;

-- Initialize `image_updated_at` for existing rows so cache-buster
-- queries don't get a useless NULL on legacy data. landing_updated_at
-- is the closest existing proxy for "when was the visual state last
-- touched"; we copy from there.
update public.vendor_landings
set image_updated_at = coalesce(landing_updated_at, created_at, now())
where image_updated_at is null;

-- Touch trigger — bumps image_updated_at whenever any image field
-- changes. Includes legacy hero_photo_path + gallery_paths so an old
-- studio that only saves to those fields still drives cache-busting.
create or replace function public.touch_vendor_image_updated_at()
returns trigger
language plpgsql
as $$
begin
  if (new.logo_url is distinct from old.logo_url)
     or (new.cover_image_url is distinct from old.cover_image_url)
     or (new.hero_photo_path is distinct from old.hero_photo_path)
     or (new.gallery_paths   is distinct from old.gallery_paths)
  then
    new.image_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vendor_images_touch on public.vendor_landings;
create trigger trg_vendor_images_touch
  before update on public.vendor_landings
  for each row
  execute function public.touch_vendor_image_updated_at();

-- Helpful index for catalog ordering by recency of image edits
-- ("recently-refreshed-by-vendor" rises to the top).
create index if not exists idx_vendor_landings_image_updated
  on public.vendor_landings(image_updated_at desc nulls last)
  where landing_published is true;

-- R86 — expose `logo_url`, `cover_image_url`, `image_updated_at` in
-- the catalog RPC so the tile + the public profile share the same
-- cache key + can prefer the new fields. The COALESCE chain from
-- R148 / R83 is preserved for the text fields; the image fields get
-- their own deterministic priority order.
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
      vl.image_updated_at  as landing_image_ts
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
