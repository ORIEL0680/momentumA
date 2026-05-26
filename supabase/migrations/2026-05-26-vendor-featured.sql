-- ─── R125 — vendor featured / pin-to-top control ─────────────────────
--
-- Lets the admin (founder) "boost" specific vendors so they appear
-- first in their category in the public catalog. Two complementary
-- columns:
--   featured_at  — when the admin pinned the vendor. NULL = not pinned.
--                  Sort order: featured_at DESC NULLS LAST → most-
--                  recently-pinned shows at the very top.
--   featured_rank — optional manual tie-breaker for fine-grained
--                  ordering between two pinned vendors. Lower rank =
--                  earlier. NULL is treated as the lowest priority.
--
-- The simple approval list (created_at desc) becomes:
--   ORDER BY featured_at DESC NULLS LAST,
--            featured_rank ASC NULLS LAST,
--            created_at DESC
--
-- This migration also drops + recreates `list_approved_vendors()` to
-- bake the new ordering in. The RPC's return type stays
-- backwards-compatible (no new columns) so existing callers don't
-- need code changes — they just see pinned vendors first.
-- ─────────────────────────────────────────────────────────────────────

alter table public.vendor_applications
  add column if not exists featured_at timestamptz,
  add column if not exists featured_rank int;

-- Index for the catalog query — covers the common "approved + not-
-- deleted, sort by featured_at" path. Postgres can use this for the
-- ORDER BY when status='approved' (most common case).
create index if not exists vendor_applications_featured_idx
  on public.vendor_applications (featured_at desc nulls last)
  where status = 'approved' and deleted_at is null;

-- Recreate the RPC with the new ordering. R117's signature stays
-- intact (id, business_name, category, city, about, website,
-- instagram, facebook, hero_photo_path, created_at). We can't add
-- columns without changing the return type — admins can read
-- featured_at directly from vendor_applications, the catalog
-- doesn't need it (the order is the entire signal).
drop function if exists public.list_approved_vendors();

create function public.list_approved_vendors()
returns table (
  id uuid,
  business_name text,
  category text,
  city text,
  about text,
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
    select distinct on (lower(au.email))
      lower(au.email) as email_key,
      vl.hero_photo_path
    from vendor_landings vl
    join auth.users au on au.id = vl.owner_user_id
    where vl.hero_photo_path is not null
    order by lower(au.email), vl.landing_updated_at desc nulls last,
             vl.created_at desc nulls last
  )
  select
    va.id,
    va.business_name,
    va.category,
    va.city,
    va.about,
    va.website,
    va.instagram,
    va.facebook,
    lpe.hero_photo_path,
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
