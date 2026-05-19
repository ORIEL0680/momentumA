/**
 * R59 (R49) — best-effort error tracker.
 *
 * Adapted to this app's architecture: there is no server-side Supabase
 * client and the browser must never hold the service-role key, so we
 * POST to /api/admin/log-error which does the privileged insert. This
 * helper NEVER throws and NEVER blocks the caller's happy path.
 *
 * Privacy: only the fields below are sent. Never pass tokens, codes,
 * passwords or full request bodies into `message`/`stack`.
 */

export interface TrackedError {
  type: "auth" | "db" | "api" | "unknown";
  message: string;
  stack?: string;
  user_id?: string;
  url?: string;
}

/**
 * @param baseUrl absolute origin — required when called server-side
 * (route handlers), omit in the browser (relative fetch works there).
 */
export async function logError(
  err: TrackedError,
  baseUrl?: string,
): Promise<void> {
  try {
    const endpoint = `${baseUrl ?? ""}/api/admin/log-error`;
    const payload = {
      ...err,
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      // Don't keep the page alive for a log; fire-and-forget.
      keepalive: true,
    });
  } catch {
    // Swallow — a failed log must never surface to the user.
  }
}
