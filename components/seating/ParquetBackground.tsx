"use client";

/**
 * R80 + R81 — Canvas background.
 *
 * R80 shipped a brown wood-parquet pattern. R81 swaps it for a pure
 * gold-on-black look: deep black floor, faint gold grid (every 60u),
 * radial vignette darkening the corners. Same `defs` interface
 * (`#goldGlow` filter is still defined here for table fills).
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
        {/* Subtle gold grid — small, dim, just enough to read distance. */}
        <pattern
          id="floor-grid"
          x={0}
          y={0}
          width={60}
          height={60}
          patternUnits="userSpaceOnUse"
        >
          <rect width={60} height={60} fill="transparent" />
          <line
            x1={0}
            y1={0}
            x2={60}
            y2={0}
            stroke="#D4B068"
            strokeOpacity={0.06}
            strokeWidth={0.5}
          />
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={60}
            stroke="#D4B068"
            strokeOpacity={0.06}
            strokeWidth={0.5}
          />
        </pattern>

        {/* Floor tone — near-black with the faintest gold warmth. */}
        <linearGradient id="floor-tone" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0F0D0A" />
          <stop offset="100%" stopColor="#08070A" />
        </linearGradient>

        {/* Vignette — darker at the edges so the eye centers on the dance floor. */}
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="55%" stopColor="black" stopOpacity={0} />
          <stop offset="100%" stopColor="black" stopOpacity={0.55} />
        </radialGradient>

        {/* Glow filter reused by full tables + dance floor accents. */}
        <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#F4DEA9" floodOpacity="0.55" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Softer glow for selection halos — quieter than goldGlow. */}
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feFlood floodColor="#F4DEA9" floodOpacity="0.35" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x={0} y={0} width={width} height={height} fill="url(#floor-tone)" />
      <rect x={0} y={0} width={width} height={height} fill="url(#floor-grid)" />
      <rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
    </>
  );
}
