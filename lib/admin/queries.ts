/**
 * R59 (R49) — pure aggregation helpers for the admin dashboard.
 *
 * Deliberately dependency-free: the heavy Supabase work (auth admin
 * API + service-role counts) already lives in /api/admin/stats. These
 * helpers turn the raw rows that route already fetches into the
 * sparklines / deltas / upcoming-events the new UI needs. Pure → unit
 * testable, no `any`.
 */

export type Sparkline = number[];

export interface Delta {
  /** Signed percentage vs. the previous comparable window. */
  value: number;
  period: string;
}

export interface AdminEventSummary {
  userId: string;
  title: string;
  /** ISO date string of the event itself. */
  date: string;
  type: string;
  guests: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight (local) N days back from `ref`, inclusive of today. */
function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Count how many of `isoDates` fall on each of the last `days` calendar
 * days, oldest-first (so the sparkline reads left→right = past→now).
 */
export function dayBuckets(
  isoDates: Array<string | null | undefined>,
  days: number,
  ref: Date = new Date(),
): Sparkline {
  const todayStart = startOfDay(ref);
  const out = new Array<number>(days).fill(0);
  for (const iso of isoDates) {
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) continue;
    const diffDays = Math.floor((todayStart - startOfDay(new Date(t))) / DAY_MS);
    if (diffDays < 0 || diffDays >= days) continue;
    // diffDays 0 = today → last bucket; days-1 = oldest → first bucket.
    out[days - 1 - diffDays] += 1;
  }
  return out;
}

/** Signed % change of `current` vs `previous`. 0 prev → 0 (avoid ÷0). */
export function pctDelta(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

interface RawStateRow {
  user_id: string;
  payload: unknown;
  updated_at?: string | null;
}

interface PayloadEventShape {
  event?: {
    type?: unknown;
    hostName?: unknown;
    partnerName?: unknown;
    date?: unknown;
    guestEstimate?: unknown;
  } | null;
  guests?: unknown;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Parse the JSON-blob app_states rows into upcoming events (date ≥ now),
 * soonest first. Robust to partial/missing payloads — anything we can't
 * read is skipped, never thrown.
 */
export function parseUpcomingEvents(
  rows: RawStateRow[],
  limit: number,
  ref: Date = new Date(),
): AdminEventSummary[] {
  const now = ref.getTime();
  const events: AdminEventSummary[] = [];
  for (const row of rows) {
    const payload = row.payload as PayloadEventShape | null;
    const ev = payload?.event;
    if (!ev) continue;
    const date = str(ev.date);
    if (!date) continue;
    const t = new Date(date).getTime();
    if (Number.isNaN(t) || t < now) continue;
    const host = str(ev.hostName);
    const partner = str(ev.partnerName);
    const title = host
      ? partner
        ? `${host} & ${partner}`
        : host
      : "אירוע ללא שם";
    const guests = Array.isArray(payload?.guests)
      ? (payload!.guests as unknown[]).length
      : typeof ev.guestEstimate === "number"
        ? ev.guestEstimate
        : 0;
    events.push({
      userId: row.user_id,
      title,
      date,
      type: str(ev.type) ?? "event",
      guests,
    });
  }
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return events.slice(0, limit);
}
