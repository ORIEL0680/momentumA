import "server-only";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { ApprovedVendorRow } from "@/lib/approvedVendors";

/**
 * R105 — server-side catalog data feed.
 *
 * Replaces the client's previous two-query (RPC + direct
 * vendor_landings select) merge approach. Reasons it had to move
 * server-side:
 *
 *   1. **RLS gates anon reads of unpublished landings.** Even with
 *      R83's backfill, any landing with `landing_published = false`
 *      (intentionally or due to legacy data) was invisible to
 *      anon callers. The client merge silently produced empty
 *      image fields for those vendors.
 *   2. **Name-match was fragile.** The previous client merge
 *      keyed landings by `business_name`. If `landing.name` was
 *      null/empty but `application.business_name` was set, the
 *      RPC returned the application name → no landing key match
 *      → no images merged.
 *   3. **Migration drift.** Whether the user ran the latest RPC
 *      migration (R94 / R103) changed which columns came back.
 *      The client had to defensively handle missing columns.
 *
 * The service-role client used here bypasses RLS and joins
 * applications to landings BY EMAIL — the canonical link. No
 * client-side merge, no RLS surprises, no migration dependency.
 *
 * GET /api/vendors/catalog
 *   Returns: { vendors: ApprovedVendorRow[] }
 *   Cached: false (always fresh — vendor edits surface within
 *   the next page load).
 *
 * No auth required — same public-safe data the `list_approved_vendors`
 * RPC was returning.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { vendors: [], error: "supabase_unavailable" },
      { status: 503 },
    );
  }

  // Step 1: every approved + non-deleted application, sorted the
  // same way the RPC sorted them (featured first, then most
  // recent).
  const { data: apps, error: appsErr } = (await supabase
    .from("vendor_applications")
    .select(
      "id, business_name, category, city, about, website, instagram, facebook, email, created_at, featured_at, featured_rank",
    )
    .eq("status", "approved")
    .is("deleted_at", null)
    .order("featured_at", { ascending: false, nullsFirst: false })
    .order("featured_rank", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(1000)) as {
    data:
      | Array<{
          id: string;
          business_name: string;
          category: string;
          city: string | null;
          about: string | null;
          website: string | null;
          instagram: string | null;
          facebook: string | null;
          email: string;
          created_at: string;
          featured_at: string | null;
          featured_rank: number | null;
        }>
      | null;
    error: { message: string } | null;
  };

  if (appsErr || !apps) {
    return NextResponse.json(
      { vendors: [], error: appsErr?.message ?? "no_data" },
      { status: 500 },
    );
  }

  if (apps.length === 0) {
    return NextResponse.json({ vendors: [] });
  }

  // Step 2: every published-or-not landing keyed by email.
  // Service-role: no RLS filtering. We need the landings even when
  // `landing_published = false` because those vendors' images
  // should still drive their catalog tile (the publish flag was a
  // never-shipped draft-mode concept).
  const emails = Array.from(
    new Set(apps.map((a) => a.email?.toLowerCase().trim()).filter(Boolean)),
  ) as string[];

  const { data: landings } = (await supabase
    .from("vendor_landings")
    .select(
      "name, email, category, city, about_long, tagline, website, instagram, facebook, hero_photo_path, logo_url, cover_image_url, gallery_paths, image_updated_at, service_areas, landing_updated_at, created_at",
    )
    .in("email", emails)) as {
    data:
      | Array<{
          name: string | null;
          email: string | null;
          category: string | null;
          city: string | null;
          about_long: string | null;
          tagline: string | null;
          website: string | null;
          instagram: string | null;
          facebook: string | null;
          hero_photo_path: string | null;
          logo_url: string | null;
          cover_image_url: string | null;
          gallery_paths: string[] | null;
          image_updated_at: string | null;
          service_areas: string[] | null;
          landing_updated_at: string | null;
          created_at: string | null;
        }>
      | null;
  };

  // Bucket landings by email; if multiple exist for one email,
  // pick the most-recently-updated one (legacy data sometimes has
  // orphans).
  const landingByEmail = new Map<string, NonNullable<typeof landings>[number]>();
  for (const l of landings ?? []) {
    if (!l.email) continue;
    const key = l.email.trim().toLowerCase();
    const prev = landingByEmail.get(key);
    if (!prev) {
      landingByEmail.set(key, l);
      continue;
    }
    const prevTs =
      Date.parse(prev.landing_updated_at ?? prev.created_at ?? "") || 0;
    const thisTs = Date.parse(l.landing_updated_at ?? l.created_at ?? "") || 0;
    if (thisTs > prevTs) landingByEmail.set(key, l);
  }

  // Step 3: build the final ApprovedVendorRow shape, COALESCING
  // landing fields over application fields. Same priority as the
  // RPC's WITH-clause logic.
  const trim = (s: string | null | undefined) =>
    s && s.trim().length > 0 ? s.trim() : null;

  const vendors: ApprovedVendorRow[] = apps.map((app) => {
    const landing = landingByEmail.get(app.email.trim().toLowerCase());
    return {
      id: app.id,
      business_name: trim(landing?.name) ?? app.business_name,
      category: trim(landing?.category) ?? app.category,
      city: trim(landing?.city) ?? app.city,
      about: trim(landing?.about_long) ?? app.about,
      tagline: trim(landing?.tagline),
      website: trim(landing?.website) ?? app.website,
      instagram: trim(landing?.instagram) ?? app.instagram,
      facebook: trim(landing?.facebook) ?? app.facebook,
      hero_photo_path: landing?.hero_photo_path ?? null,
      logo_url: landing?.logo_url ?? null,
      cover_image_url: landing?.cover_image_url ?? null,
      gallery_paths: landing?.gallery_paths ?? null,
      image_updated_at: landing?.image_updated_at ?? null,
      service_areas: landing?.service_areas ?? null,
      created_at: app.created_at,
    };
  });

  return NextResponse.json(
    { vendors },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
