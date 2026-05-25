"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "./supabase";
import { STORAGE_KEYS } from "./storage-keys";
import type { VendorLandingData } from "./types";

/**
 * Vendor identity for the signed-in user.
 *
 * "Is this signed-in user the owner of any vendor_landings row?"
 * — drives every vendor-side routing decision (sidebar visibility,
 * /dashboard ↔ /vendors/dashboard redirect, "you have a vendor profile"
 * banners).
 *
 * Caches the answer in module scope + localStorage so we don't re-hit
 * Supabase on every Header/Sidebar mount. The cache stores the slug too,
 * because navigating between vendor pages needs it without a re-fetch.
 */

/** R114 — surface the vendor's application status separately from
 *  `isVendor`. A user who submitted /vendors/join but hasn't been
 *  approved yet has `isVendor: false` (no vendor_landings row) but
 *  `applicationStatus: "pending"` — useful so the dashboard can show
 *  a "waiting for review" screen instead of a "no profile" empty
 *  state. */
export type VendorApplicationStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected";

export interface VendorApplicationInfo {
  status: VendorApplicationStatus;
  businessName?: string;
  category?: string;
  submittedAt?: string;
  rejectionReason?: string;
}

interface VendorContextValue {
  isVendor: boolean;
  vendorLanding: VendorLandingData | null;
  /** Most recent vendor_applications row that matches this user's email,
   *  or `{ status: "none" }` when they never applied. */
  application: VendorApplicationInfo;
  /** True once we've made the first server check (vs. just the cache). */
  hasPaidTier: boolean;
  isLoading: boolean;
}

interface CachedContext {
  isVendor: boolean;
  vendorSlug: string | null;
  lastChecked: number;
}

let moduleCache: CachedContext | null = null;
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes — short enough that a freshly
                                  // created landing is reflected within a
                                  // page refresh, long enough to not spam
                                  // the DB on every navigation.

function readCache(): CachedContext | null {
  if (moduleCache) return moduleCache;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.vendorContext);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedContext;
    if (!parsed.lastChecked || Date.now() - parsed.lastChecked > CACHE_TTL_MS) {
      return null;
    }
    moduleCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(c: CachedContext) {
  moduleCache = c;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.vendorContext, JSON.stringify(c));
  } catch {
    // localStorage full / disabled — module cache is enough for the session.
  }
}

/** Clear the vendor context — call from signOut paths so the next render
 *  doesn't show stale vendor UI for a now-anonymous user. */
export function clearVendorContextCache() {
  moduleCache = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.vendorContext);
  } catch {}
}

export function useVendorContext(): VendorContextValue {
  // R14 bugfix — lazy initializer so localStorage parsing only happens
  // on mount (was firing on every render). The non-lazy form re-parsed
  // ~50 times per session navigation, showing up as visible jank on the
  // home page where Header re-renders on theme/scroll changes.
  const [isVendor, setIsVendor] = useState<boolean>(
    () => readCache()?.isVendor ?? false,
  );
  const [vendorLanding, setVendorLanding] = useState<VendorLandingData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // hasPaidTier reads price_range from the landing — "premium" / "luxury"
  // tiers unlock advanced dashboard features (TODO: gate behind real
  // payments once Stripe is wired in).
  const [hasPaidTier, setHasPaidTier] = useState<boolean>(false);
  const [application, setApplication] = useState<VendorApplicationInfo>({
    status: "none",
  });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // R14 bugfix — short-circuit anonymous users via getSession()
        // (a synchronous local-storage check) instead of getUser() (a
        // network round-trip to /auth/v1/user). The home page is the
        // hottest page in the app; an unauthenticated visitor was
        // paying for a vendor-id lookup they never needed.
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session?.user) {
          setIsVendor(false);
          setVendorLanding(null);
          setHasPaidTier(false);
          writeCache({ isVendor: false, vendorSlug: null, lastChecked: Date.now() });
          return;
        }

        // R114 — fetch both in parallel: the landing (source of truth
        // for "approved vendor"), and the most recent application row
        // matching this user's email (lets us show "pending review" UI
        // for applicants who haven't been approved yet).
        //
        // R122 — explicit `.ilike("email", ...)` filter is defense in
        // depth: even though RLS already gates by email, an explicit
        // filter (a) makes the query plan obvious, (b) fails closed
        // if RLS ever misconfigures, (c) is case-insensitive so a
        // legacy row inserted before the apply route normalized to
        // lowercase still matches. The `??` falls back to literal
        // "" so the chain still type-checks for an authenticated user
        // (whose email is always set).
        const userEmail = (session.user.email ?? "").trim().toLowerCase();
        const [landingRes, appRes] = await Promise.all([
          supabase
            .from("vendor_landings")
            .select("*")
            .eq("owner_user_id", session.user.id)
            .maybeSingle(),
          supabase
            .from("vendor_applications")
            .select("status, business_name, category, created_at, rejection_reason")
            .ilike("email", userEmail)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        const data = landingRes.data as VendorLandingData | null;
        const appRow = appRes.data as {
          status?: string;
          business_name?: string;
          category?: string;
          created_at?: string;
          rejection_reason?: string;
        } | null;

        if (cancelled) return;
        const found = !!data;
        setIsVendor(found);
        setVendorLanding(data);
        setHasPaidTier(
          !!data &&
            (data.price_range === "premium" || data.price_range === "luxury"),
        );
        // Map the row → typed application status. If no row exists,
        // the user never applied; default to "none".
        if (appRow && appRow.status) {
          const s = appRow.status;
          const status: VendorApplicationStatus =
            s === "approved" || s === "pending" || s === "rejected"
              ? s
              : "none";
          setApplication({
            status,
            businessName: appRow.business_name,
            category: appRow.category,
            submittedAt: appRow.created_at,
            rejectionReason: appRow.rejection_reason,
          });
        } else {
          setApplication({ status: "none" });
        }
        writeCache({
          isVendor: found,
          vendorSlug: data?.slug ?? null,
          lastChecked: Date.now(),
        });
      } catch (e) {
        // Soft failure — UI just doesn't show vendor surfaces.
        console.error("[useVendorContext]", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isVendor, vendorLanding, application, hasPaidTier, isLoading };
}
