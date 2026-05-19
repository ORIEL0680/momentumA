/**
 * R45 — Hebrew number-words → integer. Pure, isomorphic, no deps.
 * Handles units (m/f), tens, hundreds (מאה/מאתיים/X מאות), thousands
 * (אלף/אלפיים/שלושת אלפים), the connective ו־, and plain digit strings.
 *
 * Returns null when no number is found (so callers can treat the chunk
 * as name-only).
 */

const UNITS: Record<string, number> = {
  אפס: 0,
  אחד: 1, אחת: 1,
  שניים: 2, שתיים: 2, שני: 2, שתי: 2,
  שלוש: 3, שלושה: 3, שלושת: 3,
  ארבע: 4, ארבעה: 4, ארבעת: 4,
  חמש: 5, חמישה: 5, חמשת: 5,
  שש: 6, שישה: 6, ששת: 6,
  שבע: 7, שבעה: 7, שבעת: 7,
  שמונה: 8, שמונת: 8,
  תשע: 9, תשעה: 9, תשעת: 9,
};

const TENS: Record<string, number> = {
  עשר: 10, עשרה: 10,
  עשרים: 20,
  שלושים: 30,
  ארבעים: 40,
  חמישים: 50,
  שישים: 60, ששים: 60,
  שבעים: 70,
  שמונים: 80,
  תשעים: 90,
};

const NUM_WORD = new Set<string>([
  ...Object.keys(UNITS),
  ...Object.keys(TENS),
  "מאה", "מאתיים", "מאות", "אלף", "אלפיים", "אלפים",
]);

/** Strip a leading ו־ when the remainder is itself a number word
 *  ("וחמישים" → "חמישים", "ומאתיים" → "מאתיים"). */
function deVav(w: string): string {
  if (w.length > 1 && w[0] === "ו" && NUM_WORD.has(w.slice(1))) {
    return w.slice(1);
  }
  return w;
}

export function isNumberWord(w: string): boolean {
  const c = deVav(w);
  return NUM_WORD.has(c) || /^\d+$/.test(w);
}

/**
 * Parse a Hebrew number phrase. Accepts digit strings too ("500").
 * Returns the integer, or null if nothing numeric was understood.
 */
export function parseHebrewNumber(text: string): number | null {
  const raw = (text || "").trim();
  if (!raw) return null;

  // Pure digits (allow thousands separators / NBSP).
  const digits = raw.replace(/[\s,]/g, "");
  if (/^\d+$/.test(digits)) return parseInt(digits, 10);

  const words = raw
    .split(/\s+/)
    .map(deVav)
    .filter((w) => w === "ו" || NUM_WORD.has(w) || /^\d+$/.test(w));
  if (words.length === 0) return null;

  let total = 0;
  let current = 0;
  let seen = false;

  for (const w of words) {
    if (w === "ו") continue;
    if (/^\d+$/.test(w)) {
      current += parseInt(w, 10);
      seen = true;
    } else if (w in UNITS) {
      current += UNITS[w];
      seen = true;
    } else if (w in TENS) {
      current += TENS[w];
      seen = true;
    } else if (w === "מאה") {
      current = (current || 1) * 100;
      seen = true;
    } else if (w === "מאתיים") {
      current += 200;
      seen = true;
    } else if (w === "מאות") {
      current = (current || 1) * 100;
      seen = true;
    } else if (w === "אלף") {
      total += (current || 1) * 1000;
      current = 0;
      seen = true;
    } else if (w === "אלפיים") {
      total += 2000;
      current = 0;
      seen = true;
    } else if (w === "אלפים") {
      total += (current || 1) * 1000;
      current = 0;
      seen = true;
    }
  }
  if (!seen) return null;
  return total + current;
}
