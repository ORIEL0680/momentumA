import Link from "next/link";
import { Check, Sparkles, ArrowLeft, Gift } from "lucide-react";

/**
 * R121 — Launch offer section. Replaces the previous three-tier pricing
 * grid (Free / Couple ₪99 / Vendor ₪199) while we wire payments through
 * an Israeli processor. For the first two months after a user signs up
 * during the launch window, **every feature is free for everyone** —
 * couples AND vendors. No tier gating, no upgrade nag, no hidden cap.
 *
 * Visually this is the most premium moment on the landing page:
 *   • Massive centered gold-shimmer headline announcing the offer
 *   • A single luxe gold-bordered "card" containing every feature
 *     from the old Couple + Vendor lists — fully unlocked
 *   • A bold ₪0 / "כל הפיצ'רים" anchor
 *   • Honest fine print explaining what happens after the launch
 *     window (no auto-charge — you pick whether to keep going)
 *
 * The section ID stays `#pricing` so the Header nav anchor + every
 * existing in-app link to `/#pricing` keeps working without ripple.
 */

const EVERYTHING_INCLUDED = [
  // From the old "Free" tier — basics.
  { label: "מוזמנים ללא הגבלה", icon: "👥" },
  { label: "אירועים ללא הגבלה", icon: "🎉" },
  { label: "כל המחשבונים החכמים", icon: "🧮" },
  // From the old "Couple" tier — premium.
  { label: "AI Co-Pilot ביום האירוע", icon: "🤖" },
  { label: "Momentum Live (מצב חי לאירוע)", icon: "📡" },
  { label: "Auto-Report וסיכום Wrapped", icon: "📊" },
  { label: "סידורי הושבה חכמים", icon: "🪑" },
  { label: "RSVP אוטומטי + אישורי הגעה", icon: "✅" },
  // From the old "Vendor" tier — vendor-side.
  { label: "Vendor Studio + דף נחיתה אישי", icon: "✨" },
  { label: "לידים בזמן אמת מהקטלוג", icon: "💬" },
  { label: "אנליטיקות חיות לספקים", icon: "📈" },
  { label: "תמיכה ב-WhatsApp + SMS", icon: "💌" },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 md:py-32 relative overflow-hidden">
      {/* Layered gold glow — premium "headline moment" treatment. */}
      <div
        aria-hidden
        className="glow-orb glow-orb-gold w-[820px] h-[820px] top-0 left-1/2 -translate-x-1/2 opacity-35"
      />
      <div
        aria-hidden
        className="glow-orb glow-orb-gold w-[420px] h-[420px] bottom-0 right-1/3 opacity-20"
      />

      <div className="max-w-5xl mx-auto px-5 sm:px-8 relative z-10">
        {/* Eyebrow — sets context before the big headline lands. */}
        <div className="flex justify-center">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold fade-up"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--accent) 6%, transparent))",
              border: "1px solid var(--border-gold)",
              color: "var(--accent)",
              letterSpacing: "0.06em",
            }}
          >
            <Sparkles size={14} aria-hidden />
            מבצע השקה — לזמן מוגבל
          </div>
        </div>

        {/* The big moment. */}
        <h2
          className="mt-6 text-center font-extrabold tracking-tight leading-[1.05] fade-up"
          style={{
            fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
            animationDelay: "0.05s",
          }}
        >
          <span className="block gradient-gold-shimmer">
            חודשיים ראשונים —
          </span>
          <span className="block gradient-gold-shimmer">חינם לכולם.</span>
        </h2>

        {/* Subhead — explain the deal in one elegant line. */}
        <p
          className="mt-6 mx-auto max-w-2xl text-center leading-relaxed fade-up"
          style={{
            fontSize: "clamp(1.05rem, 2.4vw, 1.25rem)",
            color: "var(--foreground-soft)",
            animationDelay: "0.1s",
          }}
        >
          לרגל ההשקה הרשמית, פתחנו את <strong className="gradient-gold">כל הפיצ׳רים</strong>{" "}
          לכל מי שמצטרף — זוגות וספקים. בלי הגבלות, בלי שדרוג, בלי
          מספרי כרטיס.
        </p>

        {/* The "everything included" card — single luxe surface. */}
        <div
          className="mt-12 rounded-[2rem] p-7 sm:p-10 md:p-14 relative fade-up"
          style={{
            background:
              "linear-gradient(170deg, color-mix(in srgb, var(--accent) 14%, var(--surface-1)), color-mix(in srgb, var(--accent) 4%, var(--surface-0)))",
            border: "1px solid var(--border-gold)",
            boxShadow:
              "0 40px 100px -32px var(--accent-glow), inset 0 1px 0 color-mix(in srgb, var(--accent) 22%, transparent)",
            animationDelay: "0.15s",
          }}
        >
          {/* Ribbon — "free during launch". */}
          <div
            className="absolute -top-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold whitespace-nowrap"
            style={{
              background:
                "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
              color: "var(--gold-button-text)",
              boxShadow: "0 12px 30px -10px var(--accent-glow)",
            }}
          >
            <Gift size={15} aria-hidden /> 60 ימי השקה · חינם לכולם
          </div>

          {/* Price anchor — generous, calm, no comparison hack. */}
          <div className="flex flex-col items-center text-center pt-4">
            <div
              className="text-xs uppercase tracking-[0.25em] font-bold"
              style={{ color: "var(--accent)" }}
            >
              במבצע ההשקה
            </div>
            <div className="mt-3 flex items-end gap-3 justify-center">
              <span
                className="font-extrabold gradient-gold-shimmer ltr-num leading-none"
                style={{ fontSize: "clamp(4.5rem, 14vw, 7rem)" }}
              >
                ₪0
              </span>
              <span
                className="pb-3 text-base sm:text-lg"
                style={{ color: "var(--foreground-soft)" }}
              >
                / חודשיים ראשונים
              </span>
            </div>
            <div
              className="mt-2 text-sm sm:text-base"
              style={{ color: "var(--foreground-soft)" }}
            >
              כל הפיצ׳רים פתוחים. בלי מנוי. בלי כרטיס אשראי.
            </div>
          </div>

          {/* Features — two-column grid of everything included. */}
          <div
            className="mt-12 grid sm:grid-cols-2 gap-x-8 gap-y-3.5 max-w-3xl mx-auto"
            style={{ color: "var(--foreground-soft)" }}
          >
            {EVERYTHING_INCLUDED.map((f) => (
              <div
                key={f.label}
                className="flex items-start gap-3 text-[15px]"
              >
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0 mt-0.5"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                    border: "1px solid var(--border-gold)",
                  }}
                  aria-hidden
                >
                  <Check size={13} style={{ color: "var(--accent)" }} />
                </span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>

          {/* Primary CTA — large, gold, dominant. */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="btn-gold inline-flex items-center justify-center gap-2 w-full sm:w-auto"
              style={{
                minHeight: 64,
                fontSize: "1.1rem",
                padding: "0 2.5rem",
              }}
            >
              להתחיל עכשיו — חינם
              <ArrowLeft size={20} aria-hidden />
            </Link>
            <Link
              href="/vendors/join"
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-7 transition hover:translate-y-[-1px] w-full sm:w-auto"
              style={{
                minHeight: 64,
                fontSize: "1rem",
                border: "1px solid var(--border-gold)",
                color: "var(--accent)",
                background:
                  "color-mix(in srgb, var(--accent) 8%, transparent)",
              }}
            >
              פתחו דף ספק — חינם
            </Link>
          </div>

          {/* Honest fine print — no auto-charge promise. */}
          <p
            className="mt-7 text-center text-sm leading-relaxed max-w-2xl mx-auto"
            style={{ color: "var(--foreground-muted)" }}
          >
            ✓ אין חיוב אוטומטי בסוף המבצע — תבחרו אם להמשיך
            <br className="hidden sm:block" />
            ✓ אם תרצו להמשיך, מסלולים בתשלום ייפתחו בנפרד עם אישור הסליקה
            <br className="hidden sm:block" />
            ✓ כל מי שמצטרף בתקופת ההשקה מקבל הטבה קבועה גם אחר כך
          </p>
        </div>

        {/* Trust badges — same as before. */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs fade-up"
          style={{ color: "var(--foreground-muted)", animationDelay: "0.25s" }}
        >
          <span>מאובטח על ידי:</span>
          {["Supabase", "Twilio", "OpenAI", "Vercel"].map((name) => (
            <span
              key={name}
              className="font-mono opacity-60 hover:opacity-100 transition"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
