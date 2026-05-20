"use client";

import { useEffect } from "react";
import { logError } from "@/lib/error-tracker";

/**
 * R63 (R53) — global window-level error capture.
 *
 * React error boundaries (app/error.tsx, app/global-error.tsx) cover
 * render-path errors. This listener catches everything else: errors
 * thrown from event handlers, promise rejections, setTimeout callbacks,
 * non-React script issues. Both layers feed into the same R59 endpoint
 * (/api/admin/log-error → error_logs), so /admin/errors shows them all.
 *
 * Rate-limited locally: at most 10 logs per page load to avoid a runaway
 * loop spamming the endpoint if something is broken in a tight cycle.
 */

const MAX_LOGS_PER_SESSION = 10;

export function ErrorListener() {
  useEffect(() => {
    let logged = 0;

    const send = (
      kind: "error" | "promise",
      message: string,
      stack: string | undefined,
    ): void => {
      if (logged >= MAX_LOGS_PER_SESSION) return;
      logged += 1;
      void logError({
        type: "unknown",
        message: `${kind}: ${message}`.slice(0, 1800),
        stack: stack ? stack.slice(0, 5800) : undefined,
        url: window.location.href,
      });
    };

    const onError = (e: ErrorEvent) => {
      send("error", e.message || "unknown error", e.error?.stack);
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as unknown;
      const msg =
        r instanceof Error
          ? r.message
          : typeof r === "string"
            ? r
            : "unhandledrejection";
      const stk = r instanceof Error ? r.stack : undefined;
      send("promise", msg, stk);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
