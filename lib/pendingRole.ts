/**
 * R141 — Pending signup role helper.
 *
 * The /signup page asks the user up-front whether they're a host
 * (planning an event) or a vendor (offering services). For host signups
 * the choice doesn't need to survive an auth roundtrip — they always
 * land in `/start` or `/onboarding`. For vendor signups it does: the
 * post-auth callback must route them to `/vendors/join` (application
 * form) instead of `/onboarding` (host flow).
 *
 * Pre-R141, the role was kept in component state only and was
 * destroyed by:
 *   • OAuth redirects (Google/Apple → provider → /auth/callback)
 *   • Email confirmation roundtrip (signup → email link → /auth/confirm)
 *   • Page reloads between sending and verifying the phone OTP
 *
 * Every vendor who chose "ספק" ended up in the host onboarding flow.
 * This helper persists the role to localStorage right before the
 * auth attempt, and the `/auth/callback` page reads it back to decide
 * where the user lands.
 *
 * The persisted record carries a timestamp; anything older than
 * `MAX_AGE_MS` (30 minutes) is treated as stale and cleared. That
 * guarantees a vendor signup that never completed won't trap a later
 * host signup on the same browser into the vendor flow.
 */

import { STORAGE_KEYS } from "./storage-keys";

export type PendingRole = "host" | "vendor";

interface PendingRoleRecord {
  role: PendingRole;
  at: string; // ISO timestamp
}

// 30 minutes — comfortably longer than any reasonable signup flow
// (OAuth redirect or email-link click), short enough that an
// abandoned signup doesn't haunt later users on the same browser.
const MAX_AGE_MS = 30 * 60 * 1000;

/** Persist the user's chosen role before initiating an auth attempt.
 *  Safe to call repeatedly — overwrites the previous value. */
export function setPendingRole(role: PendingRole): void {
  if (typeof window === "undefined") return;
  try {
    const record: PendingRoleRecord = {
      role,
      at: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEYS.pendingRole, JSON.stringify(record));
  } catch {
    // localStorage may throw in private mode / over-quota; best-effort.
  }
}

/** Read the pending role if one is set and not stale. Returns null
 *  when no record exists, the record is malformed, or it's older than
 *  MAX_AGE_MS. Stale records are also removed as a side-effect so a
 *  later caller doesn't keep tripping over them. */
export function getPendingRole(): PendingRole | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.pendingRole);
    if (!raw) return null;
    const record = JSON.parse(raw) as PendingRoleRecord;
    if (record.role !== "host" && record.role !== "vendor") return null;
    const ageMs = Date.now() - new Date(record.at).getTime();
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MAX_AGE_MS) {
      // Stale — drop it so future reads don't re-fire the same logic.
      window.localStorage.removeItem(STORAGE_KEYS.pendingRole);
      return null;
    }
    return record.role;
  } catch {
    return null;
  }
}

/** Clear the pending-role record. Called by /auth/callback after it
 *  consumed the value, and by any other place that handles role
 *  routing (so a re-entry to /signup doesn't repeat the redirect). */
export function clearPendingRole(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.pendingRole);
  } catch {
    // ignore
  }
}
