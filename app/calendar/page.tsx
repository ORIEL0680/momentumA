import { CalendarClient } from "./CalendarClient";

export const metadata = {
  title: "לוח שנה — Momentum",
  description:
    "Heatmap מחירים לפי תאריכים בישראל. בחרו את התאריך הזול ביותר לאירוע — לפי עונה, יום בשבוע, וחגים יהודיים.",
};

/**
 * R65 (R55) — server-rendered metadata + client calendar shell.
 *
 * Why split: Next 16 forbids `export const metadata` from `"use client"`
 * files. Same pattern as /start (R52/R62).
 */
export default function CalendarPage() {
  return <CalendarClient />;
}
