"use client";

import type { EventInfo } from "@/lib/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { EVENT_TYPE_EMOJI } from "@/lib/invitationMessage";
import { formatEventDate } from "@/lib/format";
import { LivingSpark } from "@/components/dashboard/LivingSpark";
import { LiveCountdown } from "@/components/dashboard/LiveCountdown";

/**
 * R41 — the intimate dashboard hero. R44 §1 — the static count-up was
 * replaced by LIVING SPARK: a gold spark that evolves with the journey
 * (it carries the "how far / how close" feeling; the day number stays
 * as a small factual line, not a tooltip). Gradient-only background
 * (EventInfo has no cover-photo field — spec's optional branch omitted).
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
  // Tone matches "how far / how close" the journey is: from the calm
  // "you've got time" through the focused "next month is critical" to
  // the intimate "tomorrow you're getting married."
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
        minHeight: "min(60vh, 460px)",
        background:
          "radial-gradient(120% 80% at 50% -10%, rgba(212,176,104,0.22), transparent 60%), linear-gradient(180deg, #0E0B07 0%, #07060A 100%)",
        border: "1px solid var(--border-gold)",
      }}
    >
      <div
        aria-hidden
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full opacity-50 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(244,222,169,0.18), transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 py-12 md:py-16">
        <span
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid var(--border-gold)",
            color: "var(--accent)",
          }}
        >
          <span aria-hidden>{emoji}</span>
          {typeLabel}
        </span>

        <h1
          className="mt-6 font-extrabold tracking-tight gradient-gold leading-[1.08]"
          style={{ fontSize: "clamp(2.5rem, 7vw, 3.5rem)" }}
        >
          {names}
        </h1>

        {dateStr && (
          <p
            className="mt-4 text-lg md:text-xl"
            style={{ color: "var(--foreground-soft)" }}
          >
            {dateStr}
          </p>
        )}

        <div className="mt-6 flex flex-col items-center w-full">
          <LivingSpark
            daysUntilEvent={daysLeft}
            progress={progress}
            size={300}
          />

          {/* Gold divider between spark and the live clock. */}
          <div
            aria-hidden
            className="mx-auto mt-6 mb-6 w-16 h-px"
            style={{ background: "var(--border-gold)" }}
          />

          {/* R76 (R63) — live countdown clock. Replaces the previous
              static "N ימים לאירוע" line with a real DD:HH:MM(:SS)
              ticking display. The branches for past/today are kept
              outside so we never instantiate the clock pointlessly. */}
          {past ? (
            <span className="text-xl md:text-2xl font-bold gradient-gold">
              🎉 חגגתם! תודה שתכננתם איתנו
            </span>
          ) : today ? (
            <span className="text-2xl md:text-4xl font-extrabold gradient-gold animate-pulse">
              🎉 היום הגדול הגיע!
            </span>
          ) : (
            <LiveCountdown targetDate={event.date} />
          )}

          {countdownCaption && (
            <div
              className="mt-6 text-sm md:text-base max-w-md"
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
