/**
 * R59 (R49) — shared server-side admin gate.
 *
 * Same proven pattern as /api/admin/stats and /api/vendors/admin/decide:
 *   1. Caller passes the user's JWT as `Authorization: Bearer …`.
 *   2. An anon client bound to that JWT proves identity AND reads
 *      `admin_emails` under RLS (RLS only surfaces the row when the JWT
 *      email matches — a null row is the rejection).
 *   3. On success, hand back a SERVICE-ROLE client for cross-user reads.
 *
 * This is the real security boundary (the client-side AdminGuard is
 * only UX). Server-side `getUser()`/middleware can't be used here: this
 * app persists the Supabase session in localStorage, not cookies.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isFounderEmail } from "../constants";

export type AdminGateResult =
  | { ok: true; adminClient: SupabaseClient; email: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(
  req: NextRequest,
): Promise<AdminGateResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Supabase not configured" },
        { status: 503 },
      ),
    };
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      ),
    };
  }
  const userToken = auth.slice(7);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user?.email) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      ),
    };
  }
  const email = user.email.toLowerCase().trim();

  // R64 (R79) — founder bypass. Skip the admin_emails RLS lookup
  // entirely when the JWT email is the founder. Keeps /admin reachable
  // even if the DB row is missing (post-truncation, RLS misconfig, …).
  if (!isFounderEmail(email)) {
    const { data: adminRow } = (await userClient
      .from("admin_emails")
      .select("email")
      .eq("email", email)
      .maybeSingle()) as { data: { email: string } | null };
    if (!adminRow) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Not authorized" }, { status: 403 }),
      };
    }
  }

  if (!serviceRoleKey) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY חסר — נדרש לקריאת נתונים חוצי-משתמשים.",
        },
        { status: 503 },
      ),
    };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { ok: true, adminClient, email };
}
