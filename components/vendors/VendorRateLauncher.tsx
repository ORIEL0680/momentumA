"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Lock } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useAppState } from "@/lib/store";
import { ReviewForm } from "./ReviewForm";

/**
 * R84-3 — inline "rate this vendor" CTA shown on the public landing
 * page (`/vendor/[slug]`) underneath the rating summary.
 *
 * Three branches:
 *   1. Anonymous visitor → "התחבר כדי לדרג" linking to
 *      /signup?returnTo=… so they return here after auth.
 *   2. Signed-in vendor viewing their OWN page → hidden (the form
 *      doesn't apply to self-reviews and the unique constraint
 *      would reject the insert anyway).
 *   3. Signed-in couple → click opens the existing 3-step
 *      `ReviewForm` modal. The form requires an `eventId` for the
 *      unique constraint `(vendor_id, user_id, event_id)`; we read
 *      it from the couple's local app state (their event). When no
 *      event exists yet, we surface a soft prompt to go through
 *      onboarding first.
 *
 * Why we reuse `ReviewForm` instead of building a new inline 5-star
 * picker: the existing modal already enforces every business rule
 * (overall required, sub-axes optional, photos, would-recommend
 * tags, anti-double-submit), is RLS-verified, and ships with toast
 * UX. Spinning a parallel "inline simple rating" would diverge.
 */
export function VendorRateLauncher({
  vendorId,
  vendorName,
  ownerUserId,
  returnTo,
}: {
  /** vendor_landings.id — the SAME id ReviewForm + RatingSummary
   *  use as `vendor_id`. */
  vendorId: string;
  vendorName: string;
  /** owner_user_id from vendor_landings — used to hide the CTA for
   *  the vendor themselves. */
  ownerUserId: string;
  /** Path to return to after sign-in (e.g., "/vendor/[slug]"). */
  returnTo: string;
}) {
  const { state, hydrated } = useAppState();
  // Lazy initializer — read the cloud-sync availability flag once so
  // we don't need to set state synchronously inside an effect when
  // Supabase isn't configured (e.g. local-only mode).
  const [userId, setUserId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState<boolean>(
    () => !getSupabase(),
  );
  const [showForm, setShowForm] = useState(false);

  // Pull the current user id (null when anonymous). One-shot on mount.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
      setAuthResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Don't render anything until we know who the visitor is — avoids
  // flashing "התחבר" for half a second to an actually-signed-in user.
  if (!authResolved) return null;

  // Branch 2: vendor viewing their own page → hide entirely.
  if (userId && userId === ownerUserId) return null;

  // Branch 1: anonymous → sign-in CTA.
  if (!userId) {
    return (
      <div
        className="mt-6 rounded-2xl p-5 text-center"
        style={{
          background: "color-mix(in srgb, var(--accent) 6%, var(--surface-2))",
          border: "1px solid var(--border-gold)",
        }}
      >
        <Lock size={18} className="mx-auto text-[--accent]" aria-hidden />
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--foreground-soft)" }}
        >
          התקיים אצלך אירוע עם {vendorName}?
          <br />
          התחבר כדי להוסיף את הדירוג שלך.
        </p>
        <Link
          href={`/signup?mode=signin&returnTo=${encodeURIComponent(returnTo)}`}
          className="btn-gold mt-4 inline-flex items-center gap-2 text-sm"
        >
          <Star size={14} aria-hidden /> התחבר כדי לדרג
        </Link>
      </div>
    );
  }

  // Branch 3: signed-in couple. Need an event id for the review row.
  const eventId = hydrated ? state.event?.id ?? null : null;
  if (!eventId) {
    return (
      <div
        className="mt-6 rounded-2xl p-5 text-center"
        style={{
          background: "var(--input-bg)",
          border: "1px dashed var(--border)",
        }}
      >
        <Star size={18} className="mx-auto text-[--accent]" aria-hidden />
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--foreground-soft)" }}
        >
          כדי לפרסם דירוג, סיים תחילה את הגדרת האירוע שלך באפליקציה.
        </p>
        <Link
          href="/onboarding?gate=ok"
          className="btn-secondary mt-4 inline-flex items-center gap-2 text-xs"
        >
          המשך להגדרת האירוע
        </Link>
      </div>
    );
  }

  return (
    <>
      <div
        className="mt-6 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-3"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent) 4%, transparent))",
          border: "1px solid var(--border-gold)",
        }}
      >
        <div className="text-center sm:text-start">
          <div className="font-bold gradient-gold">
            התקיים אצלכם אירוע עם {vendorName}?
          </div>
          <div
            className="text-xs mt-1"
            style={{ color: "var(--foreground-soft)" }}
          >
            דרגו את הספק — הדירוג שלכם עוזר לזוגות הבאים לבחור בביטחון.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="btn-gold inline-flex items-center gap-2 text-sm whitespace-nowrap shrink-0"
        >
          <Star size={14} aria-hidden /> תן דירוג
        </button>
      </div>

      {showForm && (
        <ReviewForm
          vendorId={vendorId}
          vendorName={vendorName}
          eventId={eventId}
          onClose={() => setShowForm(false)}
          onSubmitted={() => {
            setShowForm(false);
            // The summary card reloads on its own via the unique
            // index — but we can hint at refresh by reloading the
            // page. Cheaper UX: trust the user-facing toast inside
            // ReviewForm and let the next navigation pick up the
            // new row. (window.location.reload could be added if
            // a delay is annoying in practice.)
          }}
        />
      )}
    </>
  );
}
