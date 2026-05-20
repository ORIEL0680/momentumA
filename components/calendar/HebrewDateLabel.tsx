import { formatHebrewDate } from "@/lib/calendar/hebrew-calendar";

/**
 * R65 (R55) — pure presentation. Wraps the Hebrew date string in a
 * semantic `<time>` element with the gregorian ISO as `dateTime` so
 * screen readers + search engines see both calendars. Server-safe.
 */
export function HebrewDateLabel({
  date,
  className,
  style,
}: {
  date: Date;
  className?: string;
  style?: React.CSSProperties;
}) {
  const iso = date.toISOString().slice(0, 10);
  return (
    <time dateTime={iso} className={className} style={style}>
      {formatHebrewDate(date)}
    </time>
  );
}
