import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * R59 (R49) — error sink. Client/server error-tracker POSTs here; we
 * insert into `error_logs` with the service-role key (RLS has no insert
 * policy, so this is the only write path). Unauthenticated on purpose:
 * the most valuable errors happen in the signed-out auth flow. Abuse is
 * bounded by hard caps on every field + a fixed type enum; no secrets
 * are ever stored (the tracker never sends tokens).
 */

const TYPES = new Set(["auth", "db", "api", "unknown"]);

function cap(s: unknown, n: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > n ? t.slice(0, n) : t;
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    // No service role → silently accept so callers never throw on a
    // best-effort log. (204: nothing stored, nothing to say.)
    if (!supabaseUrl || !serviceRoleKey) {
      return new NextResponse(null, { status: 204 });
    }

    const body = (await req.json().catch(() => null)) as {
      type?: string;
      message?: string;
      stack?: string;
      user_id?: string;
      url?: string;
      user_agent?: string;
    } | null;

    const message = cap(body?.message, 2000);
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }
    const type =
      body?.type && TYPES.has(body.type) ? body.type : "unknown";

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await admin.from("error_logs").insert({
      type,
      message,
      stack: cap(body?.stack, 6000),
      // Only accept a UUID-looking user_id; anything else → null.
      user_id:
        typeof body?.user_id === "string" &&
        /^[0-9a-f-]{36}$/i.test(body.user_id)
          ? body.user_id
          : null,
      url: cap(body?.url, 500),
      user_agent: cap(body?.user_agent, 500),
    });
    if (error) {
      console.error("[/api/admin/log-error] insert failed", error.message);
      return NextResponse.json({ error: "log failed" }, { status: 500 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("[/api/admin/log-error]", e);
    return NextResponse.json({ error: "log failed" }, { status: 500 });
  }
}
