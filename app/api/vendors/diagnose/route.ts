import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * R99 — vendor analytics diagnostic.
 *
 * Hit `GET /api/vendors/diagnose?slug=matami-sharvit-xxxxx` (or
 * `?slug=app-<uuid>`) to see EVERYTHING the catalog/analytics
 * pipeline knows about a vendor:
 *
 *   - which template renders for this slug (auto vs studio)
 *   - whether a real vendor_landings row exists
 *   - what owner_user_id is on it (so we can compare against the
 *     vendor's auth.uid when signing in to the dashboard)
 *   - last 5 vendor_page_views rows (both UUID + slug keyed)
 *   - last 5 vendor_page_actions rows
 *   - lead count + last 3 leads
 *
 * No auth required — returns only public-safe data + ids. Used
 * for debugging the vendor analytics pipeline; can be removed
 * once the pipeline stabilizes.
 */

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  // ─── Find the landing row ─────────────────────────────────
  // R142 + R148 allow a slug to map to either a vendor_landings.slug
  // (preferred) OR an application_id (auto landing). Try landing first.
  const { data: landingRow } = (await supabase
    .from("vendor_landings")
    .select("id, slug, name, email, owner_user_id, landing_published, landing_updated_at, created_at")
    .eq("slug", slug)
    .maybeSingle()) as {
    data: {
      id: string;
      slug: string;
      name: string;
      email: string | null;
      owner_user_id: string | null;
      landing_published: boolean | null;
      landing_updated_at: string | null;
      created_at: string | null;
    } | null;
  };

  // ─── If no landing by slug, see if it's an auto slug ──────
  type AppShape = {
    id: string;
    business_name: string;
    email: string;
    status: string;
    approved_vendor_id: string | null;
  };
  let applicationRow: AppShape | null = null;
  if (!landingRow && slug.startsWith("app-")) {
    const appId = slug.slice(4);
    const { data } = (await supabase
      .from("vendor_applications")
      .select("id, business_name, email, status, approved_vendor_id")
      .eq("id", appId)
      .maybeSingle()) as { data: AppShape | null };
    applicationRow = data;
  }

  // ─── For analytics queries we need the landing UUID. If we
  //     only have an application, look up the matching landing
  //     by email (R99 redirect logic). ────────────────────────
  let landingId: string | null = landingRow?.id ?? null;
  let canonicalSlug: string | null = landingRow?.slug ?? null;
  if (!landingId && applicationRow?.email) {
    const { data: byEmail } = (await supabase
      .from("vendor_landings")
      .select("id, slug")
      .ilike("email", applicationRow.email)
      .order("landing_updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()) as { data: { id: string; slug: string } | null };
    if (byEmail) {
      landingId = byEmail.id;
      canonicalSlug = byEmail.slug;
    }
  }

  if (!landingId && !applicationRow) {
    return NextResponse.json(
      {
        slug,
        found: false,
        note: "no vendor_landings row for this slug AND no vendor_applications row.",
      },
      { status: 404 },
    );
  }

  // ─── Page views — query by BOTH the landing UUID and the slug
  //     so we see rows that landed under either convention. ─
  const queryIds = [landingId, canonicalSlug ?? slug, applicationRow?.id].filter(
    (v): v is string => !!v,
  );

  const [viewsRes, actionsRes, leadsRes] = await Promise.all([
    supabase
      .from("vendor_page_views")
      .select("id, vendor_id, viewed_at, source, device_type, is_unique")
      .in("vendor_id", queryIds)
      .order("viewed_at", { ascending: false })
      .limit(5),
    supabase
      .from("vendor_page_actions")
      .select("id, vendor_id, action_type, action_at")
      .in("vendor_id", queryIds)
      .order("action_at", { ascending: false })
      .limit(5),
    supabase
      .from("vendor_leads")
      .select("id, vendor_id, couple_name, status, source, created_at")
      .in("vendor_id", queryIds)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  // Total counts (no row caps — small queries, the user wants the
  // big number, not a sample).
  const [viewsCount, actionsCount, leadsCount] = await Promise.all([
    supabase
      .from("vendor_page_views")
      .select("id", { count: "exact", head: true })
      .in("vendor_id", queryIds),
    supabase
      .from("vendor_page_actions")
      .select("id", { count: "exact", head: true })
      .in("vendor_id", queryIds),
    supabase
      .from("vendor_leads")
      .select("id", { count: "exact", head: true })
      .in("vendor_id", queryIds),
  ]);

  return NextResponse.json({
    slug,
    found: true,
    // R108 — both branches now render through VendorLandingClient
    // (the auto branch synthesizes a landing in memory). The label
    // documents which data source drives the page.
    template: landingRow
      ? "studio (VendorLandingClient ← real landing)"
      : "studio (VendorLandingClient ← synthesized from application)",
    landing: landingRow,
    application: applicationRow,
    canonical_slug: canonicalSlug,
    canonical_landing_id: landingId,
    query_keys_used: queryIds,
    totals: {
      views: viewsCount.count ?? 0,
      actions: actionsCount.count ?? 0,
      leads: leadsCount.count ?? 0,
    },
    recent: {
      views: viewsRes.data ?? [],
      actions: actionsRes.data ?? [],
      leads: leadsRes.data ?? [],
    },
    diagnostics: {
      analytics_will_show:
        landingId !== null
          ? `Yes — analytics page queries vendor_page_views by vendor_id = '${landingId}'`
          : "No — no canonical landing UUID found; analytics will be empty.",
      next_step:
        landingRow && (viewsCount.count ?? 0) === 0
          ? "Visit /vendor/" + canonicalSlug + " in incognito; refresh /vendors/dashboard/analytics."
          : "Data looks healthy. If dashboard still shows 0, hard-refresh (Cmd+Shift+R).",
    },
  });
}
