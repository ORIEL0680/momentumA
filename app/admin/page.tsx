import { redirect } from "next/navigation";

/**
 * R128 — `/admin` redirects to `/admin/dashboard`.
 *
 * Why: pre-R128 we shipped TWO admin home pages.
 *   • `/admin` (this file)        — older simpler dashboard
 *   • `/admin/dashboard`          — R125's polished surface with the
 *                                   CommandTile quick-action strip,
 *                                   the 10-second hard-timeout safety,
 *                                   the "stats empty" graceful empty
 *                                   state, and the founder greeting.
 *
 * Every sub-page (`/admin/vendors`, `/admin/leads`, `/admin/errors`,
 * etc.) has a "חזרה ללוח הבקרה" link pointing at `/admin`. If admins
 * followed that, they landed on the older dashboard and missed all the
 * R125-R127 improvements. We now bounce them to the modern one with a
 * single 307 redirect — invisible and a single round-trip.
 *
 * The previous client-side dashboard implementation lived here; the
 * polished version in `/admin/dashboard/page.tsx` is the canonical one
 * now. Removing duplicate types + duplicate fetch logic also kills the
 * "two places to update when the /api/admin/stats schema changes"
 * footgun the audit flagged.
 */
export default function AdminHomeRedirect() {
  redirect("/admin/dashboard");
}
