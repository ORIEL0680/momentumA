"use client";

/**
 * R80 — Parquet wood-floor pattern for the seating architect canvas.
 *
 * Renders as <defs> + two full-canvas rects (the pattern + a vignette
 * gradient). Imported once inside the root <svg>; consumers don't
 * need to know the implementation details.
 *
 * The pattern is a 80×40 tile with two staggered "plank" rectangles
 * and thin dark seams. At the canvas's default 1200×800 viewBox this
 * produces ~15 × 20 = 300 visible planks — dense enough to read as
 * "real" wood without being noisy.
 *
 * Performance: the pattern is GPU-rasterized once and tiled; cost is
 * a single draw call regardless of plank count. The gold-glow filter
 * (used by full tables) lives here too so consumers can reference it
 * via `filter="url(#goldGlow)"` without re-declaring.
 */
export function ParquetBackground({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <>
      <defs>
        <pattern
          id="parquet"
          x="0"
          y="0"
          width={80}
          height={40}
          patternUnits="userSpaceOnUse"
        >
          {/* base plank tone */}
          <rect width={80} height={40} fill="#3A2818" />
          {/* lighter staggered half */}
          <rect x={0} y={0} width={40} height={40} fill="#4A3220" opacity={0.6} />
          {/* dark seams */}
          <line
            x1={40}
            y1={0}
            x2={40}
            y2={40}
            stroke="#2A1F15"
            strokeWidth={0.5}
          />
          <line
            x1={0}
            y1={20}
            x2={80}
            y2={20}
            stroke="#2A1F15"
            strokeWidth={0.5}
          />
        </pattern>

        {/* Soft radial vignette darkens the edges so the eye centers
            on the dance floor + tables. */}
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="black" stopOpacity={0} />
          <stop offset="100%" stopColor="black" stopOpacity={0.4} />
        </radialGradient>

        {/* Reusable glow filter for "full" tables and dance-floor accents. */}
        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#F4DEA9" floodOpacity="0.5" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x={0} y={0} width={width} height={height} fill="url(#parquet)" />
      <rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
    </>
  );
}
