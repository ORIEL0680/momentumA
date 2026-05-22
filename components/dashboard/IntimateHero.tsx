"use client";

import type { EventInfo } from "@/lib/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { EVENT_TYPE_EMOJI } from "@/lib/invitationMessage";
import { formatEventDate } from "@/lib/format";
import { LivingSpark } from "@/components/dashboard/LivingSpark";
import { LiveCountdown } from "@/components/dashboard/LiveCountdown";

/**
 * R77 (R63 follow-up) — IntimateHero shrunk + premium polish.
 *
 * R76 paired LivingSpark with a live countdown. The combined card felt
 * too tall (~460px min-height + 12/16 padding) and the visual
 * hierarchy was static. This pass:
 *   • drops minHeight ~460→340px and tightens vertical padding
 *   • shrinks LivingSpark 300→220 to make room for the clock
 *   • adds a soft floating gold orb behind the spark (float-slow)
 *   • adds a hairline top accent stripe + inset gold ring
 *   • upgrades the names from gradient-gold → gradient-gold-shimmer
 *   • compresses the divider rhythm
 *
 * The contextual caption + past/today branches and the live clock
 * itself are unchanged.
 */
export function IntimateHero({
  event,
  daysLeft,
  progress,
}: {
  event: EventInfo;
  /** null until the client mounts (useNow) — render a calm placeholder. */
  daysLeft: number | null;
  /** 0–100 journey progress — enriches the spark's aria description. */
  progress?: number;
}) {
  const names = event.partnerName
    ? `${event.hostName} ו-${event.partnerName}`
    : event.hostName;
  const emoji = EVENT_TYPE_EMOJI[event.type] ?? "✨";
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? "אירוע";
  const dateStr = formatEventDate(event.date, "long");

  const past = daysLeft != null && daysLeft < 0;
  const today = daysLeft === 0;

  // R76 (R63) — contextual subtitle paired with the live countdown.
  let countdownCaption = "";
  if (daysLeft != null && daysLeft > 0) {
    if (daysLeft > 30) {
      countdownCaption = "עוד יש זמן — תקבלו החלטות בקצב הנכון";
    } else if (daysLeft > 7) {
      countdownCaption = "החודש הבא קריטי — כל פגישה חשובה";
    } else if (daysLeft > 1) {
      countdownCaption = "השבוע האחרון. תהיו מרוכזים בעצמכם";
    } else {
      countdownCaption = "מחר אתם מתחתנים. עוצרים, נושמים, מתרגשים.";
    }
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl mt-4"
      style={{
        // R77 — was min(60vh, 460px); the new layout sits comfortably
        // around 340px even with the largest segment sizes.
        minHeight: "min(48vh, 340px)",
        background:
          // R88 (R71) — theme-aware. Was hardcoded dark gradient
          // (#0E0B07 → #07060A) that stayed dark in light mode.
          "radial-gradient(140% 80% at 50% -20%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%), linear-gradient(180deg, var(--background-2) 0%, var(--background) 100%)",
        border: "1px solid var(--border-gold)",
        // Subtle inset gold ring + lifted drop shadow — extra "card"
        // depth without growing the footprint.
        boxShadow:
          "inset 0 1px 0 rgba(244,222,169,0.18), 0 24px 60px -28px var(--accent-glow)",
      }}
    >
      {/* Hairline gold accent at the top — premium magazine feel. */}
      <span
        aria-hidden
        className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-[60%] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--accent), transparent)",
          opacity: 0.55,
        }}
      />

      {/* Soft floating gold orb. float-slow respects reduced motion via
          the global media-query in globals.css. */}
      <div
        aria-hidden
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[380px] h-[380px] rounded-full opacity-50 pointer-events-none float-slow"
        style={{
          background:
            "radial-gradient(circle, rgba(244,222,169,0.22), transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 py-8 md:py-10">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-wider font-semibold"
          style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid var(--border-gold)",
            color: "var(--accent)",
          }}
        >
          <span aria-hidden>{emoji}</span>
          {typeLabel}
        </span>

        {/* Names — gradient-gold-shimmer (slow sheen sweep) replaces the
            static gold gradient for extra "alive" feel without flashing. */}
        <h1
          className="mt-4 font-extrabold tracking-tight gradient-gold-shimmer leading-[1.05]"
          style={{ fontSize: "clamp(1.875rem, 5vw, 2.625rem)" }}
        >
          {names}
        </h1>

        {dateStr && (
          <p
            className="mt-2 text-sm md:text-base"
            style={{ color: "var(--foreground-soft)" }}
          >
            {dateStr}
          </p>
        )}

        <div className="mt-5 flex flex-col items-center w-full">
          <LivingSpark
            daysUntilEvent={daysLeft}
            progress={progress}
            size={220}
          />

          {/* Compressed divider rhythm: less air between the spark and
              the clock, but the gold line still anchors the section. */}
          <div
            aria-hidden
            className="mx-auto mt-4 mb-4 w-12 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--accent), transparent)",
              opacity: 0.7,
            }}
          />

          {past ? (
            <span className="text-xl md:text-2xl font-bold gradient-gold-shimmer">
              🎉 חגגתם! תודה שתכננתם איתנו
            </span>
          ) : today ? (
            <span className="text-2xl md:text-4xl font-extrabold gradient-gold-shimmer animate-pulse">
              🎉 היום הגדול הגיע!
            </span>
          ) : (
            <LiveCountdown targetDate={event.date} />
          )}

          {countdownCaption && (
            <div
              className="mt-4 text-xs md:text-sm max-w-md leading-relaxed"
              style={{ color: "var(--foreground-muted)" }}
            >
              {countdownCaption}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
