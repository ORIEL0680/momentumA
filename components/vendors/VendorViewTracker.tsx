"use client";

import { useEffect, useRef } from "react";
import { trackPageView } from "@/lib/vendorStudio";

/**
 * R99 — minimal client-side page-view tracker that mounts INSIDE the
 * `/vendor/[slug]` page regardless of which template renders.
 *
 * Pre-R99 the tracker call lived inside `VendorLandingClient` only,
 * so auto-landed URLs (`/vendor/app-<uuid>`) — which use the
 * server-only `VendorAutoLanding` template — recorded zero views.
 * R99 already redirects most auto URLs to the canonical slug, but
 * for the remaining cases (vendors with an application but no
 * landing yet) we still want to capture the view.
 *
 * The `trackPageView` helper has its own dedup ref (cookie-based)
 * so mounting two trackers on the same page doesn't double-count.
 *
 * Side-effect only — renders nothing.
 */
export function VendorViewTracker({ vendorId }: { vendorId: string }) {
  const trackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!vendorId) return;
    if (trackedRef.current === vendorId) return;
    trackedRef.current = vendorId;
    void trackPageView(vendorId);
  }, [vendorId]);
  return null;
}
