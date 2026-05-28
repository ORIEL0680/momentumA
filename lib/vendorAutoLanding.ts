/**
 * R85 (R67 fix) — server-only loader for the auto-generated mini
 * landing page that's rendered for every approved vendor application.
 *
 * Two kinds of vendor pages exist in the app:
 *
 *   1. SELF-BUILT landings — vendor signs up, runs through
 *      /dashboard/vendor-studio, picks a template + uploads photos +
 *      writes copy → row in `vendor_landings` with a chosen `slug`.
 *      Served by the existing /vendor/[slug] route + VendorLandingClient.
 *
 *   2. AUTO landings — every approved application gets one for free
 *      under /vendor/app-<uuid>. Reads from `vendor_applications`
 *      via the service-role key so the route doesn't depend on the
 *      admin-only SELECT policy that protects PII on that table.
 *      We then return ONLY public-safe columns (no business_id /
 *      ip_address / user_agent / email).
 *
 * Both kinds funnel through /vendor/[slug]/page.tsx — the page just
 * detects the `app-` prefix and calls this loader.
 */

import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/** Shape returned to the renderer. */
export interface VendorAutoLandingRow {
  id: string;
  business_name: string;
  contact_name: string;
  phone: string;
  city: string | null;
  category: string;
  about: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  sample_work_url: string | null;
  years_in_field: number;
  created_at: string;
}

const APP_SLUG_PREFIX = "app-";

export function isAutoLandingSlug(slug: string): boolean {
  return slug.startsWith(APP_SLUG_PREFIX);
}

export function applicationIdFromSlug(slug: string): string | null {
  if (!isAutoLandingSlug(slug)) return null;
  const id = slug.slice(APP_SLUG_PREFIX.length);
  // UUID v4 shape — `/vendor/app-evil` never reaches the DB.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return id;
}

/**
 * Fetch one approved vendor by its application id. Service-role under
 * the hood so RLS doesn't block. Only returns columns that are safe to
 * render publicly — business_id, ip_address, user_agent, email are
 * dropped here so a UI mistake can't leak them.
 */
export async function fetchApprovedApplication(
  slugOrId: string,
): Promise<VendorAutoLandingRow | null> {
  const id = isAutoLandingSlug(slugOrId)
    ? applicationIdFromSlug(slugOrId)
    : slugOrId;
  if (!id) return null;

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return null;
  }

  const { data, error } = (await supabase
    .from("vendor_applications")
    .select(
      "id, business_name, contact_name, phone, city, category, about, website, instagram, facebook, sample_work_url, years_in_field, created_at, status, deleted_at",
    )
    .eq("id", id)
    .maybeSingle()) as {
    data:
      | (VendorAutoLandingRow & { status: string; deleted_at: string | null })
      | null;
    error: { message: string } | null;
  };
  if (error || !data) return null;
  // Only approved + not soft-deleted is publicly viewable.
  if (data.status !== "approved" || data.deleted_at) return null;

  return {
    id: data.id,
    business_name: data.business_name,
    contact_name: data.contact_name,
    phone: data.phone,
    city: data.city,
    category: data.category,
    about: data.about,
    website: data.website,
    instagram: data.instagram,
    facebook: data.facebook,
    sample_work_url: data.sample_work_url,
    years_in_field: data.years_in_field,
    created_at: data.created_at,
  };
}

/**
 * R99 / R101 — service-role lookup: given an application id, find
 * the matching `vendor_landings` row by email and return the
 * landing's `{ id, slug, published }` triple.
 *
 * R101: the previous R99/R100 version was used to drive a server-
 * side redirect from `/vendor/app-<uuid>` to `/vendor/<canonical-slug>`.
 * That redirect chained a 404 in some configurations and is no
 * longer attempted. The helper is kept (renamed
 * `findLandingForApplication`) and used purely to inform the
 * client-side `<VendorViewTracker>` of the canonical landing UUID
 * — so analytics records visits to auto-landing URLs against the
 * correct vendor_id even when no redirect happens.
 *
 * Returns null when no landing exists for this application's
 * email — caller passes the application id to the tracker as a
 * fallback (less useful for analytics, but the row is logged for
 * future backfill).
 */
export async function findLandingForApplication(
  applicationId: string,
): Promise<{ id: string; slug: string | null; published: boolean } | null> {
  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return null;
  }

  // Step 1: get the application's email (needed for the join).
  const { data: appRow } = (await supabase
    .from("vendor_applications")
    .select("email")
    .eq("id", applicationId)
    .maybeSingle()) as { data: { email: string } | null };
  if (!appRow?.email) return null;

  // Step 2: find a vendor_landings row matching this application's
  // email. R142's orphan-adoption sets owner_user_id; before that
  // we matched by email alone. Use the most-recently-updated row
  // when several exist (legacy data has duplicates).
  //
  // R101 — return regardless of `landing_published`. The caller
  // (the page tracker) uses the id to log views to the right
  // vendor_id; the published flag is informational only.
  const { data: landingRow } = (await supabase
    .from("vendor_landings")
    .select("id, slug, landing_published")
    .ilike("email", appRow.email)
    .order("landing_updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as {
    data: { id: string; slug: string | null; landing_published: boolean | null } | null;
  };

  if (!landingRow) return null;
  return {
    id: landingRow.id,
    slug: landingRow.slug ?? null,
    published: landingRow.landing_published === true,
  };
}
