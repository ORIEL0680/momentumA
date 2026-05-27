"use client";

import { useSyncExternalStore } from "react";

/**
 * R111 — host notifications inbox.
 *
 * A small in-browser store of timestamped events the host should know
 * about: RSVP confirmations / declines, system messages, future
 * additions (vendor replies, payment reminders). Rendered by the
 * NotificationsBell in the Header.
 *
 * Storage: localStorage, capped at 50 entries (LRU — oldest dropped
 * when the cap is hit). Per-tab sync via `storage` event so a host
 * with two tabs sees the same unread count.
 *
 * NOT cross-device synced — these are advisory UI events, not source
 * of truth. The /guests page remains the canonical answer to "who is
 * confirmed". The inbox is a feed of "what just happened".
 */

// R132 — bumped to v2 so any pre-existing inbox (which the owner
// flagged as full of "invented" historical replays) is wiped on
// first load. v1 entries stay in localStorage but are no longer
// read; the next addNotification call writes under the new key.
const STORAGE_KEY = "momentum.notifications.v2";
const MAX_ENTRIES = 50;

// Real-event freshness window. Anything older than this when the
// notification arrives is treated as a historical replay (polling
// re-fetching old rows, channel resubscribe after sleep, etc.) and
// silently dropped — the bell only surfaces things the host should
// actually care about NOW. 30 minutes is generous enough to catch
// a vendor-side delay between the guest tapping confirm and the
// row landing in Supabase, but tight enough that nothing from a
// previous session leaks into the bell.
const FRESHNESS_WINDOW_MS = 30 * 60 * 1000;

export type NotificationKind =
  | "rsvp_confirmed"
  | "rsvp_declined"
  | "rsvp_maybe"
  // R146 — vendor-side kinds. The bell is shared between hosts and
  // vendors; the icon + copy switches per kind so the same component
  // renders the right card for either role.
  //   • vendor_new_lead     — a couple opened a lead with the vendor
  //   • vendor_new_review   — a couple posted a review
  //   • vendor_chat_message — a couple sent a chat message
  //   • vendor_milestone    — usage milestones (e.g., "10 views today")
  | "vendor_new_lead"
  | "vendor_new_review"
  | "vendor_chat_message"
  | "vendor_milestone"
  | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** ISO timestamp when the event happened. */
  createdAt: string;
  /** ISO timestamp when the host opened/marked it; absent = unread. */
  readAt?: string;
  /** Optional structured payload. Host: guestId to scroll to a row.
   *  Vendor: leadId to deep-link into the leads inbox. */
  meta?: {
    guestId?: string;
    eventId?: string;
    attendingCount?: number;
    leadId?: string;
    reviewId?: string;
    href?: string; // explicit click destination override
  };
}

// ────────────────────────── Store ──────────────────────────

let cache: AppNotification[] | null = null;
const listeners = new Set<() => void>();

function readStorage(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Trust but verify — drop malformed entries instead of crashing.
    return parsed.filter(
      (n): n is AppNotification =>
        !!n &&
        typeof n === "object" &&
        typeof (n as AppNotification).id === "string" &&
        typeof (n as AppNotification).kind === "string" &&
        typeof (n as AppNotification).createdAt === "string",
    );
  } catch {
    return [];
  }
}

function writeStorage(next: AppNotification[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota exceeded / private mode — best-effort */
  }
  cache = next;
  listeners.forEach((l) => l());
}

function getAll(): AppNotification[] {
  if (cache !== null) return cache;
  cache = readStorage();
  return cache;
}

/** Push a new notification onto the inbox.
 *
 *  R132 — two new guard rails based on owner feedback ("ממציא התראות"):
 *
 *  1. Freshness window: if `createdAt` is older than 30 minutes, the
 *     event is dropped without writing to storage. Polling fallback
 *     loops (lib/rsvpSync.ts) can re-deliver historical rows when
 *     the channel resubscribes after sleep — those used to show up
 *     as new notifications. Now they're silently ignored.
 *
 *  2. Replace-on-dedup is unchanged (passing the same `id` collapses
 *     into one row, idempotent on retries).
 */
export function addNotification(
  partial: Omit<AppNotification, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): void {
  const id = partial.id ?? crypto.randomUUID();
  const createdAt = partial.createdAt ?? new Date().toISOString();
  // Freshness gate. `createdAt` is the event's real-world timestamp
  // (RSVP responded_at, etc.) — comparing to wall clock catches both
  // "5-day-old row replayed by poll" AND "user opens dashboard, sees
  // a confirm from yesterday surface as if it just happened".
  const eventTime = new Date(createdAt).getTime();
  if (
    !Number.isFinite(eventTime) ||
    Date.now() - eventTime > FRESHNESS_WINDOW_MS
  ) {
    return;
  }
  const next: AppNotification = {
    id,
    kind: partial.kind,
    title: partial.title,
    body: partial.body,
    createdAt,
    readAt: partial.readAt,
    meta: partial.meta,
  };
  const existing = getAll();
  // Replace duplicate-by-id if present (idempotent on retries).
  const filtered = existing.filter((n) => n.id !== id);
  const updated = [next, ...filtered].slice(0, MAX_ENTRIES);
  writeStorage(updated);
}

export function markRead(id: string): void {
  const now = new Date().toISOString();
  writeStorage(
    getAll().map((n) => (n.id === id && !n.readAt ? { ...n, readAt: now } : n)),
  );
}

export function markAllRead(): void {
  const now = new Date().toISOString();
  writeStorage(getAll().map((n) => (n.readAt ? n : { ...n, readAt: now })));
}

export function clearAll(): void {
  writeStorage([]);
}

// ─────────────── Cross-tab sync via storage event ────────────────
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    // Force a re-read on next get().
    cache = null;
    listeners.forEach((l) => l());
  });

  // R132 — one-time wipe of the v1 inbox. Owner reported the bell was
  // accumulating historical replays as if they were new events. The
  // freshness gate in addNotification stops future leakage; this
  // sweeps whatever's already on disk so they don't see them again.
  try {
    localStorage.removeItem("momentum.notifications.v1");
  } catch {
    /* private mode / quota — best-effort */
  }
}

// ─────────────────── React hook ───────────────────────

/** useNotifications — subscribes to the store and returns the current
 *  list + derived counts. Stable identity per render via
 *  useSyncExternalStore so React doesn't tear.
 *
 *  `mounted` flips true on the SECOND render (after hydration), letting
 *  the bell suppress the count badge during SSR/hydration mismatch
 *  windows. Implemented via useSyncExternalStore's getServerSnapshot
 *  to dodge the react-hooks/set-state-in-effect lint — we don't need
 *  a separate useEffect because the snapshot already differs between
 *  server (always false) and client (true after subscribe). */
export function useNotifications() {
  const items = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => getAll(),
    () => [], // SSR snapshot — empty list
  );

  const mounted = useSyncExternalStore(
    // No real subscription — the bool just flips on hydration.
    () => () => {},
    () => true,
    () => false,
  );

  const unreadCount = items.filter((n) => !n.readAt).length;

  return { items, unreadCount, mounted };
}
