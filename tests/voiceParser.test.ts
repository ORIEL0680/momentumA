/**
 * R45 — unit tests for lib/voiceParser (Hebrew transcript → ParsedEntry[]).
 * ≥15 cases: single, explicit separators, no-separator multi-entry,
 * Hebrew amounts, multi-word names, fillers, zero/empty, name-only.
 */
import { describe, it, expect } from "vitest";
import { parseHebrew } from "@/lib/voiceParser";

describe("parseHebrew", () => {
  it("parses a single name + digit amount", () => {
    expect(parseHebrew("אבי 500")).toEqual([
      { name: "אבי", amount: 500, rawText: "אבי 500" },
    ]);
  });

  it("splits on a comma separator", () => {
    const r = parseHebrew("אבי 500, שירה 300");
    expect(r).toEqual([
      { name: "אבי", amount: 500, rawText: "אבי 500" },
      { name: "שירה", amount: 300, rawText: "שירה 300" },
    ]);
  });

  it("splits a no-separator run into multiple entries", () => {
    const r = parseHebrew("אבי 500 שירה 300 יוסי 400");
    expect(r.map((e) => e.name)).toEqual(["אבי", "שירה", "יוסי"]);
    expect(r.map((e) => e.amount)).toEqual([500, 300, 400]);
  });

  it('splits on the spoken separator "ואז"', () => {
    const r = parseHebrew("אבי 500 ואז שירה 300");
    expect(r).toHaveLength(2);
    expect(r[1]).toMatchObject({ name: "שירה", amount: 300 });
  });

  it('splits on the spoken separator "וגם"', () => {
    const r = parseHebrew("יוסי 250 וגם דנה 180");
    expect(r.map((e) => e.amount)).toEqual([250, 180]);
  });

  it("splits on a newline separator", () => {
    const r = parseHebrew("אבי 500\nשירה 300");
    expect(r).toHaveLength(2);
  });

  it("parses a Hebrew-word hundreds amount", () => {
    expect(parseHebrew("שירה שלוש מאות")).toEqual([
      { name: "שירה", amount: 300, rawText: "שירה שלוש מאות" },
    ]);
  });

  it("parses a Hebrew-word thousands amount", () => {
    expect(parseHebrew("דנה אלף")).toEqual([
      { name: "דנה", amount: 1000, rawText: "דנה אלף" },
    ]);
  });

  it("parses a compound Hebrew amount with the connective ו", () => {
    expect(parseHebrew("אבי חמש מאות וחמישים")).toEqual([
      { name: "אבי", amount: 550, rawText: "אבי חמש מאות וחמישים" },
    ]);
  });

  it("keeps a multi-word name together", () => {
    expect(parseHebrew("אבי כהן 500")).toEqual([
      { name: "אבי כהן", amount: 500, rawText: "אבי כהן 500" },
    ]);
  });

  it('drops the filler word "של"', () => {
    expect(parseHebrew("אבי של 500")).toEqual([
      { name: "אבי", amount: 500, rawText: "אבי 500" },
    ]);
  });

  it("strips quotation marks before parsing", () => {
    expect(parseHebrew('אבי "500"')).toEqual([
      { name: "אבי", amount: 500, rawText: "אבי 500" },
    ]);
  });

  it("ignores an entry whose amount is zero", () => {
    expect(parseHebrew("אבי אפס")).toEqual([]);
  });

  it("returns [] for a transcript with no numbers", () => {
    expect(parseHebrew("שלום לכולם")).toEqual([]);
  });

  it("returns [] for an empty / whitespace transcript", () => {
    expect(parseHebrew("")).toEqual([]);
    expect(parseHebrew("   ")).toEqual([]);
  });

  it("returns [] for a name with no amount", () => {
    expect(parseHebrew("אבי")).toEqual([]);
  });

  it("handles a spaced connective inside a number", () => {
    expect(parseHebrew("אבי עשרים ו חמש")).toEqual([
      { name: "אבי", amount: 25, rawText: "אבי עשרים ו חמש" },
    ]);
  });

  it("emits an entry even when only an amount is spoken (empty name)", () => {
    const r = parseHebrew("עשרים וחמש");
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("");
    expect(r[0].amount).toBe(25);
  });
});
