"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Printer,
} from "lucide-react";
import {
  getPriceInfo,
  type PriceInfo,
} from "@/lib/calendar/pricing-model";
import { formatHebrewDate, getHebrewMonth } from "@/lib/calendar/hebrew-calendar";
import { useNow, daysUntil } from "@/lib/useNow";
import { PriceTooltip } from "./PriceTooltip";
import { PriceHeatmapLegend } from "./PriceHeatmapLegend";
import type { Appointment } from "@/lib/calendar/appointments";

/**
 * R67 (R56) — month-view calendar with Israeli-pricing heatmap PLUS
 * appointments layer + Wedding Brain suggestions + wedding-day square.
 *
 * Display:
 *   - Each cell tinted by PriceLevel (R65).
 *   - Appointments → small gold dots in the cell footer; "+N" when 4+.
 *   - Pending AI suggestions → ✨ pulse marker.
 *   - The event date (wedding day) → solid gold square + 💍 + pulse.
 *
 * Orchestration (fetching, sheet/popover open state, accept/dismiss)
 * lives in the parent CalendarClient. This component renders + fires
 * callbacks on click.
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

function isoDay(d: Date): string {
  // Local-time YYYY-MM-DD (NOT toISOString, which uses UTC).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return isoDay(a) === isoDay(b);
}

interface Cell {
  date: Date;
  inMonth: boolean;
  info: PriceInfo;
  iso: string;
}

function buildGrid(monthStart: Date): Cell[] {
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
      iso: isoDay(d),
    });
  }
  return cells;
}

export interface CalendarMonthProps {
  appointments: Appointment[];
  /** Wedding day, or null if the user hasn't set one yet. */
  eventDate: Date | null;
  weddingTitle?: string;
  initialDate?: Date;
  onAddClick: (date?: Date) => void;
  onAppointmentClick: (apt: Appointment) => void;
  onSuggestionClick: (apt: Appointment) => void;
}

export function CalendarMonth({
  appointments,
  eventDate,
  weddingTitle,
  initialDate,
  onAddClick,
  onAppointmentClick,
  onSuggestionClick,
}: CalendarMonthProps) {
  const [today] = useState<Date>(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });
  const [monthStart, setMonthStart] = useState<Date>(() =>
    startOfMonth(initialDate ?? new Date()),
  );
  const [selectedIso, setSelectedIso] = useState<string>(() =>
    isoDay(initialDate ?? new Date()),
  );
  // R69 — countdown subtitle ("X ימים לחתונה"). useNow ticks once a
  // minute; daysUntil returns null until the client hydrates.
  const nowMs = useNow();
  const countdown = eventDate ? daysUntil(eventDate, nowMs) : null;

  const cells = useMemo(() => buildGrid(monthStart), [monthStart]);

  // Bucket appointments by local-day so each cell renders in O(1).
  const apptsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const key = isoDay(new Date(a.start_at));
      const bucket = map.get(key);
      if (bucket) bucket.push(a);
      else map.set(key, [a]);
    }
    return map;
  }, [appointments]);

  const selectedCell = cells.find((c) => c.iso === selectedIso) ?? cells[0];
  const selectedAppts = selectedCell
    ? (apptsByDay.get(selectedCell.iso) ?? [])
    : [];

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
    setSelectedIso(isoDay(today));
  };

  const monthLabel = HEBREW_GREG_MONTHS[monthStart.getMonth()];
  const yearLabel = String(monthStart.getFullYear());
  const hebMonthLabel = formatHebrewYearMonth(monthStart);
  const eventIso = eventDate ? isoDay(eventDate) : null;

  return (
    <section className="card p-5 md:p-7">
      {/* R69 — premium header. Eyebrow + large month name + Hebrew/
          countdown subtitle on the right; action cluster on the left.
          Wraps gracefully on narrow viewports. */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div className="min-w-0">
          <span className="eyebrow">חודש</span>
          <h2 className="mt-1.5 text-3xl md:text-[2.25rem] font-bold leading-tight gradient-text">
            <span>{monthLabel}</span>{" "}
            <span className="ltr-num">{yearLabel}</span>
          </h2>
          <p
            className="mt-1.5 text-sm"
            style={{ color: "var(--foreground-soft)" }}
          >
            <span>{hebMonthLabel}</span>
            {countdown != null && countdown > 0 && (
              <>
                <span
                  className="mx-2"
                  style={{ color: "var(--foreground-muted)" }}
                  aria-hidden
                >
                  •
                </span>
                <span style={{ color: "var(--accent)" }}>
                  <span className="ltr-num">{countdown}</span> ימים לחתונה
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={goPrev}
            aria-label="חודש קודם"
            className="w-10 h-10 rounded-full flex items-center justify-center transition hover:bg-[var(--secondary-button-bg)] hover:-translate-y-0.5"
            style={{ border: "1px solid var(--border)" }}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-full px-3.5 py-2 text-sm font-semibold inline-flex items-center gap-1.5 transition hover:bg-[var(--secondary-button-bg)] hover:-translate-y-0.5"
            style={{ border: "1px solid var(--border-gold)", color: "var(--accent)" }}
          >
            <CalendarIcon size={14} aria-hidden />
            היום
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="חודש הבא"
            className="w-10 h-10 rounded-full flex items-center justify-center transition hover:bg-[var(--secondary-button-bg)] hover:-translate-y-0.5"
            style={{ border: "1px solid var(--border)" }}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <Link
            href="/calendar/print"
            aria-label="גרסה להדפסה"
            className="w-10 h-10 rounded-full flex items-center justify-center transition hover:bg-[var(--secondary-button-bg)] hover:-translate-y-0.5"
            style={{
              border: "1px solid var(--border)",
              color: "var(--foreground-soft)",
            }}
          >
            <Printer size={15} aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => onAddClick()}
            className="btn-gold inline-flex items-center gap-1.5"
            style={{ padding: "0.55rem 1rem", fontSize: "0.85rem" }}
            aria-label="הוסף פגישה"
          >
            <Plus size={14} aria-hidden /> הוסף
          </button>
        </div>
      </div>

      {/* Week-day strip */}
      <div
        className="grid grid-cols-7 gap-x-2 gap-y-3 mb-3 text-xs font-semibold uppercase tracking-wider text-center"
        dir="rtl"
        aria-hidden
      >
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className="py-1.5"
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

      {/* Month grid — R69 tighter horizontal rhythm, more vertical air. */}
      <div
        className="grid grid-cols-7 gap-x-2 gap-y-3"
        dir="rtl"
        aria-label="לוח חודשי"
      >
        {cells.map((cell) => {
          const isToday = isSameDay(cell.date, today);
          const isSelected = cell.iso === selectedIso;
          const isWedding = eventIso === cell.iso;
          const dayNum = cell.date.getDate();
          const tintAlpha = cell.inMonth ? "33" : "12";
          const dayAppts = apptsByDay.get(cell.iso) ?? [];
          const confirmed = dayAppts.filter(
            (a) => a.source === "manual" || a.ai_status === "accepted",
          );
          const pendingSuggestions = dayAppts.filter(
            (a) => a.source === "ai_suggestion" && a.ai_status === "pending",
          );
          const ariaLabel = isWedding
            ? `${cell.date.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })} · יום האירוע`
            : `${cell.date.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })} · ${cell.info.label}${confirmed.length ? ` · ${confirmed.length} פגישות` : ""}${pendingSuggestions.length ? ` · ${pendingSuggestions.length} הצעות AI` : ""}`;

          const cellStyle: React.CSSProperties = isWedding
            ? {
                // R69 — softer radial gradient anchored to the top-left
                // (RTL-aware via the linear-gradient angle) + double
                // outline for hero presence. The .wedding-day-shimmer
                // class adds a sweeping sheen on top.
                background:
                  "radial-gradient(circle at 30% 30%, var(--gold-100) 0%, var(--gold-300) 55%, var(--gold-500) 100%)",
                border: "2px solid var(--accent)",
                boxShadow:
                  "0 8px 28px -8px var(--accent-glow), inset 0 0 0 1px rgba(255,255,255,0.35)",
                color: "#0A0A0F",
                transform: "scale(1.08)",
                zIndex: 1,
              }
            : {
                background: `${cell.info.color}${tintAlpha}`,
                border: isToday
                  ? "1.5px solid var(--accent)"
                  : isSelected
                    ? "1.5px solid var(--border-gold)"
                    : "1px solid transparent",
                opacity: cell.inMonth ? 1 : 0.45,
                // @ts-expect-error — CSS var for focus ring color
                "--tw-ring-color": "var(--accent)",
              };

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => {
                setSelectedIso(cell.iso);
                // Selecting an empty in-month day opens the
                // AppointmentSheet pre-filled with that date. Wedding
                // day is read-only (managed elsewhere).
                if (
                  !isWedding &&
                  cell.inMonth &&
                  dayAppts.length === 0
                ) {
                  onAddClick(cell.date);
                }
              }}
              aria-label={ariaLabel}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              className={
                "aspect-square rounded-xl p-1.5 text-start flex flex-col transition-transform duration-200 ease-out relative outline-none focus-visible:ring-2 " +
                (isWedding
                  ? "wedding-day-pulse wedding-day-shimmer "
                  : "hover:scale-[1.03] hover:z-10 ")
              }
              style={cellStyle}
            >
              <span
                className="text-sm md:text-base font-bold ltr-num leading-none relative z-10"
                style={{
                  color: isWedding
                    ? "#0A0A0F"
                    : cell.info.level === "blocked"
                      ? "var(--foreground-muted)"
                      : "var(--foreground)",
                }}
              >
                {dayNum}
              </span>
              {isWedding && (
                <span
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                  aria-hidden
                  title={weddingTitle ?? "החתונה שלכם"}
                  style={{
                    fontSize: "1.75rem",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.18))",
                  }}
                >
                  💍
                </span>
              )}
              {!isWedding &&
                (pendingSuggestions.length > 0 || confirmed.length > 0) && (
                  <div className="mt-auto flex items-center gap-1 justify-start">
                    {pendingSuggestions.length > 0 && (
                      <span
                        className="text-xs animate-pulse"
                        style={{
                          color: "var(--accent)",
                          opacity: 0.85,
                        }}
                        aria-hidden
                      >
                        ✨
                      </span>
                    )}
                    {confirmed.slice(0, 3).map((a) => (
                      <span
                        key={a.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: a.color || "var(--accent)" }}
                        aria-hidden
                      />
                    ))}
                    {confirmed.length > 3 && (
                      <span
                        className="text-[10px] ltr-num"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        +{confirmed.length - 3}
                      </span>
                    )}
                  </div>
                )}
            </button>
          );
        })}
      </div>

      {/* Legend — R69: price heatmap (existing) + marker key. */}
      <div
        className="mt-6 pt-4 border-t space-y-3"
        style={{ borderColor: "var(--border)" }}
      >
        <PriceHeatmapLegend />
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs"
          role="list"
          aria-label="מקרא סימנים"
          style={{ color: "var(--foreground-soft)" }}
        >
          <div role="listitem" className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            פגישה מאושרת
          </div>
          <div role="listitem" className="inline-flex items-center gap-1.5">
            <span aria-hidden style={{ color: "var(--accent)" }}>✨</span>
            הצעת AI
          </div>
          <div role="listitem" className="inline-flex items-center gap-1.5">
            <span aria-hidden>💍</span>
            יום האירוע
          </div>
        </div>
      </div>

      {/* Selected-day detail */}
      {selectedCell && (
        <>
          <PriceTooltip date={selectedCell.date} info={selectedCell.info} />
          {selectedAppts.length > 0 && (
            <SelectedDayAppointments
              appointments={selectedAppts}
              onAppointmentClick={onAppointmentClick}
              onSuggestionClick={onSuggestionClick}
            />
          )}
        </>
      )}
    </section>
  );
}

function SelectedDayAppointments({
  appointments,
  onAppointmentClick,
  onSuggestionClick,
}: {
  appointments: Appointment[];
  onAppointmentClick: (a: Appointment) => void;
  onSuggestionClick: (a: Appointment) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      {appointments.map((a) => {
        const isSuggestion =
          a.source === "ai_suggestion" && a.ai_status === "pending";
        const time = new Date(a.start_at).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return (
          <button
            key={a.id}
            type="button"
            onClick={() =>
              isSuggestion ? onSuggestionClick(a) : onAppointmentClick(a)
            }
            className="w-full rounded-xl p-3 flex items-center gap-3 text-start transition hover:-translate-y-0.5"
            style={{
              background: "var(--input-bg)",
              border: `1px solid ${isSuggestion ? "var(--border-gold)" : "var(--border)"}`,
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: a.color || "var(--accent)" }}
              aria-hidden
            />
            <span className="flex-1 min-w-0">
              <span className="font-semibold text-sm truncate block">
                {isSuggestion ? `✨ ${a.title}` : a.title}
              </span>
              {a.description && (
                <span
                  className="text-xs truncate block mt-0.5"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  {a.description}
                </span>
              )}
            </span>
            <span
              className="text-xs ltr-num shrink-0"
              style={{ color: "var(--foreground-soft)" }}
            >
              {time}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function formatHebrewYearMonth(date: Date): string {
  const sample = new Date(date.getFullYear(), date.getMonth(), 15);
  const hMonth = getHebrewMonth(sample);
  const fullHeb = formatHebrewDate(sample);
  const yearPart = fullHeb.split(" ").slice(-1).join(" ");
  return `${hMonth} ${yearPart}`;
}
