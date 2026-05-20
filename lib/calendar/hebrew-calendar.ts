/**
 * R65 (R55) — thin wrapper over `@hebcal/core` for the calendar heatmap.
 *
 * Israel-only (`il: true`) on purpose: the customer base is Israeli;
 * showing diaspora dates would be misleading for Yom Tov / Sefirah /
 * etc. Minor fasts and Rosh Chodesh are excluded — events still run on
 * those days. Modern observances are excluded too (Yom Ha'atzmaut etc.
 * aren't "no events allowed" days).
 *
 * Everything is pure (no module-level state), so SSR-safe.
 */

import { HebrewCalendar, HDate, Locale, flags } from "@hebcal/core";

/** Shabbat = Sat all day, or Fri from 18:00 onward (kabbalat shabbat). */
export function isShabbat(date: Date): boolean {
  const dow = date.getDay();
  if (dow === 6) return true;
  if (dow === 5 && date.getHours() >= 18) return true;
  return false;
}

/**
 * "Is this day a chag we shouldn't book an event on?"
 * True for Pesach 1 & 7, Shavuot, Rosh Hashana 1-2, Yom Kippur, Sukkot 1
 * & Shemini Atzeret. Chol HaMoed is excluded — events do happen then.
 */
export function isJewishHoliday(date: Date): boolean {
  const events = HebrewCalendar.calendar({
    start: date,
    end: date,
    il: true,
    sedrot: false,
    candlelighting: false,
    noMinorFast: true,
    noModern: true,
    noRoshChodesh: true,
  });
  return events.some((e) => (e.getFlags() & flags.CHAG) !== 0);
}

/**
 * Hebrew month name (e.g., "אייר", "תשרי").
 *
 * `@hebcal/hdate` v6 changed the API: `getMonthName()` always returns
 * the transliterated English name; for the Hebrew form we look up the
 * translation table. Falls back to the English name if the lookup
 * misses (defensive — shouldn't happen with the bundled locale data).
 */
export function getHebrewMonth(date: Date): string {
  const en = new HDate(date).getMonthName();
  const he = Locale.lookupTranslation(en, "he");
  return he ?? en;
}

/** Full Hebrew date string with gematriya (e.g., "ד׳ אייר תשפ״ו"). */
export function formatHebrewDate(date: Date): string {
  return new HDate(date).renderGematriya(true);
}

export interface HolidayHint {
  /** Gregorian midnight in local time. */
  date: Date;
  /** Hebrew label (e.g., "פסח א׳"). */
  nameHebrew: string;
  /** English fallback. */
  nameEnglish: string;
}

/** Major-chag-only list for the next `days` from `from`. */
export function getUpcomingHolidays(
  from: Date,
  days = 90,
): HolidayHint[] {
  const end = new Date(from);
  end.setDate(end.getDate() + days);
  const events = HebrewCalendar.calendar({
    start: from,
    end,
    il: true,
    sedrot: false,
    candlelighting: false,
    noMinorFast: true,
    noModern: true,
    noRoshChodesh: true,
  });
  return events
    .filter((e) => (e.getFlags() & flags.CHAG) !== 0)
    .map((e) => ({
      date: e.getDate().greg(),
      nameHebrew: e.render("he"),
      nameEnglish: e.render("en"),
    }));
}
