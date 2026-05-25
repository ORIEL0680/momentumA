/**
 * RSVP real-time sync.
 *
 * Two transports, picked automatically based on configuration:
 *
 * 1) **BroadcastChannel** (always on, free) — relays RSVP events between tabs
 *    of the same device. The /rsvp page lives in one tab, the host's dashboard
 *    in another; both speak the same channel and react to each other.
 *
 * 2) **Supabase realtime** (optional, when SUPABASE_ENABLED) — subscribes the
 *    dashboard to `postgres_changes` on the `rsvps` table. The /rsvp page
 *    upserts a row; the dashboard receives the change and applies it locally.
 *    This is the only path that works across devices (guest's phone → host's
 *    laptop). Without Supabase the cross-device flow degrades to "guest
 *    sends WhatsApp answer back, host imports it via /inbox".
 *
 * Local writes to the AppState always go through `actions.setRsvp`, which
 * already broadcasts a `momentum:update` event consumed by `useAppState`. So
 * the dashboard updates without any explicit polling once an event arrives.
 */

import { actions } from "./store";
import { getSupabase, SUPABASE_ENABLED } from "./supabase";
import type { GuestStatus } from "./types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { trackEvent } from "./analytics";

/** Narrow runtime check — Supabase rows could carry "pending" or future
 *  statuses we don't model in the client. Anything else is dropped with a
 *  telemetry breadcrumb so we don't poison the local store. */
function isFinalStatus(s: unknown): s is "confirmed" | "declined" | "maybe" {
  return s === "confirmed" || s === "declined" || s === "maybe";
}

const CHANNEL_NAME = "momentum:rsvp:v1";

export interface RsvpUpdate {
  eventId: string;
  guestId: string;
  status: GuestStatus;
  attendingCount: number;
  notes?: string;
  /** ISO timestamp when the guest submitted. */
  respondedAt: string;
  /**
   * Where the update originated, for telemetry / dedup / UI gating:
   *  - "self": host clicked it themselves (no toast, no notification)
   *  - "broadcast": cross-tab BroadcastChannel (live event)
   *  - "supabase": Supabase realtime postgres_changes (live event)
   *  - "initial-fetch": replayed from the rsvps table on dashboard
   *    mount — i.e. historical, NOT new. Consumers should silently
   *    fold these into state and avoid toasts / notifications.
   */
  source: "self" | "broadcast" | "supabase" | "initial-fetch";
}

let channel: BroadcastChannel | null = null;
function ensureChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (channel) return channel;
  channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

type Handler = (update: RsvpUpdate) => void;
const handlers = new Set<Handler>();
let messageBound = false;

function bindMessageOnce() {
  if (messageBound) return;
  const ch = ensureChannel();
  if (!ch) return;
  messageBound = true;
  ch.addEventListener("message", (ev) => {
    const data = ev.data as RsvpUpdate | null;
    if (!data || typeof data !== "object" || !data.guestId) return;
    // Re-tag so subscribers can tell broadcast vs. self vs. supabase.
    handlers.forEach((h) => h({ ...data, source: "broadcast" }));
  });
}

/**
 * Subscribe to RSVP updates from any transport. Returns an unsubscribe fn.
 * The handler is called for every update — including ones the same tab just
 * published — so the dashboard sees them too.
 *
 * Refcounts the active subscriber set: the Supabase realtime channel is opened
 * on the first subscriber and torn down when the last one leaves, so a
 * mount/unmount cycle in dev (HMR) or in a route transition doesn't leak a new
 * channel each time.
 */
export function subscribeRsvpUpdates(handler: Handler): () => void {
  bindMessageOnce();
  handlers.add(handler);
  // If Supabase is on, lazily wire postgres_changes once.
  void wireSupabaseRealtime();
  // R110 — kick off the initial sync + polling fallback. These are
  // idempotent (only run once per page lifecycle), so a re-subscribe
  // from a React re-render doesn't spam Supabase.
  void initialFetchRsvps();
  startPollingFallback();
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) {
      // Last subscriber gone — drop the Supabase channel so a future
      // re-subscribe starts fresh instead of stacking another one.
      void teardownSupabaseRealtime();
      stopPollingFallback();
    }
  };
}

/**
 * Publish a fresh RSVP across both transports. Always:
 *  1) writes locally via `actions.setRsvp` so the in-tab dashboard reacts via
 *     useAppState.
 *  2) posts a BroadcastChannel message so other tabs see it.
 *  3) attempts a Supabase upsert (best-effort) for cross-device propagation.
 *
 * The /rsvp page is the only producer today. Future: vendor messages, etc.
 */
export async function publishRsvpUpdate(
  input: Omit<RsvpUpdate, "source" | "respondedAt"> & { respondedAt?: string },
): Promise<void> {
  const update: RsvpUpdate = {
    ...input,
    respondedAt: input.respondedAt ?? new Date().toISOString(),
    source: "self",
  };

  // 1) Local store — already writes invitedAt/respondedAt and broadcasts
  // momentum:update for in-tab consumers.
  if (!isFinalStatus(update.status)) {
    trackEvent("rsvp_unknown_status", { status: String(update.status), source: "self" });
    return;
  }
  actions.setRsvp(update.guestId, update.status, update.attendingCount);
  if (update.notes) actions.updateGuest(update.guestId, { notes: update.notes });

  // 2) Cross-tab via BroadcastChannel.
  const ch = ensureChannel();
  if (ch) {
    try {
      ch.postMessage(update);
    } catch {
      // Channel closed mid-flight — silent, the local write still landed.
    }
  }

  // Notify same-tab subscribers ourselves; the BroadcastChannel doesn't echo
  // back to the sender by spec.
  handlers.forEach((h) => h({ ...update, source: "self" }));

  // 3) Supabase upsert. Mark this guest as "pending sync" so the host UI can
  // show "N waiting to sync" until the upsert succeeds; on failure we leave
  // the marker in place + emit telemetry so the dashboard can warn the host
  // that their cloud copy is out of date.
  pendingSyncIds.add(update.guestId);
  pushToSupabase(update).then((ok) => {
    if (ok) {
      pendingSyncIds.delete(update.guestId);
    } else {
      trackEvent("rsvp_sync_failed", { guestId: update.guestId });
    }
  }).catch(() => {
    // pushToSupabase already swallows rejections internally, but guard the
    // chain anyway in case of future refactors.
    trackEvent("rsvp_sync_failed", { guestId: update.guestId });
  });
}

/** Set of guest ids whose Supabase upsert has not yet succeeded. Surfaced
 *  via getPendingSyncCount() for a "N ממתינים לסנכרון" badge. */
const pendingSyncIds = new Set<string>();

/** Number of in-flight or failed RSVP upserts. Polled by SyncBadge. */
export function getPendingSyncCount(): number {
  return pendingSyncIds.size;
}

// ──────────────────────────────────────────────────────────────────────
// Supabase wiring (track A) — only active when SUPABASE_ENABLED.
// We don't import the rest of lib/sync.ts here because the rsvps table is
// a separate, public-write table with its own RLS policy keyed by token.
// ──────────────────────────────────────────────────────────────────────

let supabaseChannel: RealtimeChannel | null = null;

async function wireSupabaseRealtime() {
  if (supabaseChannel) return;
  if (!SUPABASE_ENABLED) return;
  const supabase = getSupabase();
  if (!supabase) return;
  // Listen for inserts/updates on the rsvps table. We don't filter by
  // event_id at the channel level — the host is on their device, only their
  // event will be sending through here in practice, and filter-by-RLS keeps
  // strangers' rows out of the stream regardless.
  type RsvpRow = {
    event_id?: string;
    guest_id?: string;
    status?: GuestStatus;
    attending_count?: number;
    notes?: string;
    responded_at?: string;
  };
  // Save the channel reference BEFORE .subscribe() so a fast re-subscribe
  // doesn't double-create. Setting it null again happens in teardown.
  //
  // R109c — give the channel a unique name per browser session. Supabase
  // realtime tolerates multiple subscribers to the same name, but a
  // stale channel from a previous mount (HMR, route swap) can occasionally
  // hijack future events when the name is shared. Unique-per-session
  // names side-step the issue entirely.
  const channelName = `rsvps:${Math.random().toString(36).slice(2, 10)}`;
  supabaseChannel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rsvps" },
      (payload: { new?: RsvpRow }) => {
        // R109c — visible log so the host can see in DevTools that the
        // event landed BEFORE we apply any business logic. If this line
        // doesn't print after a guest tap, the issue is on the
        // subscription side (RLS / publication / channel filter).
        console.log("[momentum/rsvpSync] ◀ postgres_changes received:", payload);
        const row = payload.new;
        if (!row || !row.guest_id || !row.event_id || !row.status) {
          console.warn("[momentum/rsvpSync] payload missing required fields", row);
          return;
        }
        if (!isFinalStatus(row.status)) {
          trackEvent("rsvp_unknown_status", { status: String(row.status), source: "supabase" });
          return;
        }
        // Capture the narrowed status into a local so TS keeps it on the
        // setRsvp call below (RsvpUpdate.status widens it back to GuestStatus).
        const finalStatus: "confirmed" | "declined" | "maybe" = row.status;
        const update: RsvpUpdate = {
          eventId: row.event_id,
          guestId: row.guest_id,
          status: finalStatus,
          // declined rows default to 0 attendees — otherwise a "no" would
          // count as +1 in the dashboard's confirmed sum.
          attendingCount: typeof row.attending_count === "number"
            ? row.attending_count
            : (finalStatus === "declined" ? 0 : 1),
          notes: row.notes ?? undefined,
          respondedAt: row.responded_at ?? new Date().toISOString(),
          source: "supabase",
        };
        // Reflect in local store (idempotent — setRsvp writes whatever we pass).
        actions.setRsvp(update.guestId, finalStatus, update.attendingCount);
        if (update.notes) actions.updateGuest(update.guestId, { notes: update.notes });
        handlers.forEach((h) => h(update));
      },
    );
  // R109c — surface subscribe() status. Without this callback the
  // dashboard can't tell whether realtime came online or silently
  // refused (RLS, publication missing, network).
  supabaseChannel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      console.log(`[momentum/rsvpSync] ✓ realtime subscribed on "${channelName}"`);
    } else if (status === "CHANNEL_ERROR") {
      console.error(
        `[momentum/rsvpSync] ✗ realtime CHANNEL_ERROR — likely the rsvps table is not in the supabase_realtime publication, OR anon SELECT is blocked by RLS.`,
        err,
      );
    } else if (status === "TIMED_OUT") {
      console.error("[momentum/rsvpSync] ✗ realtime TIMED_OUT — supabase realtime is down or the project URL is wrong", err);
    } else if (status === "CLOSED") {
      console.log(`[momentum/rsvpSync] realtime channel "${channelName}" closed`);
    } else {
      console.log(`[momentum/rsvpSync] realtime status: ${status}`);
    }
  });
}

async function teardownSupabaseRealtime() {
  if (!supabaseChannel) return;
  try {
    await supabaseChannel.unsubscribe();
  } catch (e) {
    console.error("[momentum/rsvpSync] supabase channel teardown failed:", e);
  } finally {
    supabaseChannel = null;
  }
}

// ──────────────────────────────────────────────────────────────────────
// R110 — Initial fetch + polling fallback.
//
// Even with realtime working perfectly, two failure modes break the
// dashboard:
//   1. The dashboard mounts AFTER a guest already responded — realtime
//      only delivers FUTURE changes, so the existing row never lands.
//   2. realtime silently misses an event (project sleeping, network
//      blip, channel was created before the publication included the
//      table — which was the very bug behind R109).
//
// initialFetchRsvps() does a one-time SELECT * from rsvps on first
// subscribe, then dispatches every row through the same handler path
// realtime uses. startPollingFallback() repeats that every 10s in case
// realtime missed something. Both no-op when SUPABASE_ENABLED is false.
// ──────────────────────────────────────────────────────────────────────

let initialFetchInFlight = false;
let lastSyncedAt: string | null = null;

async function initialFetchRsvps(): Promise<void> {
  if (initialFetchInFlight) return;
  if (!SUPABASE_ENABLED) return;
  const supabase = getSupabase();
  if (!supabase) return;
  initialFetchInFlight = true;
  try {
    const { data, error } = await supabase
      .from("rsvps")
      .select("event_id, guest_id, status, attending_count, notes, responded_at, updated_at")
      .order("updated_at", { ascending: true });
    if (error) {
      console.error(
        `[momentum/rsvpSync] initial fetch failed [${error.code ?? "?"}]: ${error.message}`,
        error.hint ? `· hint: ${error.hint}` : "",
      );
      return;
    }
    if (!data) return;
    console.log(`[momentum/rsvpSync] initial fetch: ${data.length} rsvp row(s)`);
    for (const row of data) {
      applyRowFromCloud(row, "initial-fetch");
    }
    if (data.length > 0) {
      const last = data[data.length - 1];
      lastSyncedAt =
        typeof last.updated_at === "string" ? last.updated_at : null;
    }
  } catch (e) {
    console.error("[momentum/rsvpSync] initial fetch threw:", e);
  } finally {
    initialFetchInFlight = false;
  }
}

let pollTimer: number | null = null;
const POLL_INTERVAL_MS = 10_000;

function startPollingFallback(): void {
  if (typeof window === "undefined") return;
  if (pollTimer !== null) return; // already running
  if (!SUPABASE_ENABLED) return;
  pollTimer = window.setInterval(() => {
    void pollOnce();
  }, POLL_INTERVAL_MS);
}

function stopPollingFallback(): void {
  if (pollTimer === null) return;
  window.clearInterval(pollTimer);
  pollTimer = null;
}

async function pollOnce(): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    let query = supabase
      .from("rsvps")
      .select("event_id, guest_id, status, attending_count, notes, responded_at, updated_at")
      .order("updated_at", { ascending: true });
    if (lastSyncedAt) {
      // Only pull rows newer than the last one we've seen. Even with
      // realtime delivering most events live, the poll covers the
      // gaps without re-sending the entire table every 10s.
      query = query.gt("updated_at", lastSyncedAt);
    }
    const { data, error } = await query;
    if (error) {
      // Quiet on the recurring path so the console isn't spammed every
      // 10s when the table's missing. The initial fetch already
      // surfaced the actionable error once.
      return;
    }
    if (!data || data.length === 0) return;
    console.log(`[momentum/rsvpSync] poll: ${data.length} new rsvp row(s)`);
    for (const row of data) {
      applyRowFromCloud(row);
    }
    const last = data[data.length - 1];
    if (typeof last.updated_at === "string") {
      lastSyncedAt = last.updated_at;
    }
  } catch {
    /* network blip — try again next interval */
  }
}

/** Apply a single Supabase rsvps row through the same handler path the
 *  realtime channel uses. Idempotent — calling with the same row twice
 *  just rewrites the local store with the same values.
 *
 *  `sourceTag` lets the caller distinguish a historical replay (the
 *  initial fetch on dashboard mount — `"initial-fetch"`) from a genuine
 *  live event (`"supabase"`). UI handlers can then suppress toasts /
 *  notifications for the historical batch, so a host opening the page
 *  doesn't get pelted by 200 "X confirmed!" pop-ups.
 */
function applyRowFromCloud(
  row: {
    event_id?: string;
    guest_id?: string;
    status?: string;
    attending_count?: number;
    notes?: string | null;
    responded_at?: string;
  },
  sourceTag: "supabase" | "initial-fetch" = "supabase",
): void {
  if (!row.guest_id || !row.event_id || !row.status) return;
  if (!isFinalStatus(row.status)) return;
  const finalStatus: "confirmed" | "declined" | "maybe" = row.status;
  const update: RsvpUpdate = {
    eventId: row.event_id,
    guestId: row.guest_id,
    status: finalStatus,
    attendingCount:
      typeof row.attending_count === "number"
        ? row.attending_count
        : finalStatus === "declined"
          ? 0
          : 1,
    notes: row.notes ?? undefined,
    respondedAt: row.responded_at ?? new Date().toISOString(),
    source: sourceTag,
  };
  actions.setRsvp(update.guestId, finalStatus, update.attendingCount);
  if (update.notes) actions.updateGuest(update.guestId, { notes: update.notes });
  handlers.forEach((h) => h(update));
}

async function pushToSupabase(update: RsvpUpdate): Promise<boolean> {
  if (!SUPABASE_ENABLED) return false;
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("rsvps")
      .upsert(
        {
          event_id: update.eventId,
          guest_id: update.guestId,
          status: update.status,
          attending_count: update.attendingCount,
          notes: update.notes ?? null,
          responded_at: update.respondedAt,
        },
        { onConflict: "guest_id" },
      );
    if (error) {
      // R109 — diagnostic so the host can see why their dashboard isn't
      // updating in realtime. Most common cause: the rsvps migration
      // hasn't been applied to the Supabase project. Surfacing the
      // Postgres error code makes "relation does not exist" (42P01)
      // immediately obvious vs. a generic RLS denial (42501).
      console.error(
        `[momentum/rsvpSync] supabase upsert failed [${error.code ?? "?"}]: ${error.message}`,
        error.details ? `· ${error.details}` : "",
        error.hint ? `· hint: ${error.hint}` : "",
      );
      if (error.code === "42P01") {
        console.error(
          "[momentum/rsvpSync] The `rsvps` table is missing. Apply " +
            "supabase/migrations/2026-05-25-rsvps.sql in your Supabase " +
            "SQL Editor and try again.",
        );
      }
      return false;
    }
    // R109 — explicit success log so a host watching DevTools after
    // applying the migration sees the upsert went through (instead of
    // wondering if the silent return-true path actually ran).
    console.log(
      `[momentum/rsvpSync] ✓ RSVP saved to cloud — ${update.guestId} → ${update.status} (${update.attendingCount})`,
    );
    return true;
  } catch (e) {
    console.error("[momentum/rsvpSync] supabase upsert threw:", e);
    return false;
  }
}

/**
 * Convenience for the /guests dashboard: returns the active sync mode for the
 * UI to show ("✓ סנכרון בענן" vs. "📡 סנכרון בין-טאבים").
 */
export function activeSyncMode(): "supabase" | "broadcast" | "none" {
  if (SUPABASE_ENABLED) return "supabase";
  if (typeof BroadcastChannel !== "undefined") return "broadcast";
  return "none";
}
