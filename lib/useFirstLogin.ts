"use client";

import { useSyncExternalStore } from "react";

/**
 * R60 (R51) — first-time-login gate.
 *
 * Adapted to this app's architecture: the spec referenced a
 * `user_profiles.onboarding_completed` column that doesn't exist
 * (events/state live as a JSON blob in `app_states`, users come from
 * Supabase Auth). A per-device localStorage flag is the simplest gate
 * that doesn't require a schema change and never blocks render.
 *
 * Trade-off: per-device, not per-account. A user who signs up on phone
 * and then opens on laptop will see the tour again — matches Linear /
 * Stripe convention. If we ever need cross-device, move the flag into
 * `app_states.payload.flags`.
 *
 * Implementation note: uses `useSyncExternalStore` (the React-blessed
 * pattern for external stores) so no setState-in-effect lint issues.
 * Same-tab updates fanned out via a tiny listener Set since the native
 * `storage` event only fires cross-tab.
 */

const KEY = "momentum.tour.completed.v1";

const listeners = new Set<() => void>();
function notifySameTab(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  // Server-side: assume completed so the tour never renders during SSR.
  // The component itself gates on a mount flag for the first-paint case.
  return true;
}

export function useFirstLogin(): {
  isFirstLogin: boolean;
  markCompleted: () => void;
} {
  const completed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const markCompleted = (): void => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(KEY, "1");
        notifySameTab();
      }
    } catch {
      /* localStorage disabled (private mode / quota); tour shows again next time */
    }
  };

  return { isFirstLogin: !completed, markCompleted };
}
