"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X, Check, Gift } from "lucide-react";

/**
 * R18 §R / R121 — was an "upgrade to Premium ₪399" modal. R121
 * pauses paid tiers while we wire the Israeli payment processor;
 * during the launch window every feature is open to every account
 * for free. This modal is now an "everything-is-included" reassurance
 * + a link to the marketing pricing section for context.
 */
export function UpgradePlanModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Lock background scroll while modal is open (mobile fix — prevents
    // the page behind the modal from scrolling when the user pans).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    // R112 — overflow-y-auto on overlay so short screens can scroll
    // the whole modal into view. UpgradePlanModal is short enough that
    // an inner scroll isn't usually needed, but the my-auto + max-h
    // pair makes "tall content under small viewport" safe anyway.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-labelledby="upgrade-modal-title"
    >
      <div
        className="card glass-strong w-full max-w-md p-6 my-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          border: "1px solid var(--border-gold)",
          maxHeight: "calc(100vh - 2rem)",
          overflowY: "auto",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="text-xs uppercase tracking-wider inline-flex items-center gap-1.5"
              style={{ color: "var(--accent)" }}
            >
              <Gift size={12} aria-hidden /> מבצע השקה
            </div>
            <h2 id="upgrade-modal-title" className="mt-1 text-lg font-bold">
              כל הפיצ׳רים פתוחים — חינם.
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="w-11 h-11 -m-2 flex items-center justify-center rounded-lg hover:bg-white/5"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* R121 — premium "you already have everything" hero card. */}
        <div
          className="mt-5 rounded-2xl p-5 text-center"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--accent) 6%, transparent))",
            border: "1px solid var(--border-gold)",
          }}
        >
          <div className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
            במבצע ההשקה
          </div>
          <div className="mt-1 text-5xl font-extrabold ltr-num gradient-gold-shimmer leading-none">
            ₪0
          </div>
          <div className="mt-2 text-sm" style={{ color: "var(--foreground-soft)" }}>
            לרגל ההשקה הרשמית — כל הפיצ׳רים פתוחים בחינם לחודשיים.
            בלי כרטיס אשראי, בלי שדרוג, בלי הגבלה.
          </div>
        </div>

        <ul className="mt-5 space-y-2.5 text-sm" style={{ color: "var(--foreground-soft)" }}>
          {[
            "מוזמנים ואירועים ללא הגבלה",
            "AI Co-Pilot ביום האירוע",
            "סידורי הושבה חכמים",
            "Auto-Report וסיכום Wrapped",
            "תמיכה ב-WhatsApp + SMS",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2.5">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0"
                style={{
                  background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                  border: "1px solid var(--border-gold)",
                }}
              >
                <Check size={12} style={{ color: "var(--accent)" }} aria-hidden />
              </span>
              {f}
            </li>
          ))}
        </ul>

        <p
          className="mt-5 text-xs leading-relaxed text-center"
          style={{ color: "var(--foreground-muted)" }}
        >
          אין חיוב אוטומטי כשהמבצע נגמר — תבחרו אם להמשיך עם מסלול
          בתשלום, או לעצור.
        </p>

        <div className="mt-6 grid gap-2">
          <Link
            href="/#pricing"
            onClick={onClose}
            className="btn-gold w-full text-center"
          >
            פרטי המבצע
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary w-full"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
