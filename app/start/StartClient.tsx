"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PricingTiers } from "@/components/PricingTiers";
import type { CoupleTier } from "@/lib/pricing";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { applyCloudPayload, readEventId } from "@/lib/store";
import type { AppState } from "@/lib/types";

// R12 §3S — centralized; dot separator (was `:`).
const SELECTED_TIER_KEY = STORAGE_KEYS.selectedTier;

/**
 * Pricing gate UI. Owns the selectedTier state, persists it to sessionStorage
 * when the user proceeds, then forwards to /onboarding?gate=ok.
 *
 * R6 #3 + #6 fixes:
 *   - Tier cards are now selectable (radio-like) instead of 3 identical
 *     "המשך" links that all pointed to the same URL.
 *   - The selected tier is saved to sessionStorage so onboarding can use it.
 *   - Footer is rendered for parity with /pricing (was missing).
 */
export function StartClient() {
  const router = useRouter();
  // Default to free — the safest fallback if the user proceeds without
  // explicitly tapping a card.
  const [selectedTier, setSelectedTier] = useState<CoupleTier>("free");
  // R140 — cloud backstop. The page-level inline script only checks
  // localStorage at paint time; a returning user whose `app_states` row
  // exists in the cloud but localStorage is empty would land here even
  // though they already have an event. We do a one-shot Supabase query
  // for THIS user's app_states; if found, hydrate localStorage + redirect
  // to /dashboard. While the check is in flight we render a loader so
  // the user never sees a tier picker they shouldn't.
  const [cloudCheckDone, setCloudCheckDone] = useState(false);
  useEffect(() => {
    if (readEventId()) {
      setCloudCheckDone(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) {
          if (!cancelled) setCloudCheckDone(true);
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setCloudCheckDone(true);
          return;
        }
        const { data: row } = (await supabase
          .from("app_states")
          .select("payload")
          .eq("user_id", user.id)
          .maybeSingle()) as { data: { payload: AppState | null } | null };
        if (cancelled) return;
        if (row?.payload?.event?.id) {
          applyCloudPayload(row.payload);
          router.replace("/dashboard");
          return;
        }
        setCloudCheckDone(true);
      } catch (e) {
        console.error("[start] cloud backstop failed:", e);
        if (!cancelled) setCloudCheckDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleContinue = () => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(SELECTED_TIER_KEY, selectedTier);
      } catch {
        // sessionStorage can be disabled (Safari private mode quotas etc.).
        // Selection is non-critical for the flow itself, so a silent failure
        // here is acceptable — the user still proceeds.
      }
    }
    router.push("/onboarding?gate=ok");
  };

  // R140 — while the cloud backstop is checking, render a calm loader
  // instead of the tier picker. Otherwise a returning user briefly
  // sees "choose your plan" before being whisked to /dashboard, which
  // reads as "the app forgot my event".
  if (!cloudCheckDone) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center" style={{ color: "var(--foreground-soft)" }}>
            <Loader2 className="mx-auto mb-3 animate-spin" size={24} aria-hidden style={{ color: "var(--accent)" }} />
            <p className="text-sm">טוען את האירוע שלך…</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 relative pb-24">
        <div aria-hidden className="glow-orb glow-orb-gold w-[700px] h-[700px] -top-40 left-1/2 -translate-x-1/2 opacity-30" />

        <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-12 relative z-10">
          <div className="text-center max-w-2xl mx-auto fade-up">
            <span className="pill pill-gold inline-flex">
              <Sparkles size={11} /> לפני שיוצאים לדרך
            </span>
            <h1 className="mt-5 text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
              <span className="gradient-gold block">חינמי לכולם — לכבוד ההשקה</span>
            </h1>
            {/* R121 — was a "choose your tier" page that anchored on
                ₪99 launch price. While paid tiers are paused for the
                launch window, the copy reframes as "you already
                have everything". The PricingTiers component below
                continues to show feature breakdowns for context. */}
            <p className="mt-5 text-base md:text-lg leading-relaxed" style={{ color: "var(--foreground-soft)" }}>
              <strong className="text-[--foreground]">אין מה לבחור עכשיו.</strong>{" "}
              כל הפיצ׳רים פתוחים בחינם לחודשיים — בלי כרטיס אשראי, בלי חיוב אוטומטי, בלי הגבלות.
            </p>
          </div>

          <div className="mt-12">
            <PricingTiers
              selectedTier={selectedTier}
              onSelect={setSelectedTier}
              ctaLabel="בחר"
            />
          </div>

          <div className="mt-12 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleContinue}
              className="btn-gold inline-flex items-center gap-2 px-8 py-3 text-base"
            >
              המשך לתכנון האירוע
              <ArrowLeft size={16} />
            </button>
            <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
              תמיד אפשר לשדרג מאוחר יותר דרך תפריט המשתמש.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
