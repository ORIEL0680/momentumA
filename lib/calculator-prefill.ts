import type { AppState } from "@/lib/types";

export interface PrefillContext {
  guestEstimate: number;
  confirmedGuests: number;
  budgetLimit: number;
  currentSpend: number;
  remainingBudget: number;
  eventDate: Date | null;
  eventType: string;
  seasonMultiplier: number; // 0.85 / 1.0 / 1.20
  daysUntilEvent: number;
  vendorsBooked: number;
  hasVenue: boolean;
}

export function getCalculatorPrefill(state: AppState): PrefillContext {
  const event = state.event;
  const guests = state.guests || [];
  const budget = state.budget || [];

  // Guests — confirmed preferred, otherwise estimate
  const confirmedGuests = guests.filter(
    (g) => g.status === "confirmed",
  ).length;
  const guestEstimate =
    confirmedGuests > 0
      ? confirmedGuests
      : (event?.guestEstimate ?? 150);

  // Budget — actual spending so far
  const currentSpend = budget.reduce(
    (sum, b) => sum + (b.actual ?? b.estimated ?? 0),
    0,
  );
  const budgetLimit = event?.budgetTotal ?? 100_000;
  const remainingBudget = Math.max(0, budgetLimit - currentSpend);

  // Season multiplier (Israeli)
  const eventDate = event?.date ? new Date(event.date) : null;
  const seasonMultiplier = eventDate
    ? getIsraeliSeasonMultiplier(eventDate)
    : 1.0;

  const daysUntilEvent = eventDate
    ? Math.max(0, Math.ceil((eventDate.getTime() - Date.now()) / 86_400_000))
    : 365;

  // Vendors
  const vendorsBooked = budget.filter(
    (b) => b.paid !== undefined && b.paid > 0,
  ).length;
  const hasVenue = budget.some(
    (b) =>
      b.category === "venue" &&
      b.paid !== undefined &&
      b.paid > 0,
  );

  return {
    guestEstimate,
    confirmedGuests,
    budgetLimit,
    currentSpend,
    remainingBudget,
    eventDate,
    eventType: event?.type ?? "wedding",
    seasonMultiplier,
    daysUntilEvent,
    vendorsBooked,
    hasVenue,
  };
}

function getIsraeliSeasonMultiplier(date: Date): number {
  const month = date.getMonth(); // 0-11
  const dow = date.getDay(); // 0-6

  let mul = 1.0;

  // Season: May–September = peak (+18%)
  if ([4, 5, 7, 8].includes(month)) mul += 0.18;
  // January–February + December = low (−15%)
  else if ([0, 1, 11].includes(month)) mul -= 0.15;

  // Day-of-week: Thursday (+12%), Mon–Tue (−8%)
  if (dow === 4) mul += 0.12;
  else if (dow === 1 || dow === 2) mul -= 0.08;

  return Math.round(mul * 100) / 100;
}
