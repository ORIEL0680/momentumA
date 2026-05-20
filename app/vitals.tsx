"use client";

import { useReportWebVitals } from "next/web-vitals";
import { track } from "@/lib/analytics";
import { logError } from "@/lib/error-tracker";

/**
 * R63 (R53) — Core Web Vitals → Plausible.
 *
 * `next/web-vitals` instruments the standard metrics (LCP / INP / CLS /
 * FCP / TTFB) and reports each rating bucket. We forward to Plausible
 * for cross-device aggregation. Poor metrics also generate a server-
 * side error_logs entry (R59) so the founder sees them on /admin/errors.
 *
 * Spec adaptation: the original spec routed "poor" metrics into Sentry.
 * Sentry isn't installed (see R63 tasklist for the rationale); the same
 * signal flows into error_logs instead.
 */
export function VitalsReporter() {
  useReportWebVitals((metric) => {
    track("web_vital", {
      metric: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating ?? "unknown",
    });
    if (metric.rating === "poor") {
      void logError({
        type: "api",
        message: `web-vital poor: ${metric.name}=${Math.round(metric.value)}`,
        url:
          typeof window !== "undefined" ? window.location.href : undefined,
      });
    }
  });
  return null;
}
