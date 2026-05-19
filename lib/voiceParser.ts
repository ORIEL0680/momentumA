/**
 * R45 — Hebrew speech transcript → [{ name, amount, rawText }].
 *
 * "אבי 500, שירה שלוש מאות ואז יוסי 400" →
 *   [{name:"אבי",amount:500}, {name:"שירה",amount:300},
 *    {name:"יוסי",amount:400}]
 *
 * Pure, deps only on hebrewNumbers. Only entries that actually carry a
 * number become a ParsedEntry (a gift needs an amount); everything
 * still goes through the confirmation flow downstream.
 */

import { parseHebrewNumber, isNumberWord } from "./hebrewNumbers";

export interface ParsedEntry {
  name: string;
  amount: number;
  rawText: string;
}

// Spoken separators between people.
const SEP = /\s*(?:[.,/\n]|אחר\s*כך|ואז|אחרי\s*זה|וגם|אחרי\s*כן)\s*/g;

export function parseHebrew(transcript: string): ParsedEntry[] {
  const clean = (transcript || "")
    .replace(/[״"׳']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];

  const chunks = clean
    .replace(SEP, "|")
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);

  const out: ParsedEntry[] = [];

  // Within a chunk, walk "<name…> <number…>" pairs. Speech often drops
  // commas, so "אבי 500 שירה 300 יוסי 400" must still split into 3.
  for (const chunk of chunks) {
    const words = chunk.split(/\s+/).filter(Boolean);
    let nameBuf: string[] = [];
    let numBuf: string[] = [];

    const flush = () => {
      if (numBuf.length === 0) return;
      const amount = parseHebrewNumber(numBuf.join(" "));
      if (amount != null && amount > 0) {
        out.push({
          name: nameBuf.join(" ").trim(),
          amount,
          rawText: [...nameBuf, ...numBuf].join(" "),
        });
      }
      nameBuf = [];
      numBuf = [];
    };

    for (const w of words) {
      const isNum = isNumberWord(w);
      if (isNum) {
        numBuf.push(w);
      } else if (w === "ו") {
        // number connective only mid-number ("עשרים ו-חמש"); else filler
        if (numBuf.length > 0) numBuf.push(w);
      } else if (w === "של") {
        continue; // filler
      } else {
        // a name word: if we already collected a number, the previous
        // person is complete — emit and start a fresh name.
        if (numBuf.length > 0) flush();
        nameBuf.push(w);
      }
    }
    flush();
  }
  return out;
}
