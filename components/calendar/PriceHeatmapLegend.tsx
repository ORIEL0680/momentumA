/**
 * R65 (R55) — six-step legend strip explaining the heatmap colors.
 * Server-safe, pure presentation.
 */

interface Item {
  label: string;
  hex: string;
}

const ITEMS: Item[] = [
  { label: "מצוין", hex: "#4ade80" },
  { label: "טוב", hex: "#86efac" },
  { label: "רגיל", hex: "#fbbf24" },
  { label: "יקר", hex: "#fb923c" },
  { label: "פיק", hex: "#ef4444" },
  { label: "לא זמין", hex: "#6b7280" },
];

export function PriceHeatmapLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-3 text-xs"
      role="list"
      aria-label="מקרא מחירים"
    >
      {ITEMS.map((it) => (
        <div
          key={it.label}
          role="listitem"
          className="inline-flex items-center gap-1.5"
          style={{ color: "var(--foreground-soft)" }}
        >
          <span
            aria-hidden
            className="w-3 h-3 rounded-sm"
            style={{ background: it.hex }}
          />
          {it.label}
        </div>
      ))}
    </div>
  );
}
