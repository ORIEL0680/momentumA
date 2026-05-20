"use client";

import { useMemo, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { useAppState } from "@/lib/store";
import {
  getPriceInfo,
  calculateSavings,
  findCheapestNearby,
} from "@/lib/calendar/pricing-model";
import { formatHebrewDate } from "@/lib/calendar/hebrew-calendar";

/**
 * R65 (R55) — AI suggestion banner reading the user's own event date
 * from the local app_states blob.
 *
 * Shown only when:
 *   - There is a future event date in state.event.
 *   - That date's price level is `high` or `very_high`.
 *   - We can find a cheaper alternative within ±30 days.
 *   - The user hasn't dismissed in the last 7 days (per-device).
 *
 * No DB writes; the suggestion is informational — the user has to
 * change their event date themselves (we don't auto-edit anything
 * critical without explicit confirmation, and the modal/confirm flow
 * is out of MVP scope).
 */

const DISMISS_KEY = "momentum.calendar.suggestion.dismissed.v1";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function readDismissed(): boolean {
  if (typeof window === "undefined") return true; // SSR — render nothing
  try {
    const at = window.localStorage.getItem(DISMISS_KEY);
    if (!at) return false;
    return Date.now() - Number(at) < DISMISS_MS;
  } catch {
    return false;
  }
}

export function AISuggestionBanner() {
  const { state, hydrated } = useAppState();
  // Lazy init: no setState-in-effect for the dismissal gate.
  const [dismissed, setDismissed] = useState(readDismissed);
  const [expanded, setExpanded] = useState(false);

  const suggestion = useMemo(() => {
    if (!hydrated || !state.event?.date) return null;
    const eventDate = new Date(state.event.date);
    if (Number.isNaN(eventDate.getTime())) return null;
    // Skip past events.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDate.getTime() < today.getTime()) return null;
    const info = getPriceInfo(eventDate);
    if (info.level !== "high" && info.level !== "very_high") return null;
    const cheaper = findCheapestNearby(eventDate, 30);
    if (!cheaper) return null;
    // Only suggest if there's a meaningful saving.
    if (cheaper.info.multiplier >= info.multiplier - 0.05) return null;
    const savings = calculateSavings(
      eventDate,
      cheaper.date,
      state.event.budgetTotal || 100_000,
    );
    return { eventDate, info, cheaper, savings };
  }, [hydrated, state.event]);

  if (dismissed || !suggestion) return null;

  const { eventDate, info, cheaper, savings } = suggestion;

  const dismiss = () => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      }
    } catch {
      /* private mode — fall through to in-memory dismissal */
    }
    setDismissed(true);
  };

  const fmt = (d: Date) =>
    d.toLocaleDateString("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
      weekday: "long",
    });

  return (
    <div
      className="card-gold p-5 md:p-6 mb-6 relative"
      role="region"
      aria-label="הצעה לחיסכון בתאריך אירוע"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="סגור את ההצעה"
        className="absolute top-3 end-3 w-9 h-9 -m-1 flex items-center justify-center rounded-full transition hover:bg-[var(--secondary-button-bg)]"
        style={{ color: "var(--foreground-muted)" }}
      >
        <X size={16} aria-hidden />
      </button>

      <div className="flex items-start gap-3 pe-8">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "color-mix(in srgb, var(--gold-100) 16%, transparent)",
            border: "1px solid var(--border-gold)",
            color: "var(--accent)",
          }}
          aria-hidden
        >
          <Lightbulb size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base">חיסכון פוטנציאלי</h3>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "var(--foreground-soft)" }}
          >
            האירוע שלכם ב-
            <strong className="ltr-num">{fmt(eventDate)}</strong> מסומן כ
            {info.label}. אם תזיזו ל-
            <strong className="ltr-num">{fmt(cheaper.date)}</strong> —
            חיסכון משוער:{" "}
            <strong className="ltr-num">
              ₪{savings.delta.toLocaleString("he-IL")}
            </strong>{" "}
            ({savings.percent > 0 ? "−" : "+"}
            {Math.abs(savings.percent)}% מהתקציב הצפוי).
          </p>

          {expanded && (
            <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
              <DateCompareCard
                title="הנוכחי"
                date={eventDate}
                label={info.label}
                color={info.color}
                reasons={info.reasons}
              />
              <DateCompareCard
                title="המוצע"
                date={cheaper.date}
                label={cheaper.info.label}
                color={cheaper.info.color}
                reasons={cheaper.info.reasons}
              />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-sm font-semibold underline"
              style={{ color: "var(--accent)" }}
            >
              {expanded ? "הסתר השוואה" : "צפו בהשוואה"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-sm"
              style={{ color: "var(--foreground-muted)" }}
            >
              התעלם השבוע
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DateCompareCard({
  title,
  date,
  label,
  color,
  reasons,
}: {
  title: string;
  date: Date;
  label: string;
  color: string;
  reasons: string[];
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: `${color}18`,
        border: `1px solid ${color}55`,
      }}
    >
      <div
        className="text-xs"
        style={{ color: "var(--foreground-muted)" }}
      >
        {title}
      </div>
      <div className="mt-1 font-semibold ltr-num">
        {date.toLocaleDateString("he-IL", {
          day: "numeric",
          month: "short",
          weekday: "long",
        })}
      </div>
      <div
        className="text-xs mt-0.5"
        style={{ color: "var(--foreground-soft)" }}
      >
        {formatHebrewDate(date)}
      </div>
      <div className="mt-2 text-xs font-semibold" style={{ color }}>
        {label}
      </div>
      {reasons.length > 0 && (
        <div
          className="text-xs mt-1"
          style={{ color: "var(--foreground-muted)" }}
        >
          {reasons.join(" · ")}
        </div>
      )}
    </div>
  );
}
