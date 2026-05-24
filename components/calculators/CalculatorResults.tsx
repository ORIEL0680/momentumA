"use client";

import { useMemo } from "react";

export interface BreakdownItem {
  category: string;
  value: number;
  color: string;
}

interface Props {
  total: number;
  breakdown: BreakdownItem[];
  budgetLimit?: number;
  benchmark?: number; // Israeli average
}

type StatusKey = "good" | "tight" | "over" | "critical" | "neutral";

const STATUS_UI: Record<
  StatusKey,
  { emoji: string; color: string; label: string }
> = {
  good: { emoji: "😊", color: "#4ade80", label: "מעולה — יש מרווח" },
  tight: { emoji: "😐", color: "#fbbf24", label: "צמוד — שווה לבדוק" },
  over: { emoji: "⚠️", color: "#fb923c", label: "חריגה קלה" },
  critical: { emoji: "🚨", color: "#ef4444", label: "חריגה משמעותית" },
  neutral: { emoji: "💛", color: "#D4B068", label: "תוצאה" },
};

/** Pure-SVG donut chart — no external chart library needed. */
function DonutChart({
  data,
  total,
}: {
  data: BreakdownItem[];
  total: number;
}) {
  const R = 80;
  const cx = 100;
  const cy = 100;
  const strokeW = 22;
  const circ = 2 * Math.PI * R;

  // Build arc segments
  const segments = useMemo(() => {
    let offset = -Math.PI / 2; // start at 12 o'clock
    return data
      .filter((d) => d.value > 0)
      .map((d) => {
        const fraction = total > 0 ? d.value / total : 0;
        const angle = fraction * 2 * Math.PI;
        const startAngle = offset;
        const endAngle = offset + angle;
        offset = endAngle;

        const x1 = cx + R * Math.cos(startAngle);
        const y1 = cy + R * Math.sin(startAngle);
        const x2 = cx + R * Math.cos(endAngle);
        const y2 = cy + R * Math.sin(endAngle);
        const largeArc = angle > Math.PI ? 1 : 0;

        return {
          ...d,
          fraction,
          path: `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`,
        };
      });
  }, [data, total]);

  if (segments.length === 0) {
    return (
      <div
        className="h-52 flex items-center justify-center text-sm"
        style={{ color: "var(--foreground-muted)" }}
      >
        מלאו ערכים כדי לראות תובנות
      </div>
    );
  }

  const kLabel = `₪${Math.round(total / 1000)}K`;

  return (
    <div className="relative h-52 flex items-center justify-center">
      <svg
        viewBox="0 0 200 200"
        className="w-52 h-52"
        aria-hidden
        style={{ overflow: "visible" }}
      >
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="var(--input-bg)"
          strokeWidth={strokeW}
        />
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.path}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        ))}
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span
          className="text-[10px] uppercase tracking-widest"
          style={{ color: "var(--foreground-muted)" }}
        >
          סה&quot;כ
        </span>
        <span className="text-xl font-bold ltr-num gradient-gold">
          {kLabel}
        </span>
      </div>
    </div>
  );
}

export function CalculatorResults({
  total,
  breakdown,
  budgetLimit,
  benchmark,
}: Props) {
  const status = useMemo((): StatusKey => {
    if (!budgetLimit) return "neutral";
    const ratio = total / budgetLimit;
    if (ratio <= 0.85) return "good";
    if (ratio <= 1.0) return "tight";
    if (ratio <= 1.15) return "over";
    return "critical";
  }, [total, budgetLimit]);

  const ui = STATUS_UI[status];

  return (
    <div className="space-y-5">
      {/* Headline */}
      <div className="text-center">
        <div className="text-5xl mb-2" aria-hidden>
          {ui.emoji}
        </div>
        <div
          className="font-extrabold ltr-num leading-none gradient-gold transition-all duration-500"
          style={{
            fontSize: "clamp(2.8rem, 10vw, 4.25rem)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ₪{total.toLocaleString("he-IL")}
        </div>
        <div className="text-sm mt-3 font-semibold" style={{ color: ui.color }}>
          {ui.label}
        </div>
      </div>

      {/* Donut */}
      <DonutChart data={breakdown} total={total} />

      {/* Legend */}
      {breakdown.length > 0 && (
        <div className="space-y-2">
          {breakdown
            .filter((b) => b.value > 0)
            .map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: item.color }}
                  />
                  <span style={{ color: "var(--foreground-soft)" }}>
                    {item.category}
                  </span>
                </div>
                <div
                  className="font-bold ltr-num tabular-nums"
                  style={{ color: "var(--foreground)" }}
                >
                  ₪{item.value.toLocaleString("he-IL")}
                  <span
                    className="text-xs mr-1.5"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    ({Math.round((item.value / total) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Budget comparison bar */}
      {budgetLimit != null && budgetLimit > 0 && (
        <div className="space-y-2">
          <div
            className="flex justify-between text-xs"
            style={{ color: "var(--foreground-muted)" }}
          >
            <span>התקציב שלך</span>
            <span className="font-bold ltr-num">
              ₪{budgetLimit.toLocaleString("he-IL")}
            </span>
          </div>
          <div
            className="h-3 rounded-full overflow-hidden"
            style={{ background: "var(--input-bg)" }}
          >
            <div
              className="h-full transition-all duration-700 ease-out rounded-full"
              style={{
                width: `${Math.min(100, (total / budgetLimit) * 100)}%`,
                background: ui.color,
              }}
            />
          </div>
          <div className="text-xs text-end ltr-num" style={{ color: ui.color }}>
            {Math.round((total / budgetLimit) * 100)}% מהתקציב
          </div>
        </div>
      )}

      {/* Benchmark */}
      {benchmark != null && benchmark > 0 && (
        <div
          className="p-4 rounded-2xl text-sm"
          style={{ background: "var(--input-bg)" }}
        >
          <div
            className="flex justify-between mb-2"
            style={{ color: "var(--foreground-soft)" }}
          >
            <span>ממוצע ישראלי דומה</span>
            <span className="font-bold ltr-num">
              ₪{benchmark.toLocaleString("he-IL")}
            </span>
          </div>
          <div
            className="text-xs leading-relaxed"
            style={{ color: "var(--foreground-muted)" }}
          >
            {total < benchmark
              ? `🟢 אתם ${Math.round((1 - total / benchmark) * 100)}% מתחת לממוצע — חיסכון יפה`
              : total > benchmark
                ? `🟠 אתם ${Math.round((total / benchmark - 1) * 100)}% מעל הממוצע`
                : "🟡 בדיוק בממוצע"}
          </div>
        </div>
      )}
    </div>
  );
}
