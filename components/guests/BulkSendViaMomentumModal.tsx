"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { actions } from "@/lib/store";
import { showToast } from "@/components/Toast";
import { getSupabase } from "@/lib/supabase";
import { buildHostInvitationWhatsappLink } from "@/lib/invitation";
import { sendWhatsAppMessage } from "@/lib/whatsapp-send-client";
import { sendSmsMessage } from "@/lib/sms-send-client";
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
  // R133/R134 — pre-flight diagnostics. Either of two configs breaks
  // first-contact delivery silently from the host's POV:
  //   • sandbox        — Twilio's shared sender, only joined phones get msgs
  //   • !templateOk    — no approved Content Template SID, first messages
  //                       fall to free-form which Meta rejects silently
  // The UI surfaces whichever applies BEFORE the host hits send.
  const [sandbox, setSandbox] = useState(false);
  const [templateOk, setTemplateOk] = useState(true); // assume OK until told otherwise
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
          templateConfigured?: boolean;
        };
        if (!cancelled) {
          setSandbox(!!body.sandbox);
          setTemplateOk(body.templateConfigured !== false);
        }
      } catch {
        /* offline / 503 — fall through to default (no banner) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const willFail = sandbox || !templateOk;

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

      let okResult = false;
      let failReason = "";

      // R117 — pre-build the invitation link ONCE for every guest.
      // Pre-R117 the link was built inside Strategy A (for the
      // template's rsvpUrl variable) and SEPARATELY again inside
      // Strategy B (for the free-form WhatsApp text). When Strategy
      // A failed with a non-window error (e.g. Twilio code 63020 —
      // which the client mapped to generic "twilio_error", NOT to
      // "outside_24h_window"), the code set `failReason` and the
      // `!failReason` guard on Strategy B skipped the second build.
      // That left messageText empty, so Strategy C (SMS) couldn't run.
      //
      // Building once up front + removing the early failReason gate
      // means every guest now gets all three strategies attempted
      // in order, and SMS always has a body to send.
      let rsvpUrl = "";
      let messageText = "";
      try {
        const built = await buildHostInvitationWhatsappLink(
          origin,
          event,
          guest,
        );
        rsvpUrl = built.rsvpUrl;
        messageText = decodeURIComponent(
          new URL(built.url).searchParams.get("text") ?? "",
        );
      } catch {
        /* leave both empty — every strategy below tolerates this */
      }

      // Strategy A: approved template (best path — works for first
      // contact). Never sets failReason on its own; failure just
      // falls through to B and C.
      if (templateAvailable && rsvpUrl) {
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
        if (res.ok) okResult = true;
      }

      // Strategy B: WhatsApp free-form (works inside the 24h window).
      if (!okResult && messageText) {
        const res = await sendWhatsAppMessage({
          phone: guest.phone,
          message: messageText,
        });
        if (res.ok) okResult = true;
      }

      // Strategy C: SMS fallback — the deterministic safety net.
      // Works for every Israeli mobile number, no Meta approval
      // required. Always runs when WhatsApp didn't succeed AND we
      // have a message body to send.
      if (!okResult && messageText) {
        const res = await sendSmsMessage({
          phone: guest.phone,
          message: messageText,
        });
        if (res.ok) {
          okResult = true;
        } else {
          failReason =
            res.error === "not_configured"
              ? "WhatsApp ו-SMS שניהם לא זמינים — שלח דרך הכפתור הירוק"
              : (res.hebrewHint ?? "שליחה נכשלה (גם WhatsApp וגם SMS)");
        }
      } else if (!okResult && !messageText) {
        failReason = "בניית הלינק נכשלה";
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
    // R137 — headless-UI-style centered modal. The previous R112 layout
    // (items-center + my-auto + overflow-y-auto on the same outer)
    // pushed the modal below the viewport on mobile when the bulk-
    // send progress list grew. The new outer-scroll + inner-flex
    // pattern centers the card AND scrolls correctly on any height.
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={phase === "sending" ? undefined : onClose}
      role="dialog"
      aria-modal
      aria-labelledby="bulk-send-title"
    >
      {/* R138 — top-anchor so the "X / Y / Z status" header is the
          first thing the user sees while a bulk send runs. */}
      <div className="flex min-h-full items-start justify-center p-4 pt-6 md:pt-12">
      <div
        className="card glass-strong w-full max-w-lg scale-in flex flex-col"
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
              {/* R134 — diagnose-and-warn BEFORE the host hits send.
                  Two distinct configs break first-contact delivery
                  silently; we show whichever applies. */}
              {willFail && (
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
                    {sandbox ? (
                      <>
                        <div className="font-bold mb-1">
                          ⚠️ Twilio במצב Sandbox — האורחים לא יקבלו
                        </div>
                        <div
                          className="text-xs"
                          style={{ color: "rgba(252,165,165,0.95)" }}
                        >
                          רק טלפונים שביצעו &quot;join&quot; ידני מקבלים
                          הודעות ב-Sandbox. השליחה תיראה כמוצלחת אבל
                          ההודעות לא יגיעו לאף אורח.
                        </div>
                        <div
                          className="mt-2 text-[11px]"
                          style={{ color: "rgba(252,165,165,0.85)" }}
                        >
                          <strong>פתרון:</strong> שדרג ל-WhatsApp Business
                          דרך Twilio (אישור Meta, 1-3 ימים).
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-bold mb-1">
                          ⚠️ אין תבנית WhatsApp מאושרת — האורחים לא יקבלו
                        </div>
                        <div
                          className="text-xs"
                          style={{ color: "rgba(252,165,165,0.95)" }}
                        >
                          ה‑Sender שלך (Momentum, +972 53-362-5007) מאושר,
                          אבל WhatsApp דורש <strong>תבנית מאושרת מ-Meta</strong>{" "}
                          עבור הודעה ראשונה לכל אורח. בלי תבנית, ההודעה
                          נשלחת כ-free-form ו-Meta מפילה אותה בשקט.
                        </div>
                        <div
                          className="mt-2 text-[11px]"
                          style={{ color: "rgba(252,165,165,0.85)" }}
                        >
                          <strong>איך לפתור:</strong>
                          <ol className="mt-1 list-decimal list-inside space-y-0.5">
                            <li>
                              Twilio Console → Messaging → Content Template Builder
                            </li>
                            <li>צור תבנית הזמנה לחתונה עם 5 משתנים ({"{{1}}—{{5}}"})</li>
                            <li>Submit לאישור Meta (אישור 1-24 שעות)</li>
                            <li>
                              העתק את ה-Content SID (HX...) והוסף ל-Vercel:
                              <br />
                              <code className="ltr-num bg-black/30 px-1.5 py-0.5 rounded mt-1 inline-block">
                                NEXT_PUBLIC_TWILIO_TEMPLATE_INVITATION_SID
                              </code>
                            </li>
                          </ol>
                        </div>
                        <div
                          className="mt-2 text-[11px]"
                          style={{ color: "rgba(252,165,165,0.85)" }}
                        >
                          <strong>בינתיים — אוטומטית:</strong> אם WhatsApp
                          נכשל, Momentum ינסה לשלוח את אותה הזמנה כ-SMS
                          רגיל. SMS מגיע ל-100% מהמספרים הישראליים ולא
                          דורש אישור Meta. אז גם בלי תבנית מאושרת,
                          האורחים שלך יקבלו לינק.
                        </div>
                      </>
                    )}
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
                <li>🔁 אם WhatsApp נכשל — נשלח SMS אוטומטית כגיבוי</li>
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
                  if (willFail) {
                    const reason = sandbox
                      ? "Twilio במצב Sandbox"
                      : "אין תבנית WhatsApp מאושרת";
                    if (
                      !confirm(
                        `${reason} — האורחים לא יקבלו הודעות. להמשיך בכל זאת? (מומלץ: ביטול ושימוש בכפתור הוואטסאפ הירוק בשורה לכל אורח)`,
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

