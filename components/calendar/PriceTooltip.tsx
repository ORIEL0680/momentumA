import { HebrewDateLabel } from "./HebrewDateLabel";
import type { PriceInfo } from "@/lib/calendar/pricing-model";

/**
 * R65 (R55) — selected-date detail card.
 *
 * Despite the file name "tooltip", this is rendered as a panel under
 * the calendar grid rather than as a floating tooltip. Reason: floating
 * tooltips don't work on touch + introduce positioning bugs at the
 * edges of the viewport. A persistent panel updated by click/focus is
 * cleaner, accessible, and touch-friendly.
 *
 * Server-safe / pure props.
 */
export function PriceTooltip({
  date,
  info,
}: {
  date: Date;
  info: PriceInfo;
}) {
  const dateLabel = date.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
  return (
    <div
      className="card-gold p-5 mt-5"
      role="region"
      aria-label="פרטי תאריך"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
            תאריך נבחר
          </div>
          <div className="mt-1 text-lg font-bold">{dateLabel}</div>
          <HebrewDateLabel
            date={date}
            className="text-sm mt-0.5 block"
            style={{ color: "var(--foreground-soft)" }}
          />
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ltr-num shrink-0"
          style={{
            background: `${info.color}22`,
            border: `1px solid ${info.color}66`,
            color: info.color,
          }}
        >
          {info.label}
          {info.level !== "blocked" && (
            <span
              className="text-xs"
              style={{ color: "var(--foreground-muted)" }}
            >
              · ×{info.multiplier.toFixed(2)}
            </span>
          )}
        </span>
      </div>
      {info.reasons.length > 0 && (
        <ul
          className="mt-4 space-y-1.5 text-sm"
          style={{ color: "var(--foreground-soft)" }}
        >
          {info.reasons.map((r) => (
            <li key={r} className="flex items-center gap-2">
              <span
                aria-hidden
                className="w-1 h-1 rounded-full shrink-0"
                style={{ background: "var(--accent)" }}
              />
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
