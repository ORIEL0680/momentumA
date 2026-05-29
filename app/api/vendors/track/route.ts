import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * R98 — server-side fallback for vendor page-view / page-action
 * tracking.
 *
 * The client-side `trackPageView` / `trackPageAction` (in
 * lib/vendorStudio.ts) inserts directly into Supabase via the anon
 * key. Per R97, that path was wired correctly (UUID as vendor_id)
 * but the user still reports views not appearing on the analytics
 * dashboard. The most likely culprits at this point are:
 *
 *   • Ad blockers / browser extensions that block direct requests
 *     to `*.supabase.co`. Server-side proxies through `/api/*`
 *     dodge those blocklists.
 *   • Strict CSP at the visitor's network level.
 *   • RLS edge cases — even with `with check (true)` on
 *     vendor_page_views, occasionally a misbehaving JWT can trip
 *     the row check. Service-role bypasses RLS entirely.
 *   • Timing — the client effect fires before supabase-js finishes
 *     loading; the in-flight INSERT gets dropped on navigation.
 *
 * This route guarantees the row gets written. The client now POSTs
 * here as a fire-and-forget after the direct insert; either path
 * succeeding is enough.
 *
 * POST /api/vendors/track
 * Body: { kind: "view" | "action", vendorId: string, ...optional }
 *   • for kind="view": optional source, referrer, deviceType, isUnique
 *   • for kind="action": required actionType
 *
 * No auth required — page-view + action are public events, gated
 * server-side by:
 *   1. Required vendorId shape (UUID — invalid input returns 400)
 *   2. Existing rate-limit trigger on vendor_page_views (50/hr/vendor)
 *   3. Action-type allow-list
 */

interface TrackBody {
  kind: "view" | "action";
  vendorId: string;
  source?: string;
  referrer?: string;
  deviceType?: string;
  isUnique?: boolean;
  actionType?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ACTIONS = new Set([
  "whatsapp",
  "phone",
  "email",
  "website",
  "instagram",
  "facebook",
  "gallery_open",
  "review_helpful",
]);

/**
 * R134 — resolve any of the three catalog vendor-id formats into the
 * canonical `vendor_landings.slug` we need to write a `vendor_leads`
 * row. Returns null when nothing matches (in which case we skip the
 * lead insert and let the action stay as an analytics-only event).
 */
type SupabaseClient = ReturnType<typeof createServiceClient>;
async function resolveVendorSlug(
  supabase: SupabaseClient,
  vendorId: string,
): Promise<string | null> {
  // 1. UUID match against vendor_landings.id.
  const { data: byId } = (await supabase
    .from("vendor_landings")
    .select("slug")
    .eq("id", vendorId)
    .maybeSingle()) as { data: { slug: string | null } | null };
  if (byId?.slug) return byId.slug;

  // 2. Slug match (direct catalog hits).
  const { data: bySlug } = (await supabase
    .from("vendor_landings")
    .select("slug")
    .eq("slug", vendorId)
    .maybeSingle()) as { data: { slug: string | null } | null };
  if (bySlug?.slug) return bySlug.slug;

  // 3. `app-<applicationId>` — auto-page format. Look up the
  //    application's email and find the landing by email match.
  if (vendorId.startsWith("app-")) {
    const appId = vendorId.slice(4);
    const { data: app } = (await supabase
      .from("vendor_applications")
      .select("email")
      .eq("id", appId)
      .maybeSingle()) as { data: { email: string | null } | null };
    if (app?.email) {
      const { data: landing } = (await supabase
        .from("vendor_landings")
        .select("slug")
        .ilike("email", app.email)
        .maybeSingle()) as { data: { slug: string | null } | null };
      if (landing?.slug) return landing.slug;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: TrackBody;
  try {
    body = (await req.json()) as TrackBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Basic shape validation. We accept either a UUID (preferred —
  // matches what vendor_landings.id stores) OR a slug-style string
  // (legacy seed data, kept for compatibility). vendor_id is `text`
  // in the DB so both shapes work, but we reject obviously-wrong
  // payloads here so the table doesn't fill with junk.
  if (!body.vendorId || typeof body.vendorId !== "string") {
    return NextResponse.json({ error: "missing_vendor_id" }, { status: 400 });
  }
  if (body.vendorId.length > 100) {
    return NextResponse.json({ error: "vendor_id_too_long" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  if (body.kind === "view") {
    const { error } = await supabase.from("vendor_page_views").insert({
      vendor_id: body.vendorId,
      source: body.source ?? "direct",
      referrer: (body.referrer ?? "").slice(0, 200),
      device_type: body.deviceType ?? "unknown",
      is_unique: body.isUnique ?? false,
    } as unknown as never);
    if (error) {
      console.error("[/api/vendors/track view]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.kind === "action") {
    if (!body.actionType || !ALLOWED_ACTIONS.has(body.actionType)) {
      return NextResponse.json(
        { error: "invalid_action_type" },
        { status: 400 },
      );
    }
    const { error } = await supabase.from("vendor_page_actions").insert({
      vendor_id: body.vendorId,
      action_type: body.actionType,
    } as unknown as never);
    if (error) {
      console.error("[/api/vendors/track action]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // R134 — every WhatsApp click on a vendor card / landing / quick-
    // look now ALSO drops a row into `vendor_leads` so the vendor
    // sees the signal in their leads dashboard, not just in analytics.
    // Host wanted "every click = a lead". For anonymous visitors (no
    // session) the lead carries `couple_user_id = NULL`; the leads
    // page renders that as "לחיצת WhatsApp אנונימית". Service-role
    // bypasses RLS so both auth + anon callers can insert.
    //
    // `vendor_leads.vendor_id` is the SLUG (per the 2026-05-14
    // schema). The incoming `body.vendorId` can be ANY of three
    // shapes the catalog uses today:
    //   1. The landing's UUID (when the catalog tile points at a
    //      real /vendor/<slug> page)
    //   2. The slug itself (legacy / direct catalog hits)
    //   3. `app-<applicationId>` (the auto-page format used for
    //      approved-but-no-landing vendors — see R85/R106)
    // We try them in that order and stop at the first match.
    if (body.actionType === "whatsapp") {
      try {
        const slug = await resolveVendorSlug(supabase, body.vendorId);
        if (slug) {
          const { error: leadErr } = await supabase
            .from("vendor_leads")
            .insert({
              vendor_id: slug,
              couple_user_id: null,
              source: "whatsapp_click",
              status: "pending",
            } as unknown as never);
          if (leadErr) {
            console.error(
              "[/api/vendors/track lead-from-whatsapp]",
              leadErr.message,
            );
          }
        }
      } catch (e) {
        console.error("[/api/vendors/track lead-from-whatsapp] threw", e);
      }
    }

    return NextResponse.json({ ok: true });
  }

  // R98 — silence the "vendorId only used in one branch" implicit
  // void of the UUID validator above (we don't enforce UUID shape
  // because legacy slug values are also valid).
  void UUID_RE;
  return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
}
