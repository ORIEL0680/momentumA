-- ─── R117 — vendor catalog avatar / logo ─────────────────────────────
-- Extends list_approved_vendors() to also return the vendor's
-- hero_photo_path (uploaded via /dashboard/vendor-studio, stored in the
-- `vendor-studio` Supabase Storage bucket as `<user_id>/<file>`).
--
-- The catalog UI uses this as the "face of the business": a premium
-- gold-bordered avatar on each card. Empty for vendors who haven't
-- uploaded yet — the card falls back to its existing mesh image.
--
-- Match strategy: LEFT JOIN vendor_landings on the auth user's email
-- (case-insensitive). vendor_applications doesn't have a user_id
-- column today; matching by email is the only available bridge.
-- Multiple landings per email are rare (one per user); if it ever
-- happens, the most-recently-updated one wins.
--
-- R118 follow-up — `drop function` first. Postgres rejects
-- `create or replace` when the column list of the returning row
-- type changes (we're adding hero_photo_path), with 42P13. Drop +
-- recreate is the supported migration path.
-- ─────────────────────────────────────────────────────────────────────

drop function if exists list_approved_vendors();

create function list_approved_vendors()
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
  -- Subquery picks the freshest vendor_landings row per email, then we
  -- LEFT JOIN so applications without a landing still show up (with
  -- null photo). DISTINCT ON keeps it to one row per email — Postgres-
  -- idiomatic dedup that avoids window-function ceremony.
  with landing_per_email as (
    select distinct on (lower(au.email))
      lower(au.email)        as email_key,
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
  from vendor_applications va
  left join landing_per_email lpe on lpe.email_key = lower(va.email)
  where va.status = 'approved'
    and va.deleted_at is null
  order by va.created_at desc
  limit 1000;
$$;

grant execute on function list_approved_vendors() to anon, authenticated;
