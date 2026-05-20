"use client";

import { useState } from "react";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/Toast";
import {
  acceptSuggestion,
  dismissSuggestion,
  type Appointment,
} from "@/lib/calendar/appointments";

/**
 * R67 (R56) — accept/edit/dismiss panel for a Wedding Brain suggestion.
 *
 * Rendered as a centered modal (the spec called this a "popover" but a
 * floating-popover positioned next to a grid cell is fragile across
 * viewports + zoom levels — a focused modal is more robust and
 * touch-friendly).
 */
export function SuggestionPopover({
  suggestion,
  onClose,
  onAccepted,
  onDismissed,
  onEdit,
}: {
  suggestion: Appointment;
  onClose: () => void;
  onAccepted: (a: Appointment) => void;
  onDismissed: (id: string) => void;
  onEdit: (a: Appointment) => void;
}) {
  const [busy, setBusy] = useState<"accept" | "dismiss" | null>(null);

  const time = new Date(suggestion.start_at).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = new Date(suggestion.end_at).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateLabel = new Date(suggestion.start_at).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
  const durationMins =
    (new Date(suggestion.end_at).getTime() -
      new Date(suggestion.start_at).getTime()) /
    60000;

  const handleAccept = async () => {
    if (busy) return;
    setBusy("accept");
    const saved = await acceptSuggestion(suggestion.id);
    if (!saved) {
      showToast("נסו שוב מאוחר יותר", "error");
      setBusy(null);
      return;
    }
    showToast("הפגישה נשמרה ✨", "success");
    onAccepted(saved);
    onClose();
  };

  const handleDismiss = async () => {
    if (busy) return;
    setBusy("dismiss");
    const ok = await dismissSuggestion(suggestion.id);
    if (!ok) {
      showToast("נסו שוב מאוחר יותר", "error");
      setBusy(null);
      return;
    }
    onDismissed(suggestion.id);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <span aria-hidden>✨</span>
          הצעת AI
        </span>
      }
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold">{suggestion.title}</h3>
          {suggestion.description && (
            <p
              className="text-sm mt-2 leading-relaxed"
              style={{ color: "var(--foreground-soft)" }}
            >
              {suggestion.description}
            </p>
          )}
        </div>

        <div
          className="rounded-xl p-3 space-y-1 text-sm"
          style={{
            background: "var(--input-bg)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden>📅</span>
            <span className="ltr-num">{dateLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden>⏰</span>
            <span className="ltr-num">
              {time} – {endTime}
            </span>
            <span style={{ color: "var(--foreground-muted)" }}>
              · {Math.round(durationMins)} דק׳
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleAccept}
            disabled={busy !== null}
            className="btn-gold inline-flex items-center gap-2 disabled:opacity-50"
            style={{ padding: "0.55rem 1.1rem" }}
          >
            {busy === "accept" ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <Check size={14} aria-hidden />
            )}
            אישור ושמירה
          </button>
          <button
            type="button"
            onClick={() => onEdit(suggestion)}
            disabled={busy !== null}
            className="btn-secondary inline-flex items-center gap-1.5 text-sm"
            style={{ padding: "0.55rem 0.9rem" }}
          >
            <Pencil size={13} aria-hidden /> עריכה
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={busy !== null}
            className="text-sm ms-auto inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ color: "var(--foreground-muted)" }}
          >
            {busy === "dismiss" ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <X size={13} aria-hidden />
            )}
            דלגו
          </button>
        </div>
      </div>
    </Modal>
  );
}
