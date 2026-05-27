# R86 — Vendor Image System (logo + cover + gallery)

Date: 2026-05-28
Build: `next build` ✓ · `tsc --noEmit` ✓ · `eslint` ✓

---

## Step 0 — What we actually have (vs. the spec)

Static audit of the live schema + storage + code paths revealed the
spec's table / bucket / column names don't match the codebase:

| Spec | Actual | Conclusion |
|------|--------|------------|
| Table `vendor_profiles` | **`vendor_landings`** | Use the real table |
| Bucket `vendor-assets` | **`vendor-studio`** | Use the real bucket |
| `logo_url` + `cover_image_url` columns | Didn't exist — a single `hero_photo_path` doubled as both | **Add the columns; keep legacy field for backward compat** |
| `gallery_urls` text[] | Exists as `gallery_paths` text[] | Reuse |

So "מטעמי שרביט הוסיף תמונות ולוגו → הקטלוג ודף הנחיתה לא מציגים אותם"
was almost certainly a **cache + single-field-overloading** issue, not
a missing-record issue:

- The vendor's upload went to `hero_photo_path` correctly.
- The catalog RPC `list_approved_vendors` returns `hero_photo_path` →
  catalog tile renders it (since R148 RPC + R83 publish backfill).
- The public page `/vendor/[slug]` renders `hero_photo_path` as the
  full-bleed hero background.
- **But:** the SSR page response was being served from CDN cache with
  no `revalidate` directive — a fresh upload didn't surface until
  the response naturally expired. AND the single field couldn't
  visually distinguish "tile thumbnail" from "page background".

---

## What R86 ships

### 1. Migration: `2026-05-28-vendor-images.sql`

Adds three columns to `vendor_landings`:

| Column | Type | Purpose |
|--------|------|---------|
| `logo_url` | text | Brand mark; rendered as overlay logo on the public page hero |
| `cover_image_url` | text | Full-bleed background of the public page hero |
| `image_updated_at` | timestamptz | Auto-bumped by `trg_vendor_images_touch` whenever any image field changes — used as `?v=` cache-buster |

Trigger `trg_vendor_images_touch` (BEFORE UPDATE) recomputes
`image_updated_at` whenever any of `logo_url`, `cover_image_url`,
`hero_photo_path`, or `gallery_paths` changes. Legacy uploads (which
only touch `hero_photo_path`) still drive the cache-buster.

Migration also recreates the `list_approved_vendors` RPC to surface
the three new columns to the catalog. Backward compatible: all-new
columns are nullable + the COALESCE pattern from R148/R83 is
preserved for the text fields.

Index on `image_updated_at` for "sort by recent visual edits".

### 2. Type updates

`VendorLandingData` (in `lib/types.ts`) gains `logo_url`,
`cover_image_url`, `image_updated_at`.

`ApprovedVendorRow` (in `lib/approvedVendors.ts`) gains the same
three as optional (so the type still type-checks against a
pre-migration DB).

`mapApprovedRowToVendor` now picks the photo to display in the
catalog tile with this priority:
`cover_image_url > logo_url > hero_photo_path`
and appends `?v=` from `image_updated_at` (or `created_at` fallback).

### 3. LuxuriousTemplate renderer

Pre-R86: a single `heroImg = getVendorPhotoUrl(hero_photo_path)`
filled both the full-bleed background AND any logo overlay.

Post-R86:
- `coverImg` = `cover_image_url > hero_photo_path` (background)
- `logoImg` = `logo_url` (overlay)
- Both go through a `bust(url)` helper that appends `?v=` from
  `image_updated_at`
- Logo only renders when set AND distinct from cover (no
  duplicate-image redundancy)

New: a premium gold-ringed logo overlay tile (88px) sits top-center
of the hero with a `drop-shadow(0 8px 24px rgba(0,0,0,.55))` so it
lifts off the cover background.

### 4. Cache invalidation

- `app/vendor/[slug]/page.tsx` gets `export const revalidate = 30` —
  fresh re-render every 30s from the next request hit.
- All image URLs cache-busted with `?v=image_updated_at` so a
  same-path replaced file actually refreshes in the browser.
- `router.refresh()` in vendor-studio save handler (already shipped
  in R84) re-triggers the server fetch immediately for the editor's
  own page.

### 5. NOT in this commit (deferred)

- **Studio editor UI for distinct logo + cover slots.** The
  existing "תמונת פרופיל / לוגו" section in
  `/dashboard/vendor-studio` still saves only to `hero_photo_path`.
  The fallback chain means this still renders correctly (legacy
  `hero_photo_path` flows into both `coverImg` and the catalog
  tile). Vendors who want to use *distinct* images for logo vs.
  cover need either (a) a SQL UPDATE, or (b) a follow-up studio
  redesign that exposes 3 separate upload slots.
- **Storage bucket policy changes** (the spec's RLS policies for
  `vendor-assets`). The real bucket is `vendor-studio` and its
  policies haven't changed since R20; existing upload + public
  read works for every vendor today.

---

## Bug → Fix mapping

| Bug | Fix |
|-----|-----|
| `/vendor/[slug]` served stale photos from CDN cache | `revalidate = 30` directive |
| Browser cached same-path replaced photo | `?v=image_updated_at` query buster |
| One field for logo + cover → vendors couldn't have distinct visuals | Three columns + fallback chain |
| Mapper had hard-coded `hero_photo_path` priority | New `cover_image_url > logo_url > hero_photo_path` chain |

---

## 🎯 Manual Actions for Tal

### 1. Run the new migration in Supabase

**File**: `supabase/migrations/2026-05-28-vendor-images.sql`

It does everything safely (`if not exists`, idempotent recreates):

- adds three nullable columns to `vendor_landings`
- backfills `image_updated_at` from `landing_updated_at` or
  `created_at` for existing rows
- creates the `touch_vendor_image_updated_at()` function +
  `trg_vendor_images_touch` BEFORE-UPDATE trigger
- creates `idx_vendor_landings_image_updated`
- recreates `list_approved_vendors` RPC to return the new fields

Paste into Supabase SQL Editor → Run. Should report "Success. No
rows returned." (and a few "ALTER TABLE" / "CREATE FUNCTION" lines).

### 2. Optional: populate the new fields for מטעמי שרביט

If you want to set a DISTINCT logo + cover for one vendor (instead
of the fallback chain falling back to `hero_photo_path`), run:

```sql
update public.vendor_landings
set
  logo_url        = 'https://YOUR-LOGO-URL.png',
  cover_image_url = 'https://YOUR-COVER-URL.jpg'
where slug ilike 'matami-sharvit-%';
```

Until you do, the catalog tile + public page will keep using
`hero_photo_path` (the single photo you uploaded in studio).

### 3. Hard refresh the catalog after step 1

`Cmd+Shift+R` (or `Ctrl+Shift+R` on Windows) on `/vendors`. The
catalog data is fetched fresh on every mount, but the underlying
RPC response gets re-shaped after the migration, so a hard refresh
ensures the page picks up the new column shape.

---

## Diagnostic — what was actually stored for מטעמי שרביט before R86?

I cannot run live SQL, but the static analysis tells us:

- **`hero_photo_path`**: set (a path under `vendor-studio/{owner_id}/{ts}-*.jpg`)
  if the vendor used the existing "תמונת פרופיל / לוגו" upload slot.
- **`gallery_paths`**: array of paths if gallery items uploaded.
- **`logo_url`** + **`cover_image_url`** + **`image_updated_at`**:
  did not exist as columns until R86's migration.

So the vendor wasn't blocked from uploading — they just had one
field doing two jobs, and the catalog page was being served from
CDN cache with no revalidate signal. R86 unblocks both.

---

## 5-line summary

1. **Before R86**: one `hero_photo_path` column did double duty as
   logo AND cover. Public page had no `revalidate`. Catalog tile
   couldn't show a distinct logo from the page hero.
2. **Critical fix**: `revalidate = 30` on `/vendor/[slug]` + `?v=`
   cache-buster on every image URL. CDN + browser caches now expire
   within 30s of a vendor save.
3. **Schema upgrade**: 1 new migration adds `logo_url`,
   `cover_image_url`, `image_updated_at` + a touch trigger + an
   updated `list_approved_vendors` RPC. Fully backward compatible.
4. **Action for Tal**: run `2026-05-28-vendor-images.sql` in Supabase
   SQL Editor. Existing vendors keep working unchanged via the
   fallback chain; optionally set distinct logo + cover via a single
   SQL UPDATE per vendor (or wait for the studio editor follow-up).
5. **Deferred**: studio editor UI for separate logo + cover upload
   slots. Falls back gracefully via `hero_photo_path`; doesn't block
   shipping the fix.
