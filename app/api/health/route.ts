import { NextResponse } from "next/server";

/**
 * R63 (R53) / R83 — public health endpoint.
 *
 * R83 expanded: instead of probing a single table, exercises every
 * primary table that the app reads from. Each probe is HEAD-style
 * (`count: exact, head: true`, limit 0) so RLS is satisfied without
 * leaking row data. Anon callers see a 200 per table when (a) the
 * table exists, (b) anon SELECT is allowed by RLS, and (c) the
 * REST endpoint is healthy. A 401/404/500 on any table flips the
 * overall status to "degraded".
 *
 * Status semantics:
 *   200 + { status:"ok", checks } → green
 *   503 + { status:"degraded", checks } → red (UptimeRobot alerts)
 *
 * Note: tables that are RLS-locked to authenticated callers
 * (vendor_chat_messages, event_receipts, etc.) will return 401 for
 * the anon probe — that's EXPECTED. We treat 401 as "table reachable,
 * RLS enforced" → still healthy. Only network errors / 5xx flip
 * the status.
 */

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 4000;

interface TableProbe {
  name: string;
  /** Anonymous can SELECT (public-read), so a 401 indicates a real
   *  problem. Otherwise 401 is fine (RLS gating). */
  publicReadable: boolean;
}

/**
 * Canonical table inventory. Compiled from grep of every
 * `.from("…")` call in app/* + lib/* on 2026-05-27.
 *
 * `publicReadable: true` means anon SELECT is expected to succeed
 * (the catalog list, page-view inserts, etc.). For the rest, a 401
 * confirms RLS is healthy.
 */
const TABLES: TableProbe[] = [
  { name: "app_states", publicReadable: false },
  { name: "profiles", publicReadable: false },
  { name: "vendor_applications", publicReadable: false },
  { name: "vendor_landings", publicReadable: true },
  { name: "vendor_leads", publicReadable: false },
  { name: "vendor_quotes", publicReadable: false },
  { name: "vendor_reviews", publicReadable: true },
  { name: "vendor_review_stats", publicReadable: true },
  { name: "vendor_chat_messages", publicReadable: false },
  { name: "vendor_page_views", publicReadable: false },
  { name: "vendor_page_actions", publicReadable: false },
  { name: "vendor_notifications_log", publicReadable: false },
  { name: "vendor_cost_stats", publicReadable: true },
  { name: "rsvps", publicReadable: false },
  { name: "invitation_views", publicReadable: false },
  { name: "scheduled_emails", publicReadable: false },
  { name: "event_managers", publicReadable: false },
  { name: "event_receipts", publicReadable: false },
  { name: "event_memories", publicReadable: false },
  { name: "guest_arrivals", publicReadable: false },
  { name: "manager_actions", publicReadable: false },
  { name: "assistant_messages", publicReadable: false },
  { name: "admin_emails", publicReadable: false },
  { name: "admin_audit_log", publicReadable: false },
  { name: "error_logs", publicReadable: false },
];

async function probeTable(
  url: string,
  key: string,
  table: TableProbe,
): Promise<{ name: string; status: "ok" | "rls-locked" | "error"; httpStatus?: number; error?: string }> {
  try {
    const res = await fetch(
      `${url}/rest/v1/${table.name}?select=*&limit=0`,
      {
        method: "HEAD",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (res.status >= 200 && res.status < 300) {
      return { name: table.name, status: "ok", httpStatus: res.status };
    }
    // 401/403 = RLS denied anon. Expected for non-public tables.
    if (res.status === 401 || res.status === 403) {
      return {
        name: table.name,
        status: table.publicReadable ? "error" : "rls-locked",
        httpStatus: res.status,
      };
    }
    // 404 = table doesn't exist → real problem.
    return { name: table.name, status: "error", httpStatus: res.status };
  } catch (e) {
    return {
      name: table.name,
      status: "error",
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      {
        status: "degraded",
        checks: { supabase_env: false },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  // Run probes in parallel — each capped at TIMEOUT_MS so a hung
  // table can't take down the whole health check.
  const probes = await Promise.all(TABLES.map((t) => probeTable(url, key, t)));

  const broken = probes.filter((p) => p.status === "error");
  const rlsLocked = probes.filter((p) => p.status === "rls-locked");
  const ok = probes.filter((p) => p.status === "ok");

  const supabaseHealthy = broken.length === 0;
  const overall = supabaseHealthy ? "ok" : "degraded";

  return NextResponse.json(
    {
      status: overall,
      summary: {
        total: TABLES.length,
        public_ok: ok.length,
        rls_locked: rlsLocked.length,
        broken: broken.length,
      },
      tables: probes,
      timestamp: new Date().toISOString(),
    },
    {
      status: supabaseHealthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
