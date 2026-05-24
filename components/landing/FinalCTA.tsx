import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** R42 — the dramatic closing CTA, the most prominent gold moment. */
export function FinalCTA() {
  return (
    <section className="py-24 md:py-36 relative overflow-hidden">
      <div
        aria-hidden
        className="glow-orb glow-orb-gold w-[900px] h-[900px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-55"
      />
      <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center relative z-10">
        <h2
          className="font-extrabold tracking-tight leading-[1.1] gradient-gold-shimmer"
          style={{ fontSize: "clamp(2.25rem, 7vw, 4rem)" }}
        >
          תכננו את האירוע. חיו את הרגעים.
        </h2>
        <p
          className="mt-6 mx-auto max-w-xl leading-relaxed"
          style={{
            fontSize: "clamp(1.05rem, 2.6vw, 1.4rem)",
            color: "var(--foreground-soft)",
          }}
        >
          {/* R96 (R75) — was "ללא התחייבות" doubled-up with later
              guarantees. New copy is honest about the two pricing
              models without over-promising. */}
          התחילו בחינם — 50 מוזמנים, אירוע אחד. שדרוג ל-Pro כשהאירוע גדל. בלי הפתעות, בלי הסכמים מורכבים.
        </p>

        <div className="mt-10 flex justify-center">
          {/* No `pulse-gold` here: that class is `display:none` under
              prefers-reduced-motion (would hide the primary CTA). Size
              + the orb glow carry the drama, reduced-motion-safe. */}
          <Link
            href="/signup"
            className="btn-gold inline-flex items-center justify-center gap-2"
            style={{ minHeight: 66, fontSize: "1.15rem", padding: "0 2.5rem" }}
          >
            התחילו את המסע
            <ArrowLeft size={20} />
          </Link>
        </div>

        <p className="mt-5 text-sm" style={{ color: "var(--accent)" }}>
          🎁 100 הזוגות הראשונים — מחיר השקה ₪99 חד-פעמי (במקום ₪399)
        </p>
      </div>
    </section>
  );
}
