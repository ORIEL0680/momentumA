/**
 * R65 (R55) — Israeli wedding-pricing heatmap model.
 *
 * Computes a multiplier (0 = blocked, 1.0 = average, >1 = expensive)
 * for a given date based on:
 *   1. Shabbat / chag → blocked (no events).
 *   2. Gregorian month → high season (May-Sep) vs. low (Dec-Feb).
 *   3. Day of week → Thursday is the wedding-peak day in Israel,
 *      Sunday/Mon/Tue are cheaper.
 *   4. Hebrew month → Elul / Nisan are pre-chag rushes.
 *
 * Pure with respect to inputs — same date → same answer. SSR-safe.
 */

import { isShabbat, isJewishHoliday, getHebrewMonth } from "./hebrew-calendar";

export type PriceLevel =
  | "very_low"
  | "low"
  | "mid"
  | "high"
  | "very_high"
  | "blocked";

export interface PriceInfo {
  level: PriceLevel;
  /** 0 = blocked, otherwise 0.7..1.5 typical range. */
  multiplier: number;
  label: string;
  reasons: string[];
  /** Hex string for the heatmap tint. */
  color: string;
}

const COLORS: Record<PriceLevel, string> = {
  very_low: "#4ade80",
  low: "#86efac",
  mid: "#fbbf24",
  high: "#fb923c",
  very_high: "#ef4444",
  blocked: "#6b7280",
};

const LABELS: Record<PriceLevel, string> = {
  very_low: "🟢 מצוין",
  low: "🟢 טוב",
  mid: "🟡 רגיל",
  high: "🟠 יקר",
  very_high: "🔴 פיק",
  blocked: "⚫ לא זמין",
};

export function getPriceInfo(date: Date): PriceInfo {
  if (isShabbat(date)) {
    return {
      level: "blocked",
      multiplier: 0,
      label: LABELS.blocked,
      reasons: ["שבת"],
      color: COLORS.blocked,
    };
  }
  if (isJewishHoliday(date)) {
    return {
      level: "blocked",
      multiplier: 0,
      label: LABELS.blocked,
      reasons: ["חג יהודי"],
      color: COLORS.blocked,
    };
  }

  const reasons: string[] = [];
  let multiplier = 1.0;

  // 2. Gregorian-month season.
  const month = date.getMonth(); // 0..11
  if (month === 4 || month === 5 || month === 7 || month === 8) {
    multiplier += 0.2;
    reasons.push("עונה גבוהה");
  } else if (month === 0 || month === 1 || month === 11) {
    multiplier -= 0.15;
    reasons.push("עונה נמוכה");
  }

  // 3. Day-of-week. 4=Thursday (peak), 0=Sunday, 1=Monday, 2=Tuesday.
  const dow = date.getDay();
  if (dow === 4) {
    multiplier += 0.15;
    reasons.push("יום חמישי (פיק)");
  } else if (dow === 2 || dow === 1) {
    multiplier -= 0.1;
    reasons.push("יום נמוך בשבוע");
  } else if (dow === 0) {
    multiplier -= 0.05;
    reasons.push("יום ראשון (טוב)");
  }

  // 4. Hebrew-month rush periods.
  const hebMonth = getHebrewMonth(date);
  if (hebMonth === "Elul" || hebMonth === "Nisan" || hebMonth === "אלול" || hebMonth === "ניסן") {
    // @hebcal returns transliterated names in latin; the Hebrew strings
    // are kept as defensive fallbacks in case the locale flips.
    multiplier += 0.05;
    reasons.push("חודש עברי עמוס");
  }

  let level: PriceLevel;
  if (multiplier >= 1.3) level = "very_high";
  else if (multiplier >= 1.15) level = "high";
  else if (multiplier >= 0.95) level = "mid";
  else if (multiplier >= 0.85) level = "low";
  else level = "very_low";

  return {
    level,
    multiplier,
    label: LABELS[level],
    reasons,
    color: COLORS[level],
  };
}

/**
 * Estimate the saving (or loss) from moving an event from `from` to
 * `to`, given a baseline `budget`. Positive `delta` = saving.
 */
export function calculateSavings(
  from: Date,
  to: Date,
  budget: number,
): { delta: number; percent: number } {
  const fromMul = getPriceInfo(from).multiplier;
  const toMul = getPriceInfo(to).multiplier;
  if (fromMul === 0 || toMul === 0) {
    return { delta: 0, percent: 0 };
  }
  const fromCost = budget * fromMul;
  const toCost = budget * toMul;
  return {
    delta: Math.round(fromCost - toCost),
    percent: Math.round((1 - toMul / fromMul) * 100),
  };
}

/**
 * Look ahead `windowDays` from `from` and return the cheapest open
 * (non-blocked) date. Used by the AI banner to suggest a better date.
 */
export function findCheapestNearby(
  from: Date,
  windowDays = 30,
): { date: Date; info: PriceInfo } | null {
  let best: { date: Date; info: PriceInfo } | null = null;
  for (let offset = -windowDays; offset <= windowDays; offset++) {
    if (offset === 0) continue;
    const d = new Date(from);
    d.setDate(d.getDate() + offset);
    const info = getPriceInfo(d);
    if (info.level === "blocked") continue;
    if (!best || info.multiplier < best.info.multiplier) {
      best = { date: d, info };
    }
  }
  return best;
}
