"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Home, ArrowRight, Briefcase } from "lucide-react";
import { STORAGE_KEYS } from "@/lib/storage-keys";

/**
 * R81-12 / R143 — Custom Hebrew 404 page, now vendor-aware.
 *
 * Pre-R143: every visitor saw "חזרה לדשבורד → /dashboard". For a
 * vendor that route immediately bounced them via useVendorRedirect to
 * /vendors/dashboard. Combined with the SSR redirect on "/", a vendor
 * who hit any 404 (a broken /vendor/[slug] link, a stale page) and
 * clicked "Home" felt trapped: 404 → / → /dashboard → /vendors/dashboard.
 *
 * Now: we client-side peek at the cached vendor context (set by
 * useVendorContext on every successful auth check) and target the
 * right dashboard directly. Hosts still go to /dashboard.
 *
 * No JS = no peek. Server-rendered fallback links to /dashboard,
 * which still self-corrects via useVendorRedirect — but vendors who
 * have JS get the right link on first paint.
 */

interface CachedVendorContext {
  isVendor?: boolean;
  lastChecked?: number;
}

export default function NotFound() {
  // Read the vendor cache once on mount, via a lazy initializer so
  // no setState fires inside an effect (React 19 lint rule). We don't
  // import from lib/useVendorContext because the 404 page is
  // intentionally light — we don't want to drag in Supabase client +
  // all the deps just to pick a CTA. localStorage read is enough.
  const [isVendor] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.vendorContext);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as CachedVendorContext;
      return !!parsed.isVendor;
    } catch {
      return false;
    }
  });

  const dashboardHref = isVendor ? "/vendors/dashboard" : "/dashboard";
  const dashboardLabel = isVendor ? "חזרה לדשבורד הספק" : "חזרה לדשבורד";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 relative overflow-hidden text-center">
      <div
        aria-hidden
        className="glow-orb glow-orb-gold w-[600px] h-[600px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-25"
      />

      <div className="relative z-10 max-w-md">
        <div className="flex justify-center mb-7">
          <Logo size={28} />
        </div>

        <div className="card-gold p-8">
          <div className="text-6xl font-extrabold gradient-gold ltr-num">404</div>
          <h1 className="mt-3 text-2xl font-bold gradient-text">
            הדף שביקשת לא נמצא
          </h1>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: "var(--foreground-soft)" }}
          >
            ייתכן שהקישור פג, נמחק או מעולם לא היה. אפשר לחזור לעמוד
            הבית ולהמשיך מהמסע.
          </p>

          {/* R143 — single primary CTA back to the user's dashboard
              (vendor or host). Pre-R143 the secondary "דף הבית" link
              went to "/", which for signed-in users triggers the SSR
              redirect → /dashboard → useVendorRedirect → vendor
              dashboard. Three redirects to end up exactly where the
              primary button already points; redundant. Removed. */}
          <div className="mt-6 flex justify-center">
            <Link
              href={dashboardHref}
              className="btn-gold inline-flex items-center justify-center gap-2 text-sm"
              style={{ minHeight: 44 }}
            >
              {isVendor ? (
                <Briefcase size={14} aria-hidden />
              ) : (
                <Home size={14} aria-hidden />
              )}
              {dashboardLabel}
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
