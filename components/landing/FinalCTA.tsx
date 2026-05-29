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
          {/* R121 — the launch is free for everyone for 60 days.
              Calm + confident copy: it's open, all of it, no card. */}
          לרגל ההשקה, כל מי שמצטרף עכשיו מקבל את הפלטפורמה המלאה
          בחינם לחודשיים. בלי מספרי כרטיס, בלי שדרוגים, בלי הפתעות.
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
          🎁 חינמי לכולם · 60 ימי השקה · בלי כרטיס אשראי
        </p>
      </div>
    </section>
  );
}
