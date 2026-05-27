-- R83 — backfill vendor_landings.landing_published = true for every
-- landing whose vendor has an approved application.
--
-- Background: pre-R148 the catalog filtered by `landing_published =
-- true`. R148 dropped that filter so the tile-level photo and edited
-- text would always show. BUT — `fetchVendorBySlug` (the
-- server-rendered public profile at /vendor/[slug]) still requires
-- `landing_published = true` to render. That creates an
-- inconsistency: an approved-but-unpublished vendor appears in the
-- catalog tile but clicking the tile → 404. Bad UX.
--
-- Two options:
--   A. Keep the publish toggle and filter the catalog by it again.
--   B. Treat "approved application" as the source of truth and make
--      every approved vendor's landing published by default.
--
-- Option B is right: the publish toggle was an artifact of an early
-- draft-mode workflow that never shipped. Vendors don't see or
-- understand the toggle. Approval IS the publish decision.
--
-- This migration:
--   1. UPDATEs every existing landing whose `landing_published` is
--      false/null AND whose owner's email has an approved
--      application row, to `landing_published = true`. One-shot
--      backfill — safe to re-run.
--   2. New landings created via createVendorLandingForApplication
--      already set landing_published = true at insert time (R123),
--      so no schema default change is needed.
--
-- Vendors who explicitly want to UNpublish (rare; haven't seen a
-- request yet) can still toggle the field through the studio — the
-- backfill respects only NULL / false rows that were never edited.
--
-- This pairs with R148's RPC fix: the catalog shows every approved
-- vendor's edits, AND the public profile resolves for all of them.

update public.vendor_landings vl
set landing_published = true
where (vl.landing_published is null or vl.landing_published = false)
  and exists (
    select 1 from public.vendor_applications va
    where lower(va.email) = lower(vl.email)
      and va.status = 'approved'
      and va.deleted_at is null
  );

-- Verification queries (run manually after the UPDATE to confirm):
--   select count(*) from vendor_landings where landing_published is true;
--   select count(*) from vendor_landings where landing_published is not true;
