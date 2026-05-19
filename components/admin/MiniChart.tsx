/**
 * R59 (R49) — 7-point sparkline. Pure SVG, no deps, no client JS.
 * Renders a soft gold area + line; flat/empty series degrades to a
 * baseline so the card never looks broken.
 */
export function MiniChart({
  data,
  height = 40,
  className = "",
}: {
  data: number[];
  height?: number;
  className?: string;
}) {
  const w = 100; // viewBox units; scales to container width
  const n = data.length;
  if (n < 2) {
    return (
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        className={className}
        style={{ width: "100%", height }}
        aria-hidden
      >
        <line
          x1="0"
          y1={height - 1}
          x2={w}
          y2={height - 1}
          stroke="var(--border)"
          strokeWidth="1"
        />
      </svg>
    );
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = (i / (n - 1)) * w;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area =
    `0,${height} ` +
    pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ") +
    ` ${w},${height}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height }}
      aria-hidden
    >
      <polygon points={area} fill="var(--accent)" opacity="0.12" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.65"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
