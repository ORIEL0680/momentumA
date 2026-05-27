"use client";

import { useCallback, useEffect, useState } from "react";
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
 *
 * R142 — re-runs on auth-state changes (SIGNED_IN / SIGNED_OUT /
 * USER_UPDATED) so a returning vendor who logged in after a previous
 * host session immediately sees vendor UI instead of the stale host
 * cache. Pre-R142, the hook only ran once on mount; signing in after a
 * sign-out kept the previous user's vendor flag forever (until full
 * page refresh), trapping returning vendors in the host nav.
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

/** Clear the vendor context — call from signOut paths (and from the
 *  auth-state listener on SIGNED_IN / SIGNED_OUT) so the next render
 *  doesn't show stale vendor UI for a different user. */
export function clearVendorContextCache() {
  moduleCache = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.vendorContext);
  } catch {
    // ignore
  }
}

export function useVendorContext(): VendorContextValue {
  // R14 bugfix — lazy initializer so localStorage parsing only happens
  // on mount (was firing on every render).
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

  /** R142 — single re-runnable refresh. Called on mount AND on every
   *  auth state change so signing in / out / switching accounts
   *  immediately reflects in the UI without a hard refresh. */
  const refresh = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    try {
      // R14 bugfix — short-circuit anonymous users via getSession()
      // (a synchronous local-storage check) instead of getUser() (a
      // network round-trip to /auth/v1/user). The home page is the
      // hottest page in the app; an unauthenticated visitor was
      // paying for a vendor-id lookup they never needed.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsVendor(false);
        setVendorLanding(null);
        setHasPaidTier(false);
        setApplication({ status: "none" });
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
      // lowercase still matches.
      const userEmail = (session.user.email ?? "").trim().toLowerCase();
      const [landingRes, appRes] = await Promise.all([
        supabase
          .from("vendor_landings")
          .select("*")
          .eq("owner_user_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("vendor_applications")
          .select(
            "status, business_name, category, created_at, rejection_reason",
          )
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

      let found = !!data;
      let landing = data;

      const appStatus: VendorApplicationStatus =
        appRow?.status === "approved" ||
        appRow?.status === "pending" ||
        appRow?.status === "rejected"
          ? appRow.status
          : "none";

      // R123 — self-provision the landing if the application is
      // approved but no landing row exists yet. This covers the
      // common case of a vendor who filled the form BEFORE signing
      // up to the app: at approval time there was no auth.users
      // row, so the admin route logged "no-auth-user" and skipped
      // landing creation. Now, the moment the vendor opens the
      // dashboard (= first time we have their JWT in this hook),
      // we POST to the server endpoint that lazily creates the
      // landing under service role.
      if (appStatus === "approved" && !landing) {
        try {
          const res = await fetch("/api/vendors/self-provision-landing", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (res.ok) {
            const { data: refreshed } = await supabase
              .from("vendor_landings")
              .select("*")
              .eq("owner_user_id", session.user.id)
              .maybeSingle();
            if (refreshed) {
              landing = refreshed as VendorLandingData;
              found = true;
            }
          }
        } catch (provErr) {
          console.error("[useVendorContext] self-provision failed:", provErr);
        }
      }

      setIsVendor(found);
      setVendorLanding(landing);
      setHasPaidTier(
        !!landing &&
          (landing.price_range === "premium" ||
            landing.price_range === "luxury"),
      );
      if (appRow && appRow.status) {
        setApplication({
          status: appStatus,
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
        vendorSlug: landing?.slug ?? null,
        lastChecked: Date.now(),
      });
    } catch (e) {
      console.error("[useVendorContext]", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    void refresh();

    // R142 — re-check vendor status on every auth state change.
    // Pre-R142, this hook ran ONCE on mount; if a host signed out and
    // a vendor signed in on the same browser without a hard refresh,
    // the vendor saw the host nav forever. SIGNED_IN/OUT/USER_UPDATED
    // all force a cache flush + re-fetch so the UI reflects the new
    // identity within ~200ms.
    const sub = supabase.auth.onAuthStateChange((evt) => {
      if (
        evt === "SIGNED_IN" ||
        evt === "SIGNED_OUT" ||
        evt === "USER_UPDATED"
      ) {
        clearVendorContextCache();
        void refresh();
      }
    });

    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, [refresh]);

  return { isVendor, vendorLanding, application, hasPaidTier, isLoading };
}
