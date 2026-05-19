/**
 * R55 (R45 SMART INPUT, day 2) — voice → envelope amounts, with a
 * mandatory human confirmation step.
 *
 * Flow:  capture (Web Speech he-IL)  →  parse + fuzzy-match  →  REVIEW
 * (host edits/confirms every row)  →  apply.
 *
 * Nothing is ever written to the store from inside this component. It
 * only emits the confirmed rows via `onApply`; the parent does the
 * write. The raw transcript stays in client state and is never sent
 * anywhere (see lib/useSpeechRecognition).
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Mic,
  Square,
  Check,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  MicOff,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { parseHebrew } from "@/lib/voiceParser";
import { matchName, type MatchResult } from "@/lib/nameMatcher";
import type { Guest } from "@/lib/types";

export interface VoiceApplyRow {
  guestId: string;
  amount: number;
}

interface ReviewRow {
  key: string;
  rawText: string;
  amountText: string;
  candidates: MatchResult[];
  /** Selected guest id, or null = "skip this row". */
  selectedGuestId: string | null;
  include: boolean;
}

export function VoiceCapture({
  guests,
  onApply,
  onClose,
}: {
  guests: Guest[];
  onApply: (rows: VoiceApplyRow[]) => void;
  onClose: () => void;
}) {
  const speech = useSpeechRecognition("he-IL");
  const [phase, setPhase] = useState<"capture" | "review">("capture");
  const [rows, setRows] = useState<ReviewRow[]>([]);

  const buildRows = useCallback(
    (text: string) => {
      const parsed = parseHebrew(text);
      const next: ReviewRow[] = parsed.map((e, i) => {
        const candidates = e.name ? matchName(e.name, guests) : [];
        return {
          key: `${i}-${e.rawText}`,
          rawText: e.rawText,
          amountText: String(e.amount),
          candidates,
          selectedGuestId: candidates[0]?.guest.id ?? null,
          include: candidates.length > 0 && e.amount > 0,
        };
      });
      setRows(next);
      setPhase("review");
    },
    [guests],
  );

  const finishCapture = useCallback(() => {
    speech.stop();
    buildRows(speech.transcript);
  }, [speech, buildRows]);

  const recapture = useCallback(() => {
    speech.reset();
    setRows([]);
    setPhase("capture");
  }, [speech]);

  const includedValid = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.include &&
          r.selectedGuestId &&
          Number(r.amountText) > 0,
      ),
    [rows],
  );

  const apply = useCallback(() => {
    const payload: VoiceApplyRow[] = includedValid.map((r) => ({
      guestId: r.selectedGuestId as string,
      amount: Math.round(Number(r.amountText)),
    }));
    if (payload.length > 0) onApply(payload);
    onClose();
  }, [includedValid, onApply, onClose]);

  const patch = (key: string, p: Partial<ReviewRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  // ── Capture phase ────────────────────────────────────────────────
  if (phase === "capture") {
    return (
      <Modal onClose={onClose} title="קלט קולי — מעטפות" maxWidthClass="max-w-md">
        {!speech.supported || speech.status === "unsupported" ? (
          <div className="text-center py-4">
            <MicOff
              size={34}
              className="mx-auto mb-3"
              style={{ color: "var(--foreground-muted)" }}
              aria-hidden
            />
            <p className="text-sm" style={{ color: "var(--foreground-soft)" }}>
              הדפדפן הזה לא תומך בזיהוי דיבור. אפשר להזין את הסכומים ידנית
              ברשימה, או לפתוח את האפליקציה ב-Chrome בטלפון.
            </p>
            <button
              onClick={onClose}
              className="mt-5 rounded-2xl px-5 py-2.5 text-sm font-semibold"
              style={{ border: "1px solid var(--border)", color: "var(--foreground-soft)" }}
            >
              סגור
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm mb-5" style={{ color: "var(--foreground-soft)" }}>
              לחצו על המיקרופון ואמרו, למשל:{" "}
              <span className="font-semibold" style={{ color: "var(--foreground)" }}>
                &quot;אבי 500, שירה שלוש מאות, יוסי 400&quot;
              </span>
              . שום דבר לא נשמר עד שתאשרו כל שורה.
            </p>

            <button
              onClick={speech.status === "listening" ? finishCapture : speech.start}
              aria-label={speech.status === "listening" ? "סיום הקלטה" : "התחל הקלטה"}
              className="relative mx-auto w-24 h-24 rounded-full flex items-center justify-center transition"
              style={{
                background:
                  speech.status === "listening"
                    ? "linear-gradient(135deg, var(--gold-100), var(--gold-500))"
                    : "var(--input-bg)",
                color:
                  speech.status === "listening"
                    ? "var(--gold-button-text)"
                    : "var(--foreground)",
                border: "1px solid var(--border-strong)",
              }}
            >
              {speech.status === "listening" && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ background: "rgba(212,176,104,0.35)" }}
                />
              )}
              {speech.status === "listening" ? (
                <Square size={30} aria-hidden />
              ) : (
                <Mic size={34} aria-hidden />
              )}
            </button>

            <div
              className="mt-4 text-sm font-semibold"
              aria-live="polite"
              style={{ color: "var(--foreground-soft)" }}
            >
              {speech.status === "listening"
                ? "מקליט… דברו עכשיו"
                : speech.transcript
                  ? "מוכן — לחצו שוב כדי להמשיך, או סיימו"
                  : "מוכן להקלטה"}
            </div>

            {(speech.transcript || speech.interim) && (
              <div
                className="mt-4 text-start rounded-2xl p-3 text-sm leading-relaxed max-h-32 overflow-y-auto"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}
              >
                <span>{speech.transcript}</span>{" "}
                <span style={{ color: "var(--foreground-muted)" }}>
                  {speech.interim}
                </span>
              </div>
            )}

            {speech.errorMsg && (
              <div
                className="mt-4 text-sm rounded-2xl p-3 flex items-start gap-2 text-start"
                style={{ background: "rgba(239,68,68,0.1)", color: "rgb(252,165,165)" }}
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                <span>{speech.errorMsg}</span>
              </div>
            )}

            {speech.transcript && speech.status !== "listening" && (
              <button
                onClick={() => buildRows(speech.transcript)}
                className="mt-5 w-full rounded-2xl px-5 py-3 text-sm font-bold"
                style={{
                  background: "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                  color: "var(--gold-button-text)",
                }}
              >
                המשך לבדיקה ואישור
              </button>
            )}
          </div>
        )}
      </Modal>
    );
  }

  // ── Review phase ─────────────────────────────────────────────────
  return (
    <Modal
      onClose={onClose}
      title="בדיקה ואישור"
      maxWidthClass="max-w-lg"
    >
      {rows.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm" style={{ color: "var(--foreground-soft)" }}>
            לא זוהו שמות וסכומים. נסו לדבר ברור יותר, למשל
            &quot;דנה כהן חמש מאות&quot;.
          </p>
          <button
            onClick={recapture}
            className="mt-5 rounded-2xl px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2"
            style={{ border: "1px solid var(--border)", color: "var(--foreground-soft)" }}
          >
            <RotateCcw size={14} aria-hidden /> הקלט שוב
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm mb-4" style={{ color: "var(--foreground-soft)" }}>
            אשרו כל שורה. אפשר לבחור התאמת שם אחרת, לתקן סכום, או לבטל שורה.
            רק שורות מסומנות יישמרו.
          </p>

          <div className="space-y-3 max-h-[52vh] overflow-y-auto pe-1">
            {rows.map((r) => {
              const noMatch = r.candidates.length === 0;
              return (
                <div
                  key={r.key}
                  className="rounded-2xl p-3"
                  style={{
                    border: "1px solid var(--border)",
                    background: r.include ? "var(--input-bg)" : "transparent",
                    opacity: r.include ? 1 : 0.55,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => patch(r.key, { include: e.target.checked })}
                      aria-label={`כלול את "${r.rawText}"`}
                      className="w-5 h-5 shrink-0 accent-[var(--accent)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs truncate"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        נשמע: &quot;{r.rawText}&quot;
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={r.amountText}
                        onChange={(e) => patch(r.key, { amountText: e.target.value })}
                        className="input !py-1.5 !px-3 w-24 text-end ltr-num"
                        aria-label="סכום"
                      />
                      <span
                        className="absolute end-2 top-1/2 -translate-y-1/2 text-xs"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        ₪
                      </span>
                    </div>
                  </div>

                  {noMatch ? (
                    <div
                      className="mt-2 text-xs flex items-center gap-1.5"
                      style={{ color: "rgb(252,165,165)" }}
                    >
                      <AlertTriangle size={12} aria-hidden />
                      לא נמצאה התאמה לשם — הזינו ידנית ברשימה למטה.
                    </div>
                  ) : (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {r.candidates.map((c) => {
                        const sel = r.selectedGuestId === c.guest.id;
                        return (
                          <button
                            key={c.guest.id}
                            onClick={() =>
                              patch(r.key, {
                                selectedGuestId: c.guest.id,
                                include: true,
                              })
                            }
                            className="text-xs rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 transition"
                            style={{
                              border: sel
                                ? "1px solid var(--border-gold)"
                                : "1px solid var(--border)",
                              background: sel
                                ? "rgba(212,176,104,0.12)"
                                : "transparent",
                              color: sel
                                ? "var(--accent)"
                                : "var(--foreground-soft)",
                            }}
                          >
                            {sel && <Check size={11} aria-hidden />}
                            {c.guest.name}
                            <span style={{ color: "var(--foreground-muted)" }}>
                              · {c.reason}
                            </span>
                          </button>
                        );
                      })}
                      <button
                        onClick={() =>
                          patch(r.key, { selectedGuestId: null, include: false })
                        }
                        className="text-xs rounded-full px-3 py-1.5 transition"
                        style={{
                          border: "1px solid var(--border)",
                          color:
                            r.selectedGuestId === null
                              ? "rgb(252,165,165)"
                              : "var(--foreground-muted)",
                        }}
                      >
                        דלג
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            className="mt-5 flex items-center gap-3 pt-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <button
              onClick={recapture}
              className="rounded-2xl px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 shrink-0"
              style={{ border: "1px solid var(--border)", color: "var(--foreground-soft)" }}
            >
              <RotateCcw size={14} aria-hidden /> הקלט שוב
            </button>
            <button
              onClick={apply}
              disabled={includedValid.length === 0}
              className="flex-1 rounded-2xl px-5 py-3 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background:
                  "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                color: "var(--gold-button-text)",
              }}
            >
              <Sparkles size={15} aria-hidden />
              אשר והחל {includedValid.length > 0 ? `(${includedValid.length})` : ""}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
