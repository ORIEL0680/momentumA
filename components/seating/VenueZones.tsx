"use client";

/**
 * R80 — Venue zones layer for the seating architect canvas.
 *
 * Renders the four fixed reference points a host (and their guests)
 * navigate by: the dance floor (centerpiece), the stage (front-left),
 * the bar (back-left), and the entrance (back-right).
 *
 * The dance floor pulses gold at 4s — slow enough not to distract
 * from drag interactions, fast enough to feel alive. Respects
 * `prefers-reduced-motion` via framer-motion's MotionConfig (set on
 * the parent ArchitectCanvas).
 *
 * Coordinates default to a 1200×800 venue. Callers can override any
 * subset by passing a partial `layout` prop — useful when the host
 * customizes their floor plan via the (future) layout editor. Zones
 * the host hasn't touched fall back to the defaults so the canvas
 * never renders an empty floor.
 */

import { motion } from "framer-motion";
import type { VenueLayout } from "@/lib/types";

const DEFAULTS: Required<
  Pick<VenueLayout, "danceFloor" | "stage" | "bar" | "entrance">
> = {
  danceFloor: { x: 400, y: 250, w: 400, h: 300 },
  stage: { x: 500, y: 50, w: 200, h: 80 },
  bar: { x: 50, y: 650, w: 150, h: 80 },
  entrance: { x: 1050, y: 650, w: 120, h: 80 },
};

export function VenueZones({ layout }: { layout?: VenueLayout }) {
  const dance = layout?.danceFloor ?? DEFAULTS.danceFloor;
  const stage = layout?.stage ?? DEFAULTS.stage;
  const bar = layout?.bar ?? DEFAULTS.bar;
  const entrance = layout?.entrance ?? DEFAULTS.entrance;
  // DEFAULTS.entrance has both w + h (required at the literal); the
  // VenueLayout type makes them optional so a partial override (only x,y)
  // is legal. Fall back to the defaults' values when either is omitted.
  const entranceW = entrance.w ?? DEFAULTS.entrance.w ?? 120;
  const entranceH = entrance.h ?? DEFAULTS.entrance.h ?? 80;

  return (
    <g className="venue-zones" aria-hidden>
      {/* ── Dance floor — pulsing centerpiece ────────────────────────── */}
      <defs>
        <radialGradient id="danceFloorGradient" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#F4DEA9" stopOpacity={0.45} />
          <stop offset="70%" stopColor="#D4B068" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#A8884A" stopOpacity={0.08} />
        </radialGradient>
      </defs>

      <motion.g
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <rect
          x={dance.x}
          y={dance.y}
          width={dance.w}
          height={dance.h}
          rx={20}
          fill="url(#danceFloorGradient)"
          stroke="#D4B068"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
        <text
          x={dance.x + dance.w / 2}
          y={dance.y + dance.h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={24}
          fontWeight={700}
          fill="#F4DEA9"
          opacity={0.65}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          ✨ רחבת ריקודים ✨
        </text>
      </motion.g>

      {/* ── Stage ────────────────────────────────────────────────────── */}
      <g>
        <rect
          x={stage.x}
          y={stage.y}
          width={stage.w}
          height={stage.h}
          rx={10}
          fill="#2A1F15"
          stroke="#D4B068"
          strokeWidth={1.5}
        />
        <text
          x={stage.x + stage.w / 2}
          y={stage.y + stage.h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={18}
          fontWeight={600}
          fill="#F4DEA9"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          🎤 במה
        </text>
      </g>

      {/* ── Bar ──────────────────────────────────────────────────────── */}
      <g>
        <rect
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          rx={10}
          fill="#2A1F15"
          stroke="#D4B068"
          strokeWidth={1.5}
        />
        <text
          x={bar.x + bar.w / 2}
          y={bar.y + bar.h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={18}
          fontWeight={600}
          fill="#F4DEA9"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          🍷 בר
        </text>
      </g>

      {/* ── Entrance ─────────────────────────────────────────────────── */}
      <g>
        <rect
          x={entrance.x}
          y={entrance.y}
          width={entranceW}
          height={entranceH}
          rx={10}
          fill="#2A1F15"
          stroke="#D4B068"
          strokeWidth={1.5}
        />
        <text
          x={entrance.x + entranceW / 2}
          y={entrance.y + entranceH / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={18}
          fontWeight={600}
          fill="#F4DEA9"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          🚪 כניסה
        </text>
      </g>
    </g>
  );
}
