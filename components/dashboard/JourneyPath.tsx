"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { JourneyStepStatus } from "@/lib/journey";
import { fireConfetti } from "@/lib/confetti";

/**
 * R41 — the vertical journey path. One milestone per stage: a big
 * circle (done ✓ / active gold-pulse / locked 🔒 / upcoming number) on
 * the right, a card on the left. Crossing a milestone fires a small,
 * reduced-motion-aware confetti (no audio — deliberately quiet on the
 * couple's dashboard; avoids surprise sound + extra infra).
 */
export function JourneyPath({
  steps,
  progress,
}: {
  steps: JourneyStepStatus[];
  progress: { done: number; total: number; percent: number };
}) {
  // First unlocked-and-incomplete step = "do this now".
  const activeIdx = useMemo(
    () => steps.findIndex((s) => s.unlocked && !s.complete),
    [steps],
  );

  // Confetti only when `done` actually grows after mount (not on the
  // initial render, not on unrelated re-renders).
  const seeded = useRef(false);
  const prevDone = useRef(progress.done);
  useEffect(() => {
    if (!seeded.current) {
      seeded.current = true;
      prevDone.current = progress.done;
      return;
    }
    if (progress.done > prevDone.current) {
      prevDone.current = progress.done;
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) fireConfetti(900);
    } else {
      prevDone.current = progress.done;
    }
  }, [progress.done]);

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <span className="eyebrow">המסע</span>
          <h2 className="mt-2 text-2xl md:text-3xl font-bold gradient-text">
            מסע התכנון שלכם
          </h2>
        </div>
        <div className="text-end">
          <div
            className="text-3xl md:text-4xl font-extrabold gradient-gold ltr-num"
          >
            {progress.percent}%
          </div>
          <div
            className="text-[11px]"
            style={{ color: "var(--foreground-muted)" }}
          >
            <span className="ltr-num">
              {progress.done}/{progress.total}
            </span>{" "}
            שלבים
          </div>
        </div>
      </div>

      <ol className="relative">
        {steps.map((step, i) => {
          const isActive = i === activeIdx;
          const isLocked = !step.unlocked;
          const isDone = step.complete;
          const prevTitle = i > 0 ? steps[i - 1].def.title : null;
          return (
            <li key={step.def.id} className="flex items-stretch gap-4">
              {/* Circle + connector column */}
              <div className="flex flex-col items-center shrink-0">
                {/* R129 — SVG-based circle. R128's CSS flex+line-height
                    approach STILL rendered the number a few pixels above
                    center because the Heebo font's numeric glyphs sit
                    above the baseline-midpoint of their box. CSS
                    `align-items: center` aligns the box, not the visible
                    glyph. SVG <text> with `dominantBaseline="central"`
                    is geometrically true regardless of font metrics —
                    the number lands in the literal pixel center, every
                    time, every browser. */}
                <JourneyCircle
                  state={isDone ? "done" : isActive ? "active" : isLocked ? "locked" : "upcoming"}
                  number={step.order}
                />
                {i < steps.length - 1 && (
                  <span
                    className="w-px flex-1 my-1"
                    style={{
                      minHeight: 28,
                      background: isDone
                        ? "linear-gradient(180deg, rgba(52,211,153,0.5), var(--border-gold))"
                        : "var(--border)",
                    }}
                    aria-hidden
                  />
                )}
              </div>

              {/* Card */}
              <div className="flex-1 pb-6">
                <div
                  className="rounded-2xl p-4 md:p-5"
                  style={{
                    background: isActive
                      ? "rgba(212,176,104,0.08)"
                      : "var(--surface-1, rgba(255,255,255,0.02))",
                    border: `1px solid ${
                      isActive ? "var(--border-gold)" : "var(--border)"
                    }`,
                    opacity: isLocked ? 0.55 : 1,
                  }}
                >
                  <div className="font-bold text-base md:text-lg">
                    {step.def.title}
                  </div>
                  {step.def.description && (
                    <div
                      className="mt-1 text-sm leading-relaxed"
                      style={{ color: "var(--foreground-soft)" }}
                    >
                      {step.def.description}
                    </div>
                  )}
                  <div className="mt-3">
                    {isDone ? (
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "rgb(110,231,183)" }}
                      >
                        ✓ הושלם
                      </span>
                    ) : isActive ? (
                      <Link
                        href={step.def.href}
                        className="btn-gold inline-flex items-center gap-2 text-sm"
                        style={{ minHeight: 44 }}
                      >
                        התקדם
                        <ArrowLeft size={16} />
                      </Link>
                    ) : isLocked ? (
                      <span
                        className="text-xs"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        🔒{" "}
                        {prevTitle
                          ? `ייפתח אחרי "${prevTitle}"`
                          : "ייפתח בהמשך"}
                      </span>
                    ) : (
                      <Link
                        href={step.def.href}
                        className="text-sm font-semibold inline-flex items-center gap-1.5"
                        style={{ color: "var(--accent)" }}
                      >
                        פתח
                        <ArrowLeft size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * R129 — Pixel-perfect step circle rendered in SVG.
 *
 * The CSS-flex approach (R128) still rendered the number a few pixels
 * above the geometric center because text glyphs are positioned by
 * baseline, and most digital fonts have a baseline that's NOT the
 * vertical center of the glyph's bounding box. CSS `align-items:
 * center` aligns the line-box, not the visible glyph.
 *
 * SVG `<text dominantBaseline="central" textAnchor="middle">` is
 * geometrically true — it places the text's optical center at the
 * coordinates, regardless of font metrics. Same idea works for the
 * Check ✓ and Lock 🔒 glyphs: we hand-draw them in SVG paths so
 * they're positioned by stroke math, not font baseline.
 *
 * 64px outer with 1px stroke, padded coords so the stroke stays
 * inside the box. Active state gets a 6px soft gold halo via a
 * second larger circle behind the main one.
 */
function JourneyCircle({
  state,
  number,
}: {
  state: "done" | "active" | "locked" | "upcoming";
  number: number;
}) {
  const SIZE = 64;
  const STROKE = 1;
  const R = (SIZE - STROKE) / 2; // inner radius leaving space for stroke
  const CX = SIZE / 2;
  const CY = SIZE / 2;

  // Palette per state.
  const fill =
    state === "done"
      ? "rgba(52,211,153,0.15)"
      : state === "active"
        ? "url(#journey-active-gradient)"
        : "var(--input-bg)";
  const stroke =
    state === "done"
      ? "rgba(52,211,153,0.45)"
      : state === "active"
        ? "var(--border-gold)"
        : "var(--border)";
  const fg =
    state === "done"
      ? "rgb(110,231,183)"
      : state === "active"
        ? "var(--gold-button-text)"
        : "var(--foreground-muted)";

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient
          id="journey-active-gradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="var(--gold-100)" />
          <stop offset="100%" stopColor="var(--gold-500)" />
        </linearGradient>
      </defs>

      {/* Active-state halo (rendered first so it sits behind). */}
      {state === "active" && (
        <circle
          cx={CX}
          cy={CY}
          r={R + 4}
          fill="rgba(212,176,104,0.16)"
          stroke="none"
        />
      )}

      {/* Main circle */}
      <circle
        cx={CX}
        cy={CY}
        r={R - 3}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE}
      />

      {/* Content: ✓ / 🔒 / number — all centered via SVG geometry. */}
      {state === "done" ? (
        // Checkmark path — coordinates relative to circle center, so
        // it's perfectly visually centered.
        <path
          d={`M ${CX - 9} ${CY + 1} l 6 6 l 12 -12`}
          stroke={fg}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : state === "locked" ? (
        // Lock body + shackle. Body is a rounded rect, shackle is a
        // partial arc. Hand-drawn so it lines up with the circle.
        <g stroke={fg} strokeWidth={2} fill="none" strokeLinecap="round">
          <rect
            x={CX - 8}
            y={CY - 2}
            width={16}
            height={14}
            rx={2}
            fill={fg}
            stroke="none"
          />
          <path
            d={`M ${CX - 5} ${CY - 2} v -4 a 5 5 0 0 1 10 0 v 4`}
          />
        </g>
      ) : (
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={20}
          fontWeight={800}
          fill={fg}
          style={{
            fontFamily: "inherit",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {number}
        </text>
      )}
    </svg>
  );
}
