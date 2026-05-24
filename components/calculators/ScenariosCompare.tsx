"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Check } from "lucide-react";
import { actions } from "@/lib/store";
import { showToast } from "@/components/Toast";
import type { BreakdownItem } from "./CalculatorResults";

interface SavedScenario {
  id: number;
  total: number;
  breakdown: BreakdownItem[];
  savedAt: string;
}

interface Props {
  /** localStorage key prefix, e.g. "momentum.scenarios.מעבדת-התקציב" */
  storageKey: string;
  onClose: () => void;
}

function MiniDonut({
  data,
  total,
}: {
  data: BreakdownItem[];
  total: number;
}) {
  const R = 36;
  const cx = 44;
  const cy = 44;
  const strokeW = 10;

  const segments = useMemo(() => {
    const filtered = data.filter((d) => d.value > 0 && total > 0);
    const startBase = -Math.PI / 2;
    const offsets = filtered.map((_, i) =>
      filtered
        .slice(0, i)
        .reduce((s, x) => s + (x.value / total) * 2 * Math.PI, startBase),
    );
    return filtered.map((d, i) => {
      const angle = (d.value / total) * 2 * Math.PI;
      const start = offsets[i];
      const end = start + angle;
      const x1 = cx + R * Math.cos(start);
      const y1 = cy + R * Math.sin(start);
      const x2 = cx + R * Math.cos(end);
      const y2 = cy + R * Math.sin(end);
      return {
        ...d,
        path: `M ${x1} ${y1} A ${R} ${R} 0 ${angle > Math.PI ? 1 : 0} 1 ${x2} ${y2}`,
      };
    });
  }, [data, total]);

  if (segments.length === 0) {
    return (
      <div
        className="w-22 h-22 rounded-full flex items-center justify-center"
        style={{ background: "var(--input-bg)" }}
      >
        <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
          —
        </span>
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg viewBox="0 0 88 88" className="w-20 h-20" aria-hidden>
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
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[10px] font-bold ltr-num"
          style={{ color: "var(--foreground-muted)" }}
        >
          ₪{Math.round(total / 1000)}K
        </span>
      </div>
    </div>
  );
}

function readScenarios(storageKey: string): SavedScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as SavedScenario[]) : [];
  } catch {
    return [];
  }
}

export function ScenariosCompare({ storageKey, onClose }: Props) {
  // Lazy initialization — read from localStorage once on mount.
  // Avoids react-hooks/set-state-in-effect by reading synchronously
  // during the first render instead of in an effect.
  const [scenarios, setScenarios] = useState<SavedScenario[]>(() =>
    readScenarios(storageKey),
  );

  // Esc-to-close + lock background scroll on mobile.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const minTotal = useMemo(
    () => Math.min(...scenarios.map((s) => s.total)),
    [scenarios],
  );

  const handleSelect = (scenario: SavedScenario) => {
    const items = scenario.breakdown.filter((b) => b.value > 0);
    items.forEach((b) => {
      actions.addBudgetItem({
        category: "other",
        title: b.category,
        estimated: b.value,
      });
    });
    showToast(`✓ תרחיש נשמר לתקציב — ${items.length} סעיפים`, "success");
    onClose();
  };

  const handleClear = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setScenarios([]);
    onClose();
  };

  if (scenarios.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={onClose}
      >
        <div
          className="card p-8 text-center max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-4xl mb-3">📊</div>
          <p style={{ color: "var(--foreground-soft)" }}>
            אין תרחישים שמורים עדיין.
            <br />
            לחצו על &quot;השווה תרחישים&quot; לאחר כל חישוב כדי לשמור.
          </p>
          <button onClick={onClose} className="btn-secondary mt-5 w-full">
            סגור
          </button>
        </div>
      </div>
    );
  }

  const labels = ["תרחיש A", "תרחיש B", "תרחיש C"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="font-bold text-lg">השוואת תרחישים</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-white/10"
            aria-label="סגור"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scenarios grid */}
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `repeat(${scenarios.length}, 1fr)`,
            background: "var(--border)",
          }}
        >
          {scenarios.map((sc, i) => {
            const diff = sc.total - minTotal;
            const isCheapest = sc.total === minTotal;
            return (
              <div
                key={sc.id}
                className="p-5 flex flex-col items-center text-center gap-3"
                style={{ background: "var(--surface-2)" }}
              >
                <div
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{
                    color: isCheapest ? "#4ade80" : "var(--foreground-muted)",
                  }}
                >
                  {labels[i]}
                  {isCheapest && scenarios.length > 1 ? " ✨" : ""}
                </div>

                <MiniDonut data={sc.breakdown} total={sc.total} />

                <div
                  className="text-2xl font-extrabold ltr-num gradient-gold"
                >
                  ₪{sc.total.toLocaleString("he-IL")}
                </div>

                {/* Diff from cheapest */}
                {scenarios.length > 1 && (
                  <div
                    className="text-xs font-semibold ltr-num"
                    style={{
                      color: isCheapest
                        ? "#4ade80"
                        : "var(--foreground-muted)",
                    }}
                  >
                    {isCheapest
                      ? "הכי זול"
                      : `+₪${diff.toLocaleString("he-IL")}`}
                  </div>
                )}

                {/* Breakdown mini-list */}
                <div className="w-full space-y-1 text-start">
                  {sc.breakdown
                    .filter((b) => b.value > 0)
                    .slice(0, 4)
                    .map((b) => (
                      <div
                        key={b.category}
                        className="flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: b.color }}
                          />
                          <span
                            style={{ color: "var(--foreground-muted)" }}
                          >
                            {b.category}
                          </span>
                        </div>
                        <span
                          className="font-semibold ltr-num"
                          style={{ color: "var(--foreground-soft)" }}
                        >
                          ₪{b.value.toLocaleString("he-IL")}
                        </span>
                      </div>
                    ))}
                </div>

                <button
                  onClick={() => handleSelect(sc)}
                  className="action-btn primary w-full mt-2 text-sm"
                  style={{ minHeight: 42 }}
                >
                  <Check size={14} />
                  בחר תרחיש
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="p-4 flex justify-between items-center border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={handleClear}
            className="text-xs underline"
            style={{ color: "var(--foreground-muted)" }}
          >
            נקה תרחישים
          </button>
          <button onClick={onClose} className="btn-secondary text-sm px-6">
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
