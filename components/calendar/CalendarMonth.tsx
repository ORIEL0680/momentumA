"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import {
  getPriceInfo,
  type PriceInfo,
} from "@/lib/calendar/pricing-model";
import { formatHebrewDate, getHebrewMonth } from "@/lib/calendar/hebrew-calendar";
import { PriceTooltip } from "./PriceTooltip";
import { PriceHeatmapLegend } from "./PriceHeatmapLegend";

/**
 * R65 (R55) — month-view calendar with Israeli-pricing heatmap.
 *
 * Client component (month navigation + selection state). All pricing
 * computed lazily via useMemo keyed on `monthStart` — re-renders on
 * navigation but not on selection changes.
 *
 * RTL: grid-cols-7 inside a dir="rtl" container flows Sunday (col 1 =
 * rightmost) through Saturday (col 7 = leftmost). Week-day labels
 * stored in source order; the RTL flow renders them right-to-left.
 *
 * Accessibility: each cell is a `<button>` with descriptive aria-label
 * + aria-pressed for the selected day; the price detail panel below
 * acts as a live region that updates on selection.
 */

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"] as const;
const HEBREW_GREG_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

function startOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface Cell {
  date: Date;
  inMonth: boolean;
  info: PriceInfo;
  iso: string;
}

function buildGrid(monthStart: Date): Cell[] {
  // Back up from the 1st of the month to the prior Sunday (RTL grid
  // starts on Sunday in week column 0).
  const firstDow = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - firstDow);
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      date: d,
      inMonth: d.getMonth() === monthStart.getMonth(),
      info: getPriceInfo(d),
      iso: d.toISOString().slice(0, 10),
    });
  }
  return cells;
}

export function CalendarMonth({ initialDate }: { initialDate?: Date }) {
  // `today` is computed once on mount (avoids the "first paint shows
  // yesterday after midnight" edge case during a long session).
  const [today] = useState<Date>(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });
  const [monthStart, setMonthStart] = useState<Date>(() =>
    startOfMonth(initialDate ?? new Date()),
  );
  const [selectedIso, setSelectedIso] = useState<string>(() =>
    (initialDate ?? new Date()).toISOString().slice(0, 10),
  );

  const cells = useMemo(() => buildGrid(monthStart), [monthStart]);
  const selectedCell = cells.find((c) => c.iso === selectedIso) ?? cells[0];

  const goPrev = () => {
    const next = new Date(monthStart);
    next.setMonth(next.getMonth() - 1);
    setMonthStart(startOfMonth(next));
  };
  const goNext = () => {
    const next = new Date(monthStart);
    next.setMonth(next.getMonth() + 1);
    setMonthStart(startOfMonth(next));
  };
  const goToday = () => {
    setMonthStart(startOfMonth(today));
    setSelectedIso(today.toISOString().slice(0, 10));
  };

  const monthLabel = HEBREW_GREG_MONTHS[monthStart.getMonth()];
  const yearLabel = String(monthStart.getFullYear());
  const hebMonthLabel = formatHebrewYearMonth(monthStart);

  return (
    <section className="card p-5 md:p-6">
      {/* Header — month label + navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">
            <span>{monthLabel}</span>{" "}
            <span className="ltr-num">{yearLabel}</span>
          </h2>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--foreground-soft)" }}
          >
            {hebMonthLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={goPrev}
            aria-label="חודש קודם"
            className="w-10 h-10 rounded-full flex items-center justify-center transition hover:bg-[var(--secondary-button-bg)]"
            style={{ border: "1px solid var(--border)" }}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-full px-3.5 py-2 text-sm font-semibold inline-flex items-center gap-1.5 transition hover:bg-[var(--secondary-button-bg)]"
            style={{ border: "1px solid var(--border-gold)", color: "var(--accent)" }}
          >
            <CalendarIcon size={14} aria-hidden />
            היום
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="חודש הבא"
            className="w-10 h-10 rounded-full flex items-center justify-center transition hover:bg-[var(--secondary-button-bg)]"
            style={{ border: "1px solid var(--border)" }}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
        </div>
      </div>

      {/* Week-day strip */}
      <div
        className="grid grid-cols-7 gap-1 mb-2 text-xs font-semibold text-center"
        dir="rtl"
        aria-hidden
      >
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className="py-2"
            style={{
              color:
                i === 6
                  ? "var(--foreground-muted)"
                  : "var(--foreground-soft)",
            }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Month grid — plain visual grid; each cell is a <button> with
          an aria-label and aria-pressed for the selection state. */}
      <div
        className="grid grid-cols-7 gap-1"
        dir="rtl"
        aria-label="לוח חודשי"
      >
        {cells.map((cell) => {
          const isToday = isSameDay(cell.date, today);
          const isSelected = cell.iso === selectedIso;
          const dayNum = cell.date.getDate();
          const tintAlpha = cell.inMonth ? "33" : "12";
          const ariaLabel = `${cell.date.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })} · ${cell.info.label}`;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => setSelectedIso(cell.iso)}
              aria-label={ariaLabel}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              className="aspect-square rounded-lg p-1.5 text-start flex flex-col transition relative outline-none focus-visible:ring-2"
              style={{
                background: `${cell.info.color}${tintAlpha}`,
                border: isToday
                  ? "1.5px solid var(--accent)"
                  : isSelected
                    ? "1.5px solid var(--border-gold)"
                    : "1px solid transparent",
                opacity: cell.inMonth ? 1 : 0.45,
                // @ts-expect-error — CSS var for focus ring color
                "--tw-ring-color": "var(--accent)",
              }}
            >
              <span
                className="text-sm md:text-base font-bold ltr-num leading-none"
                style={{
                  color:
                    cell.info.level === "blocked"
                      ? "var(--foreground-muted)"
                      : "var(--foreground)",
                }}
              >
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <PriceHeatmapLegend />
      </div>

      {/* Selected-date detail */}
      {selectedCell && (
        <PriceTooltip date={selectedCell.date} info={selectedCell.info} />
      )}
    </section>
  );
}

function formatHebrewYearMonth(date: Date): string {
  // Take the 15th-of-month sample — Hebrew month boundaries don't align
  // with Gregorian, but mid-month is always inside the Hebrew month
  // that "owns" most of the Gregorian month.
  const sample = new Date(date.getFullYear(), date.getMonth(), 15);
  const hMonth = getHebrewMonth(sample);
  const fullHeb = formatHebrewDate(sample);
  // formatHebrewDate returns e.g. "ט״ו אייר תשפ״ו" — strip the day for
  // a "month year" rendering.
  const yearPart = fullHeb.split(" ").slice(-1).join(" ");
  return `${hMonth} ${yearPart}`;
}
