import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import type { VendorLandingData } from "./types";

/**
 * Vendor Studio — read + analytics helpers (R20 Phase 9).
 *
 * Two entry points:
 *   - `fetchVendorBySlug`  — used SSR-side (the public landing page is RSC).
 *   - `trackPageView` / `trackPageAction` — used from the client only.
 */

/** Builds a public URL for an image in the `vendor-studio` bucket. The path
 *  may contain Hebrew or spaces, both of which need to be percent-encoded
 *  per segment so browsers don't 404 the resulting URL. `encodeURI` would
 *  leave `?` and `#` raw — we split + encode each segment instead. */
export function getVendorPhotoUrl(path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || !path) return "";
  if (path.startsWith("http")) return path;
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/public/vendor-studio/${encoded}`;
}

/**
 * Strip every character a Supabase Storage path can't safely carry through
 * an HTTP URL. Hebrew filenames + spaces lead to subtle 404s; this collapses
 * them to ASCII-safe replacements. Preserves the extension at the end.
 */
export function sanitizeFilename(name: string): string {
  // Split off the extension (last dot, if any) so we can keep it intact.
  const lastDot = name.lastIndexOf(".");
  const stem = lastDot >= 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : "";
  const safeStem = stem
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5);
  const base = safeStem || "photo";
  return safeExt ? `${base}.${safeExt}` : base;
}

/**
 * Server-safe fetch. Builds its own anon client because `getSupabase` only
 * exists on the client. Returns null when the env isn't configured or the
 * slug doesn't resolve to a published landing.
 *
 * `allowUnpublished` is for the client-side owner-preview path — the public
 * SSR route always calls with the default (false) so unpublished drafts
 * stay out of search engines.
 */
export async function fetchVendorBySlug(
  slug: string,
  allowUnpublished = false,
): Promise<VendorLandingData | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const client = createClient(url, anonKey);
  let query = client.from("vendor_landings").select("*").eq("slug", slug);
  if (!allowUnpublished) {
    query = query.eq("landing_published", true);
  }
  const { data, error } = (await query.maybeSingle()) as {
    data: VendorLandingData | null;
    error: { message: string } | null;
  };
  if (error || !data) return null;
  return data;
}

export async function trackPageView(
  vendorId: string,
  source?: string,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const referrer = typeof document !== "undefined" ? document.referrer : "";
  let detectedSource = source ?? "direct";
  if (referrer.includes("google.")) detectedSource = "google";
  else if (referrer.includes("instagram.com")) detectedSource = "instagram";
  else if (referrer.includes("facebook.com")) detectedSource = "facebook";
  else if (referrer.includes("momentum")) detectedSource = "momentum";

  const cookieKey = `mv-${vendorId}`;
  const hasVisited =
    typeof document !== "undefined" && document.cookie.includes(cookieKey);
  if (!hasVisited && typeof document !== "undefined") {
    document.cookie = `${cookieKey}=1; max-age=2592000; path=/; SameSite=Lax`;
  }

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobile = /Mobi|Android/i.test(ua);

  // R97 — surface insert errors instead of swallowing them.
  // R98 — server-side fallback. The direct-Supabase insert can fail
  // for reasons that have nothing to do with our code (ad blocker
  // blocking *.supabase.co, strict corporate CSP, JWT timing race,
  // RLS edge case). If it does, POST to our own `/api/vendors/track`
  // route which inserts with the service-role key — bulletproof.
  // Either path succeeding is enough for the row to land.
  const payload = {
    vendor_id: vendorId,
    source: detectedSource,
    referrer: referrer.slice(0, 200),
    device_type: isMobile ? "mobile" : "desktop",
    is_unique: !hasVisited,
  };
  const { error } = await supabase
    .from("vendor_page_views")
    .insert(payload as unknown as never);
  if (error) {
    console.warn(
      "[trackPageView] direct insert failed, trying server fallback:",
      error.message,
    );
    try {
      await fetch("/api/vendors/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "view",
          vendorId,
          source: detectedSource,
          referrer: referrer.slice(0, 200),
          deviceType: isMobile ? "mobile" : "desktop",
          isUnique: !hasVisited,
        }),
        keepalive: true,
      });
    } catch (fallbackErr) {
      console.error("[trackPageView] server fallback also failed:", fallbackErr);
    }
  }
}

export async function trackPageAction(
  vendorId: string,
  actionType: string,
): Promise<void> {
  // R136 — route through `/api/vendors/track` as the PRIMARY path.
  //
  // Previously this did a direct Supabase insert first and only fell
  // back to the route when the direct insert failed. The direct
  // insert succeeded for ANY vendor.id (the table has no foreign key
  // on vendor_id), which silently short-circuited the route's R135
  // canonical-UUID resolution AND the R134 lead-row side-effect.
  // Result: no leads ever, and analytics rows landed under the wrong
  // key for synthesized landings whose `vendor.id` is the application
  // UUID rather than the landing UUID. Routing every action through
  // the API guarantees both:
  //   • `vendor_page_actions.vendor_id` = canonical landing UUID
  //     (so the analytics dashboard's `eq(landingRow.id)` query
  //     finds the rows)
  //   • `vendor_leads` gets a new row on every `whatsapp` action
  //     (so the leads dashboard sees the click)
  //
  // Direct Supabase insert is kept as a last-resort fallback for
  // environments where the API path is blocked (very rare on same-
  // origin requests).
  try {
    const res = await fetch("/api/vendors/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "action",
        vendorId,
        actionType,
      }),
      keepalive: true,
    });
    if (res.ok) return;
    console.warn(
      "[trackPageAction] route returned non-ok, trying direct insert:",
      res.status,
    );
  } catch (e) {
    console.warn(
      "[trackPageAction] route call threw, trying direct insert:",
      e,
    );
  }
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("vendor_page_actions").insert({
    vendor_id: vendorId,
    action_type: actionType,
  } as unknown as never);
  if (error) {
    console.error("[trackPageAction] both paths failed:", error.message);
  }
}
