/**
 * R45 — fuzzy Hebrew name matching. "אבי" against [אבי כהן, אביגיל לוי,
 * אביב] → ranked suggestions so the confirmation card can show the best
 * guess + alternatives. Pure, no deps.
 */

import type { Guest } from "@/lib/types";

export interface MatchResult {
  guest: Guest;
  score: number; // 0..1
  reason: string;
}

const FINAL: Record<string, string> = {
  ך: "כ", ם: "מ", ן: "נ", ץ: "צ", ף: "פ",
};

/** Lowercase, strip nikud/geresh, normalize final letters, collapse
 *  spaces. (Leading ה־ is handled at compare time, both directions.) */
export function normalize(s: string): string {
  return (s || "")
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // nikud / cantillation
    .replace(/[״"׳']/g, "")
    .replace(/[ךםןץף]/g, (c) => FINAL[c] ?? c)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function deH(s: string): string {
  return s.startsWith("ה") && s.length > 2 ? s.slice(1) : s;
}

function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

interface Scored {
  score: number;
  reason: string;
}

function scorePair(input: string, full: string): Scored {
  const i = deH(input);
  const f = deH(full);
  if (input === full || i === f) return { score: 1, reason: "התאמה מלאה" };

  const parts = f.split(" ");
  if (parts.some((p) => p === i || p === input)) {
    return { score: 0.9, reason: "התאמת שם פרטי" };
  }
  if (f.startsWith(i) || full.startsWith(input)) {
    const diff = Math.abs(f.length - i.length);
    return {
      score: Math.max(0.5, 0.7 - diff * 0.04),
      reason: `מתחיל ב־"${input}"`,
    };
  }
  const best = Math.min(
    lev(i, f),
    ...parts.map((p) => lev(i, p)),
  );
  if (best <= 1) return { score: 0.62, reason: "דומה מאוד" };
  if (best === 2) return { score: 0.45, reason: "דומה" };
  return { score: 0, reason: "" };
}

export function matchName(input: string, guests: Guest[]): MatchResult[] {
  const ni = normalize(input);
  if (!ni) return [];
  return guests
    .map((g) => {
      const s = scorePair(ni, normalize(g.name));
      return { guest: g, score: s.score, reason: s.reason };
    })
    .filter((r) => r.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
