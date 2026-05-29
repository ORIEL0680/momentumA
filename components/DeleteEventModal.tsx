"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { eventSlots } from "@/lib/eventSlots";
import { showToast } from "@/components/Toast";
import { useAppState } from "@/lib/store";
import { EVENT_TYPE_LABELS, type EventInfo } from "@/lib/types";
import { formatEventDate } from "@/lib/format";

/**
 * R102 — premium "delete event & start over" modal.
 *
 * Destructive, irreversible action — wipes the active event with
 * guests, budget, seating, checklist. Triple-gated:
 *   1. The user has to open the modal from the user menu.
 *   2. They have to type the literal word "מחק" to enable the button.
 *   3. The red button itself shows a brief "מוחק..." state so a
 *      muscle-memory double-click doesn't fire it twice.
 *
 * Stops short of touching the auth session — that lives at
 * /settings under "delete account" and uses a different flow.
 *
 * On confirm: eventSlots.deleteActive() (which already auto-switches to
 * another slot if one exists, otherwise zeros the state) then routes
 * to /onboarding so the user can start fresh without the dashboard
 * flashing an empty-state.
 */

const CONFIRM_WORD = "מחק";

interface Props {
  onClose: () => void;
}

export function DeleteEventModal({ onClose }: Props) {
  const router = useRouter();
  const { state } = useAppState();
  const event = state.event;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Esc-to-close + body scroll lock + autofocus the confirm input so
  // keyboard-only users can act on the dialog without hunting for the
  // field. Pattern mirrors components/Modal.tsx + SavedVendorEditModal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Defer focus to next frame so the slide-in animation doesn't
    // race the focus call (some browsers refuse focus on a not-yet-
    // painted element).
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [onClose]);

  const canConfirm = input.trim() === CONFIRM_WORD && !busy;

  const handleConfirm = () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      eventSlots.deleteActive();
      showToast("האירוע נמחק — מתחילים חדש", "success");
      // Slight defer so the toast renders before the route swap.
      window.setTimeout(() => router.push("/onboarding"), 120);
    } catch (e) {
      console.error("[delete-event] failed", e);
      showToast("משהו השתבש — נסה שוב", "error");
      setBusy(false);
    }
  };

  return (
    // R112 — overflow-y-auto on the overlay + flex column with max-h on
    // the card means: short screens can scroll the whole modal into
    // view, tall content scrolls inside the card. Without this the
    // bottom buttons + confirm input disappeared on mobile.
    // R137 — headless-UI-style centered modal: outer fixed overlay
    // owns the scroll, inner min-h-full flex container centers the
    // card vertically without pushing it off-screen on mobile.
    <div
      className="fixed inset-0 z-[70] overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-labelledby="delete-event-title"
    >
      <div className="flex min-h-full items-center justify-center p-4">
      <div
        className="card glass-strong w-full max-w-md scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          border: "1px solid rgba(248,113,113,0.35)",
          boxShadow: "0 24px 80px -20px rgba(248,113,113,0.25)",
          maxHeight: "calc(100vh - 2rem)",
        }}
      >
        {/* Top banner — red wash with warning icon */}
        <div
          className="relative px-6 pt-6 pb-5 shrink-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(248,113,113,0.10), rgba(248,113,113,0.02))",
            borderBottom: "1px solid rgba(248,113,113,0.18)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="absolute top-3 end-3 w-9 h-9 rounded-full inline-flex items-center justify-center transition hover:bg-white/10"
            style={{ color: "var(--foreground-muted)" }}
          >
            <X size={16} aria-hidden />
          </button>

          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl inline-flex items-center justify-center shrink-0"
              style={{
                background: "rgba(248,113,113,0.18)",
                border: "1px solid rgba(248,113,113,0.35)",
                color: "rgb(252,165,165)",
              }}
            >
              <AlertTriangle size={22} aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                id="delete-event-title"
                className="font-bold text-lg leading-tight"
              >
                למחוק את האירוע ולהתחיל מחדש?
              </h2>
              <p
                className="mt-1.5 text-sm leading-relaxed"
                style={{ color: "var(--foreground-soft)" }}
              >
                כל הנתונים של האירוע יימחקו. הפעולה לא ניתנת לשחזור.
              </p>
            </div>
          </div>
        </div>

        {/* Body — flex-1 + scroll so long event summaries or long
            translated checklist text don't push the footer off-screen. */}
        <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
          {/* Event summary card — so the user sees exactly what's about to vanish */}
          {event && <EventSummary event={event} />}

          {/* What gets deleted, in plain Hebrew */}
          <ul
            className="text-sm space-y-1.5 px-3 py-3 rounded-2xl"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              color: "var(--foreground-soft)",
            }}
          >
            <li className="flex items-center gap-2">
              <span className="text-red-300">✗</span> רשימת מוזמנים ואישורי הגעה
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-300">✗</span> תקציב, הוצאות, מעטפות
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-300">✗</span> סידורי הושבה ושולחנות
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-300">✗</span> ספקים שמורים וצ׳ק-ליסט
            </li>
          </ul>

          {/* Type-to-confirm */}
          <label className="block">
            <span
              className="text-xs block mb-1.5"
              style={{ color: "var(--foreground-muted)" }}
            >
              כדי לאשר, הקלד <strong className="text-red-300">{CONFIRM_WORD}</strong> למטה
            </span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm) handleConfirm();
              }}
              placeholder={CONFIRM_WORD}
              dir="rtl"
              className="input text-center text-lg font-bold"
              style={{
                borderColor: canConfirm
                  ? "rgba(248,113,113,0.6)"
                  : "var(--border)",
                color: canConfirm ? "rgb(252,165,165)" : "var(--foreground)",
                letterSpacing: "0.1em",
              }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 grid grid-cols-2 gap-2 shrink-0"
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="action-btn"
            style={{ minHeight: 48 }}
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              minHeight: 48,
              color: "white",
              background: canConfirm
                ? "linear-gradient(135deg, rgb(248,113,113), rgb(220,38,38))"
                : "rgba(248,113,113,0.35)",
              boxShadow: canConfirm
                ? "0 8px 20px -8px rgba(248,113,113,0.6)"
                : "none",
            }}
          >
            <Trash2 size={15} aria-hidden />
            {busy ? "מוחק..." : "מחק והתחל מחדש"}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

/** Compact summary of the event being deleted — names + date + venue. */
function EventSummary({ event }: { event: EventInfo }) {
  const couple = event.partnerName
    ? `${event.hostName} ו${event.partnerName}`
    : event.hostName;
  const date = event.date ? formatEventDate(event.date) : null;
  const venue = [event.synagogue, event.city].filter(Boolean).join(" · ");
  return (
    <div
      className="rounded-2xl p-3.5"
      style={{
        background:
          "color-mix(in srgb, var(--gold-100) 8%, var(--input-bg))",
        border: "1px solid var(--border-gold)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-widest mb-1"
        style={{ color: "var(--foreground-muted)" }}
      >
        האירוע שיימחק
      </div>
      <div className="font-bold text-base truncate">{couple}</div>
      <div
        className="text-xs mt-0.5"
        style={{ color: "var(--foreground-soft)" }}
      >
        {EVENT_TYPE_LABELS[event.type] ?? "אירוע"}
        {date ? ` · ${date}` : ""}
        {venue ? ` · ${venue}` : ""}
      </div>
    </div>
  );
}
