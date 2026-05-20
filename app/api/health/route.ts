import { NextResponse } from "next/server";

/**
 * R63 (R53) — public health endpoint for UptimeRobot.
 *
 * No auth (UptimeRobot can't carry a JWT). Checks that:
 *   1. The Supabase REST endpoint responds (network + service).
 *   2. The expected table `app_states` is reachable under anon RLS
 *      (HEAD-style count returns 0 rows for an anon caller but a 2xx
 *      status confirms the schema is intact).
 *
 * Spec adaptation note: the original spec used `@/lib/supabase/server`
 * (cookie-bound SSR client — doesn't exist in this app) and queried a
 * `user_profiles` table (also doesn't exist; state is a JSON blob in
 * `app_states`). The anon REST probe below is functionally equivalent
 * for "is the platform up" checks.
 *
 * Status semantics:
 *   200 + { status:"ok", checks } → green
 *   503 + { status:"degraded", checks } → red (UptimeRobot alerts)
 */

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 4000;

async function checkSupabase(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(
      `${url.replace(/\/+$/, "")}/rest/v1/app_states?select=user_id&limit=0`,
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
    // 200 = OK, 206 = Partial-Content (PostgREST count-by-header), both
    // mean the schema + RLS are reachable. 401/404 = something is wrong.
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

export async function GET() {
  const checks: Record<string, boolean> = {};

  checks.supabase = await checkSupabase();

  const allHealthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: allHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
