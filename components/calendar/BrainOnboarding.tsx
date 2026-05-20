"use client";

import { useState, useSyncExternalStore } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/Toast";
import { getSupabase } from "@/lib/supabase";

/**
 * R67 (R56) — Wedding Brain onboarding splash.
 *
 * Shown once per device on the first /calendar load when the user has
 * an event date. On confirm: POSTs to /api/calendar/seed-brain (which
 * is itself idempotent — if the user already has suggestions, it skips
 * the insert) and flips a localStorage flag so the splash never re-shows.
 *
 * Architecture deviation: the spec's `user_profiles.calendar_seeded`
 * column doesn't exist (no user_profiles table). localStorage gate
 * here is the simplest equivalent; the API's idempotency guards the
 * "I cleared localStorage, will it duplicate?" case.
 *
 * Same useSyncExternalStore pattern as `useFirstLogin` (R61) — SSR
 * snapshot returns `seeded=true` so the splash never renders during
 * SSR/hydration.
 */

const SEEDED_KEY = "momentum.calendar.brain.seeded.v1";

const listeners = new Set<() => void>();
function notify(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SEEDED_KEY) cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): boolean {
  try {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(SEEDED_KEY) === "1";
  } catch {
    return true;
  }
}
function getServerSnapshot(): boolean {
  return true;
}

export function useBrainSeeded(): {
  seeded: boolean;
  markSeeded: () => void;
} {
  const seeded = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const markSeeded = () => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SEEDED_KEY, "1");
        notify();
      }
    } catch {
      /* private mode — splash may re-show; harmless because the API
         endpoint itself is idempotent. */
    }
  };
  return { seeded, markSeeded };
}

export function BrainOnboarding({
  eventDate,
  onSeeded,
}: {
  eventDate: Date;
  /** Called after seed-brain succeeds — parent should refetch appointments. */
  onSeeded: () => void;
}) {
  const { seeded, markSeeded } = useBrainSeeded();
  const [busy, setBusy] = useState(false);

  if (seeded) return null;

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        showToast("Cloud Sync לא מוגדר — Brain דורש חיבור לענן.", "error");
        setBusy(false);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showToast("יש להתחבר מחדש כדי להפעיל את ה-Brain.", "error");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/calendar/seed-brain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ eventDate: eventDate.toISOString() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        inserted?: number;
        skipped?: boolean;
        error?: string;
      };
      if (!res.ok) {
        showToast(data.error ?? "שגיאה בהפעלת ה-Brain", "error");
        setBusy(false);
        return;
      }
      markSeeded();
      if (data.skipped) {
        showToast("ה-Brain כבר הופעל בעבר — הצעות זמינות בלוח.", "info");
      } else {
        showToast(
          `נוצרו ${data.inserted ?? 0} הצעות AI לאורך 18 חודשים ✨`,
          "success",
        );
      }
      onSeeded();
    } catch {
      showToast("שגיאה בהפעלת ה-Brain", "error");
      setBusy(false);
    }
  };

  const handleSkip = () => {
    markSeeded();
  };

  return (
    <Modal
      onClose={handleSkip}
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles
            size={18}
            style={{ color: "var(--accent)" }}
            aria-hidden
          />
          ברוכים הבאים ללוח Wedding Brain
        </span>
      }
      maxWidthClass="max-w-md"
    >
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--foreground-soft)" }}
      >
        אנחנו יכולים להוסיף עבורכם כ-24 הצעות פגישות אוטומטיות לאורך
        18 החודשים שלפני האירוע — מסגירת אולם ועד בוקר החתונה.
      </p>
      <ul
        className="mt-4 space-y-2 text-sm"
        style={{ color: "var(--foreground-soft)" }}
      >
        <li className="flex items-center gap-2">
          <span aria-hidden>✨</span> כל כוכב = הצעה ממוקדת זמן
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden>✅</span> לחיצה = אישור, עריכה, או דילוג
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden>➕</span> תמיד אפשר להוסיף פגישות משלכם
        </li>
      </ul>
      <div className="mt-6 flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={handleSkip}
          disabled={busy}
          className="text-sm py-2 px-3"
          style={{ color: "var(--foreground-muted)" }}
        >
          דלגו לעת עתה
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="btn-gold inline-flex items-center gap-2 disabled:opacity-50"
          style={{ padding: "0.6rem 1.25rem" }}
        >
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
          הבנתי, תראו לי
        </button>
      </div>
    </Modal>
  );
}
