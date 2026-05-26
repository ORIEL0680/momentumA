"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { actions } from "@/lib/store";
import { showToast } from "@/components/Toast";
import { getSupabase } from "@/lib/supabase";
import { buildHostInvitationWhatsappLink } from "@/lib/invitation";
import { sendWhatsAppMessage } from "@/lib/whatsapp-send-client";
import {
  GUEST_INVITATION_TEMPLATE_SID,
  buildGuestInvitationVariables,
  hasGuestInvitationTemplate,
} from "@/lib/whatsapp-templates";
import { formatEventDate } from "@/lib/format";
import type { EventInfo, Guest } from "@/lib/types";

/**
 * R105 — bulk-send invitations through Momentum's WhatsApp Business
 * number. Loops over the candidate guests, picks the right strategy
 * per guest (approved template → free-form → wa.me fallback marker),
 * and surfaces live progress + a final summary.
 *
 * Why a dedicated component and not a click-each-row loop:
 *   - Pre-builds every invitation URL up-front (single Promise.all),
 *     so the user sees real progress vs. "stuck on row 3".
 *   - Throttles the API loop at ~200ms/req to be a polite citizen
 *     to Twilio + give the UI room to repaint between sends.
 *   - Tracks per-guest outcome so the summary names the 2 failures
 *     instead of saying "47/49 succeeded".
 *
 * Stops short of touching wa.me — pure API path. Guests that fail
 * (no template, outside 24h window, invalid phone, …) stay marked as
 * "not invited" so the host can still hit them one-by-one with the
 * existing green wa.me button on the row.
 */

interface Props {
  origin: string;
  event: EventInfo;
  /** Already filtered: pending status, has phone. */
  candidates: Guest[];
  onClose: () => void;
}

type GuestOutcome =
  | { status: "queued"; guest: Guest }
  | { status: "ok"; guest: Guest; sid?: string }
  | { status: "fail"; guest: Guest; reason: string };

const THROTTLE_MS = 200; // ~5 sends/sec — well below Twilio's 80/sec cap.

export function BulkSendViaMomentumModal({
  origin,
  event,
  candidates,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<"confirm" | "sending" | "done">("confirm");
  const [outcomes, setOutcomes] = useState<GuestOutcome[]>(() =>
    candidates.map((g) => ({ status: "queued", guest: g })),
  );
  const cancelRef = useRef(false);
  // R133 — pre-flight sandbox check. Hits the status endpoint once on
  // mount; if the Twilio account is on the shared Sandbox number, we
  // show a red banner BEFORE the host clicks send. Without this the
  // bulk-send modal would happily report "✓ 200 נשלחו" while
  // 0 actually reached anyone.
  const [sandbox, setSandbox] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch("/api/whatsapp/status?limit=1", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as {
          sandbox?: boolean;
        };
        if (!cancelled) setSandbox(!!body.sandbox);
      } catch {
        /* offline / 503 — fall through to default (no banner) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Esc/click-out close (only when not mid-send so a slip doesn't
  // abort a 200-guest batch) + body scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "sending") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, phase]);

  const sentCount = outcomes.filter((o) => o.status === "ok").length;
  const failedCount = outcomes.filter((o) => o.status === "fail").length;
  const remaining = outcomes.filter((o) => o.status === "queued").length;

  const handleSend = async () => {
    setPhase("sending");
    cancelRef.current = false;

    // Strategy is decided per-guest at send time. We DON'T resolve all
    // the wa.me URLs up-front because that would HMAC 400 keys for a
    // 200-guest list before we even start — defeating the live-progress
    // win. Each iteration builds its own link just-in-time.
    const templateAvailable = hasGuestInvitationTemplate();
    const hostNames = event.partnerName
      ? `${event.hostName} ו${event.partnerName}`
      : event.hostName;
    const venue = [event.synagogue, event.city].filter(Boolean).join(" · ");
    const dateText = formatEventDate(event.date);

    // Track counts locally — `outcomes` state is stale inside the loop
    // closure, so we can't rely on it for the final toast.
    let okCount = 0;
    let failCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      if (cancelRef.current) break;
      const guest = candidates[i];

      // Strategy A: approved template (works for first contact).
      let okResult = false;
      let failReason = "";

      if (templateAvailable) {
        // Build link only for the rsvpUrl variable.
        let rsvpUrl = "";
        try {
          const built = await buildHostInvitationWhatsappLink(
            origin,
            event,
            guest,
          );
          rsvpUrl = built.rsvpUrl;
        } catch {
          /* link build failed; we'll fall through to free-form attempt */
        }
        if (rsvpUrl) {
          const res = await sendWhatsAppMessage({
            phone: guest.phone,
            templateSid: GUEST_INVITATION_TEMPLATE_SID,
            variables: buildGuestInvitationVariables({
              guestName: guest.name,
              hostNames,
              date: dateText,
              venue: venue || "פרטים בלינק",
              rsvpUrl,
            }),
          });
          if (res.ok) {
            okResult = true;
          } else if (res.error && res.error !== "outside_24h_window") {
            failReason = res.hebrewHint ?? res.error;
          }
        }
      }

      // Strategy B: free-form (works only inside the 24h window).
      if (!okResult && !failReason) {
        let messageText = "";
        try {
          const built = await buildHostInvitationWhatsappLink(
            origin,
            event,
            guest,
          );
          messageText = decodeURIComponent(
            new URL(built.url).searchParams.get("text") ?? "",
          );
        } catch {
          /* leave empty → will fail below */
        }
        if (messageText) {
          const res = await sendWhatsAppMessage({
            phone: guest.phone,
            message: messageText,
          });
          if (res.ok) {
            okResult = true;
          } else {
            failReason =
              res.error === "outside_24h_window" && !templateAvailable
                ? "תבנית הזמנה לא מאושרת — שלח דרך וואטסאפ ידנית"
                : (res.hebrewHint ?? "שליחה נכשלה");
          }
        } else {
          failReason = "בניית הלינק נכשלה";
        }
      }

      if (okResult) {
        okCount++;
        actions.markInvited(guest.id);
        setOutcomes((prev) =>
          prev.map((o) =>
            o.guest.id === guest.id ? { status: "ok", guest } : o,
          ),
        );
      } else {
        failCount++;
        setOutcomes((prev) =>
          prev.map((o) =>
            o.guest.id === guest.id
              ? { status: "fail", guest, reason: failReason || "שגיאה" }
              : o,
          ),
        );
      }

      // Polite throttle — keeps the UI responsive + spreads the load.
      if (i < candidates.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, THROTTLE_MS));
      }
    }

    setPhase("done");
    showToast(
      cancelRef.current
        ? `הופסק — ${okCount} נשלחו, ${failCount} נכשלו`
        : `✓ סיימנו — ${okCount} נשלחו${failCount ? `, ${failCount} נכשלו` : ""}`,
      okCount > 0 ? "success" : "info",
    );
  };

  const handleStop = () => {
    cancelRef.current = true;
  };

  return (
    // R112 — the OUTER overlay gets overflow-y-auto so on short screens
    // (mobile landscape, small laptops) the user can scroll the whole
    // modal into view if it's taller than the viewport. Inner card
    // becomes a flex column with max-h capped at the viewport.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={phase === "sending" ? undefined : onClose}
      role="dialog"
      aria-modal
      aria-labelledby="bulk-send-title"
    >
      <div
        className="card glass-strong w-full max-w-lg scale-in flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          border: "1px solid var(--border-gold)",
          maxHeight: "calc(100vh - 2rem)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4 flex items-start justify-between gap-3 shrink-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(212,176,104,0.08), transparent)",
            borderBottom: "1px solid var(--border-gold)",
          }}
        >
          <div>
            <div
              className="text-xs uppercase tracking-widest"
              style={{ color: "var(--accent)" }}
            >
              שליחה מ-Momentum
            </div>
            <h2
              id="bulk-send-title"
              className="mt-1 font-bold text-lg leading-tight"
            >
              {phase === "confirm" && `שלח הזמנות ל-${candidates.length} אורחים`}
              {phase === "sending" && `שולח... ${sentCount + failedCount}/${candidates.length}`}
              {phase === "done" && "סיימנו!"}
            </h2>
          </div>
          {phase !== "sending" && (
            <button
              type="button"
              onClick={onClose}
              aria-label="סגור"
              className="w-9 h-9 rounded-full inline-flex items-center justify-center transition hover:bg-white/10 shrink-0"
              style={{ color: "var(--foreground-muted)" }}
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>

        {/* Body — varies by phase. flex-1 + overflow-y-auto = the body
            scrolls within the modal when the failure list grows past
            the viewport. shrink-0 on header/footer keeps them pinned. */}
        <div className="px-6 py-5 space-y-4 flex-1 overflow-y-auto">
          {phase === "confirm" && (
            <>
              {/* R133 — sandbox warning. Show BEFORE the host hits send
                  so they don't waste a 200-guest batch on the silent-
                  drop sandbox path. */}
              {sandbox && (
                <div
                  className="rounded-2xl p-3 text-sm leading-relaxed flex items-start gap-2.5"
                  style={{
                    background: "rgba(248,113,113,0.10)",
                    border: "1px solid rgba(248,113,113,0.4)",
                    color: "rgb(252,165,165)",
                  }}
                  role="alert"
                >
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <div className="font-bold mb-1">
                      ⚠️ Twilio במצב Sandbox — האורחים לא יקבלו!
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "rgba(252,165,165,0.95)" }}
                    >
                      רק טלפונים שביצעו &quot;join&quot; ידני מקבלים הודעות
                      ב-Sandbox. השליחה תיראה כמוצלחת אבל ההודעות לא
                      יגיעו לאף אורח (חוץ מהטלפון שלך, אם הצטרפת בעבר).
                    </div>
                    <div
                      className="mt-2 text-[11px]"
                      style={{ color: "rgba(252,165,165,0.85)" }}
                    >
                      <strong>פתרון:</strong> שדרג ל-WhatsApp Business דרך
                      Twilio (דורש אישור Meta, 1-3 ימים).
                      <br />
                      <strong>בינתיים:</strong> סגור חלון זה ולחץ על
                      כפתור ה-וואטסאפ הירוק ליד כל אורח בנפרד — זה
                      פותח את WhatsApp במכשיר שלך ומגיע ל-100% מהאורחים.
                    </div>
                  </div>
                </div>
              )}

              <div
                className="text-sm leading-relaxed"
                style={{ color: "var(--foreground-soft)" }}
              >
                כל ההזמנות יישלחו ישירות מהמספר העסקי של Momentum
                (<span className="ltr-num font-semibold">+972 53-362-5007</span>).
                האורחים יראו את הלוגו והשם שלך, ולא יצטרכו לפתוח כלום.
              </div>
              <ul
                className="text-sm space-y-1.5 px-3 py-3 rounded-2xl"
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground-soft)",
                }}
              >
                <li>📱 רק לאורחים עם מספר טלפון</li>
                <li>📨 רק לאלה שטרם הוזמנו</li>
                <li>⏱ ~5 הודעות בשנייה — סבלנות 30-60 שניות</li>
              </ul>
            </>
          )}

          {(phase === "sending" || phase === "done") && (
            <>
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--foreground-muted)" }}>
                    התקדמות
                  </span>
                  <span
                    className="ltr-num font-bold"
                    style={{ color: "var(--accent)" }}
                  >
                    {sentCount + failedCount}/{candidates.length}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--input-bg)" }}
                >
                  <div
                    className="h-full transition-all duration-300 ease-out"
                    style={{
                      width: `${candidates.length > 0 ? ((sentCount + failedCount) / candidates.length) * 100 : 0}%`,
                      background:
                        "linear-gradient(90deg, var(--gold-100), var(--gold-500))",
                    }}
                  />
                </div>
              </div>

              {/* Counts */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <Counter
                  label="נשלחו"
                  value={sentCount}
                  color="rgb(110,231,183)"
                />
                <Counter
                  label="נכשלו"
                  value={failedCount}
                  color={failedCount > 0 ? "rgb(252,165,165)" : undefined}
                />
                <Counter label="נותרו" value={remaining} />
              </div>

              {/* Failure list */}
              {failedCount > 0 && phase === "done" && (
                <details
                  className="text-xs rounded-2xl"
                  style={{
                    background: "rgba(248,113,113,0.06)",
                    border: "1px solid rgba(248,113,113,0.2)",
                  }}
                >
                  <summary
                    className="px-3 py-2 cursor-pointer font-semibold"
                    style={{ color: "rgb(252,165,165)" }}
                  >
                    הצג {failedCount} כשלים
                  </summary>
                  <div className="px-3 pb-3 space-y-1">
                    {outcomes
                      .filter((o) => o.status === "fail")
                      .map(
                        (o) =>
                          o.status === "fail" && (
                            <div
                              key={o.guest.id}
                              className="flex justify-between gap-2 leading-relaxed"
                              style={{ color: "var(--foreground-soft)" }}
                            >
                              <span className="truncate">{o.guest.name}</span>
                              <span
                                className="text-end shrink-0"
                                style={{ color: "var(--foreground-muted)" }}
                              >
                                {o.reason}
                              </span>
                            </div>
                          ),
                      )}
                  </div>
                </details>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 grid grid-cols-2 gap-2 shrink-0"
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          {phase === "confirm" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="action-btn"
                style={{ minHeight: 48 }}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => {
                  if (sandbox) {
                    if (
                      !confirm(
                        "Twilio במצב Sandbox — האורחים לא יקבלו הודעות. להמשיך בכל זאת? (לרוב המקרים: ביטול ושימוש בכפתור הוואטסאפ הירוק בשורה לכל אורח)",
                      )
                    ) {
                      return;
                    }
                  }
                  void handleSend();
                }}
                className="btn-gold inline-flex items-center justify-center gap-2"
                style={{ minHeight: 48 }}
              >
                <Send size={15} />
                שלח לכולם
              </button>
            </>
          )}
          {phase === "sending" && (
            <>
              <span
                className="inline-flex items-center justify-center gap-2 text-sm"
                style={{ color: "var(--foreground-muted)" }}
              >
                <Loader2 size={15} className="animate-spin" />
                אל תסגור את הדף
              </span>
              <button
                type="button"
                onClick={handleStop}
                className="action-btn"
                style={{ minHeight: 48, color: "rgb(252,165,165)" }}
              >
                עצור
              </button>
            </>
          )}
          {phase === "done" && (
            <>
              <span />
              <button
                type="button"
                onClick={onClose}
                className="btn-gold inline-flex items-center justify-center gap-2"
                style={{ minHeight: 48 }}
              >
                <Check size={15} />
                סיום
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}
    >
      <div
        className="text-xs"
        style={{ color: "var(--foreground-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-xl font-extrabold ltr-num mt-0.5"
        style={{ color: color ?? "var(--foreground)" }}
      >
        {value}
      </div>
    </div>
  );
}

