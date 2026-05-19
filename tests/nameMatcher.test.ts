/**
 * R45 — unit tests for lib/nameMatcher (fuzzy Hebrew name matching).
 * ≥10 cases: exact, first-name part, prefix, Levenshtein near/2,
 * below-threshold filter, leading-ה, final-letter + nikud normalization,
 * empty input, ranking + max-3.
 */
import { describe, it, expect } from "vitest";
import { matchName } from "@/lib/nameMatcher";
import type { Guest } from "@/lib/types";

let seq = 0;
function guest(name: string): Guest {
  seq += 1;
  return {
    id: `g${seq}`,
    name,
    phone: "+972500000000",
    attendingCount: 1,
    status: "confirmed",
  };
}

describe("matchName", () => {
  it("scores an exact match 1.0", () => {
    const r = matchName("אבי", [guest("אבי")]);
    expect(r).toHaveLength(1);
    expect(r[0].score).toBe(1);
    expect(r[0].reason).toBe("התאמה מלאה");
  });

  it("matches a first name within a full name (0.9)", () => {
    const r = matchName("אבי", [guest("אבי כהן")]);
    expect(r[0].score).toBe(0.9);
    expect(r[0].reason).toBe("התאמת שם פרטי");
  });

  it("scores a prefix match below a part match", () => {
    const r = matchName("אבי", [guest("אביגיל")]);
    expect(r[0].score).toBeCloseTo(0.58, 5);
    expect(r[0].score).toBeGreaterThan(0.3);
    expect(r[0].score).toBeLessThan(0.9);
  });

  it('scores a very-close Levenshtein neighbour 0.62 ("דומה מאוד")', () => {
    const r = matchName("רון", [guest("רן")]);
    expect(r[0].score).toBe(0.62);
    expect(r[0].reason).toBe("דומה מאוד");
  });

  it('scores a distance-2 neighbour 0.45 ("דומה")', () => {
    const r = matchName("מיכל", [guest("מיקה")]);
    expect(r[0].score).toBe(0.45);
    expect(r[0].reason).toBe("דומה");
  });

  it("filters out matches below the 0.3 threshold", () => {
    expect(matchName("אבי", [guest("שרה")])).toEqual([]);
  });

  it("treats a leading ה־ as optional on both sides", () => {
    const r = matchName("הדני", [guest("דני")]);
    expect(r[0].score).toBe(1);
  });

  it("normalizes final letters (ם → מ) so they match", () => {
    const r = matchName("אברהם", [guest("אברהמ")]);
    expect(r[0].score).toBe(1);
  });

  it("strips nikud before comparing", () => {
    const r = matchName("אֲבִי", [guest("אבי")]);
    expect(r[0].score).toBe(1);
  });

  it("returns [] for empty / whitespace input", () => {
    expect(matchName("", [guest("אבי")])).toEqual([]);
    expect(matchName("   ", [guest("אבי")])).toEqual([]);
  });

  it("ranks by score and caps results at 3", () => {
    const guests = [
      guest("אביגיל"), // prefix  ~0.58
      guest("אבי כהן"), // part    0.9
      guest("אבי"), // exact   1.0
      guest("אביב"), // prefix  ~0.66
      guest("אבישי"), // prefix  ~0.62
    ];
    const r = matchName("אבי", guests);
    expect(r).toHaveLength(3);
    expect(r[0].guest.name).toBe("אבי");
    expect(r[0].score).toBe(1);
    expect(r[1].guest.name).toBe("אבי כהן");
    // sorted strictly descending
    expect(r[0].score).toBeGreaterThanOrEqual(r[1].score);
    expect(r[1].score).toBeGreaterThanOrEqual(r[2].score);
  });
});
