/**
 * R45 — unit tests for lib/hebrewNumbers (Hebrew number-words → integer).
 * ≥20 cases: digits, units, tens, hundreds, thousands, connective ו־,
 * non-numbers → null, plus isNumberWord().
 */
import { describe, it, expect } from "vitest";
import { parseHebrewNumber, isNumberWord } from "@/lib/hebrewNumbers";

describe("parseHebrewNumber", () => {
  const cases: Array<[string, number | null]> = [
    // digits
    ["500", 500],
    ["1,200", 1200],
    [" 300 ", 300],
    ["0", 0],
    // units / zero
    ["אפס", 0],
    ["חמש", 5],
    ["שלושה", 3],
    ["תשע", 9],
    // tens (+ connective ו)
    ["עשר", 10],
    ["עשרים", 20],
    ["עשרים וחמש", 25],
    ["שלושים ושתיים", 32],
    ["תשעים ותשע", 99],
    // hundreds
    ["מאה", 100],
    ["מאה עשרים", 120],
    ["מאתיים", 200],
    ["חמש מאות", 500],
    ["חמש מאות וחמישים", 550],
    // thousands
    ["אלף", 1000],
    ["אלפיים", 2000],
    ["שלושת אלפים", 3000],
    ["אלף מאתיים", 1200],
    ["אלף חמש מאות", 1500],
    ["שלושת אלפים מאתיים חמישים", 3250],
    // non-numbers → null
    ["", null],
    ["שלום", null],
    ["תודה רבה", null],
  ];

  it.each(cases)("parseHebrewNumber(%j) === %j", (input, expected) => {
    expect(parseHebrewNumber(input)).toBe(expected);
  });

  it("tolerates a trailing connective + leading ו on a number word", () => {
    expect(parseHebrewNumber("מאתיים וחמישים")).toBe(250);
  });
});

describe("isNumberWord", () => {
  it.each([
    ["חמש", true],
    ["עשרים", true],
    ["מאות", true],
    ["אלף", true],
    ["וחמישים", true], // leading ו stripped, remainder is a number word
    ["500", true],
    ["אבי", false],
    ["שלום", false],
    ["", false],
  ])("isNumberWord(%j) === %j", (w, expected) => {
    expect(isNumberWord(w)).toBe(expected);
  });
});
