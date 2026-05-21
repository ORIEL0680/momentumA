"use client";

import { memo, useEffect, useState } from "react";

/**
 * R76 (R63) — Live countdown clock for IntimateHero.
 *
 * Ticks once a second when the event is within `showSecondsThreshold`
 * days (default 30); once a minute otherwise. Stops when the tab is
 * hidden (visibilitychange) so we never burn battery in the background.
 *
 * Visual contract:
 *   • > 30 days  →  DD  HH  MM       (no seconds, no animated pulse)
 *   • ≤ 30 days  →  DD  HH  MM  SS   (live seconds + pulsing colon)
 *   •   0 days   →  🎉 היום היום
 *
 * SSR: render a skeleton (window/Date.now() differ between server and
 * client → would crash hydration). The skeleton has the same footprint
 * so there's no layout jump when the real clock fades in.
 *
 * Numbers use `font-variant-numeric: tabular-nums` so column widths
 * stay stable as values change.
 *
 * Accessibility: `role="timer"` + `aria-live="off"` (silent — would be
 * annoying as a screen-reader announcement every second; the daysLeft
 * line in the surrounding IntimateHero carries the meaning instead).
 */

interface Props {
  targetDate: Date | string;
  /** When days-remaining drops at or below this, the second-tick + seconds segment appear. Default 30. */
  showSecondsThreshold?: number;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Total milliseconds remaining (clamped at ≥ 0). */
  total: number;
}

function calcRemaining(targetMs: number): TimeRemaining {
  const total = Math.max(0, targetMs - Date.now());
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total / 3_600_000) % 24),
    minutes: Math.floor((total / 60_000) % 60),
    seconds: Math.floor((total / 1_000) % 60),
    total,
  };
}

export function LiveCountdown({
  targetDate,
  showSecondsThreshold = 30,
}: Props) {
  // Normalise the target to a single ms value — using getTime() as the
  // effect dep avoids "new Date() identity changes every render" issues.
  const targetMs =
    typeof targetDate === "string"
      ? new Date(targetDate).getTime()
      : targetDate.getTime();

  const [remaining, setRemaining] = useState<TimeRemaining | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (Number.isNaN(targetMs)) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    // The setInterval callback IS asynchronous (browser task queue),
    // so calling setState from it doesn't trip
    // `react-hooks/set-state-in-effect`. The initial tick is the only
    // synchronous call site — defer it via queueMicrotask, the same
    // pattern lib/useNow.ts uses for its subscribeOnce path.
    const tick = () => setRemaining(calcRemaining(targetMs));

    const start = () => {
      if (interval) return;
      queueMicrotask(tick);
      // Adaptive cadence: when the seconds segment isn't shown (more
      // than the threshold away), tick once a minute. Saves CPU + the
      // React Compiler re-render budget without sacrificing accuracy.
      const r = calcRemaining(targetMs);
      const intervalMs = r.days > showSecondsThreshold ? 60_000 : 1_000;
      interval = setInterval(tick, intervalMs);
    };

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener("visibilitychange", handleVisibility);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // matchMedia's `matches` read is sync but we defer the setState the
    // same way — keeps the whole effect body free of synchronous
    // setState calls.
    queueMicrotask(() => setReducedMotion(mq.matches));
    const handleMotion = (e: MediaQueryListEvent) =>
      setReducedMotion(e.matches);
    mq.addEventListener("change", handleMotion);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      mq.removeEventListener("change", handleMotion);
    };
  }, [targetMs, showSecondsThreshold]);

  // SSR / pre-hydration: skeleton placeholder — same footprint so no
  // layout shift when the real clock arrives.
  if (!remaining) {
    return (
      <div
        className="flex items-end justify-center gap-2 sm:gap-3"
        aria-label="טוען ספירה לאחור"
        dir="ltr"
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg animate-pulse"
            style={{
              background:
                "color-mix(in srgb, var(--accent) 12%, transparent)",
              width: i === 0 ? "120px" : "80px",
              height: i === 0 ? "84px" : "62px",
            }}
          />
        ))}
      </div>
    );
  }

  if (remaining.total === 0) {
    return (
      <div className="text-center" role="timer" aria-label="היום היום">
        <div
          className={`text-3xl md:text-4xl font-extrabold gradient-gold ${reducedMotion ? "" : "animate-pulse"}`}
        >
          🎉 היום היום
        </div>
      </div>
    );
  }

  const showSeconds = remaining.days < showSecondsThreshold;

  return (
    <div
      role="timer"
      aria-label={`${remaining.days} ימים, ${remaining.hours} שעות, ${remaining.minutes} דקות לאירוע`}
      aria-live="off"
    >
      <div className="flex items-start justify-center gap-2 sm:gap-3" dir="ltr">
        {/* R87 (R69-6) — all four segments are the same size now. The
            "big/medium/small" variants made the digits jump heights
            and felt visually busy. Only the trailing "seconds" segment
            gets a slight opacity drop so it doesn't pull focus away
            from the meaningful days count. */}
        <Segment value={remaining.days} label="ימים" />
        <Separator />
        <Segment value={remaining.hours} label="שעות" />
        <Separator />
        <Segment value={remaining.minutes} label="דק׳" />
        {showSeconds && (
          <>
            <Separator pulse={!reducedMotion} />
            <Segment value={remaining.seconds} label="שנ׳" subtle />
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── child components (memoised) ─────────────────────── */

const Segment = memo(function Segment({
  value,
  label,
  subtle,
}: {
  value: number;
  label: string;
  /** Trailing segments (seconds) get a slight opacity drop so the days
   *  digit stays the visual anchor. All segments are the SAME font
   *  size — required so digits never jump heights at tick. */
  subtle?: boolean;
}) {
  const padded = value.toString().padStart(2, "0");
  return (
    <div className="flex flex-col items-center min-w-[60px] sm:min-w-[72px]">
      <span
        className={`ltr-num font-extrabold tracking-tight gradient-gold leading-none text-4xl sm:text-5xl md:text-6xl ${subtle ? "opacity-70" : ""}`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {padded}
      </span>
      <span
        className="mt-2 text-xs uppercase tracking-widest font-semibold"
        style={{ color: "var(--foreground-muted)" }}
      >
        {label}
      </span>
    </div>
  );
});

const Separator = memo(function Separator({ pulse }: { pulse?: boolean }) {
  return (
    <span
      aria-hidden
      className={`text-4xl sm:text-5xl md:text-6xl font-extrabold gradient-gold opacity-40 leading-none self-start ${
        pulse ? "animate-pulse" : ""
      }`}
    >
      :
    </span>
  );
});
