"use client";

import type { EventInfo } from "@/lib/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { EVENT_TYPE_EMOJI } from "@/lib/invitationMessage";
import { formatEventDate } from "@/lib/format";
import { LivingSpark } from "@/components/dashboard/LivingSpark";

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

  const safeDays = daysLeft != null && daysLeft > 0 ? daysLeft : 0;
  const past = daysLeft != null && daysLeft < 0;
  const today = daysLeft === 0;

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

        <div className="mt-6 flex flex-col items-center">
          <LivingSpark
            daysUntilEvent={daysLeft}
            progress={progress}
            size={300}
          />
          <div className="mt-3 text-center">
            {daysLeft == null ? (
              <span
                className="text-sm"
                style={{ color: "var(--foreground-muted)" }}
              >
                סופרים את הימים…
              </span>
            ) : past ? (
              <span className="text-xl md:text-2xl font-bold gradient-gold">
                🎉 חגגתם! תודה שתכננתם איתנו
              </span>
            ) : today ? (
              <span className="text-2xl md:text-4xl font-extrabold gradient-gold">
                🎉 היום הגדול הגיע!
              </span>
            ) : (
              <span
                className="text-lg md:text-xl"
                style={{ color: "var(--foreground-soft)" }}
              >
                <strong
                  className="gradient-gold ltr-num"
                  style={{ fontSize: "clamp(1.75rem, 6vw, 2.5rem)" }}
                >
                  {safeDays}
                </strong>{" "}
                {safeDays === 1 ? "יום לאירוע" : "ימים לאירוע"}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
