import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * R68 (R57) — manage the user's iCal sync token.
 *
 *   GET    → returns the user's current token (creates one if missing).
 *   DELETE → revokes the current token and issues a new one (rotate).
 *
 * Auth: caller passes their JWT as `Authorization: Bearer …`. RLS on
 * `calendar_sync_tokens` (user_id = auth.uid()) handles authorization;
 * no service-role needed.
 */

interface TokenRow {
  user_id: string;
  token: string;
  enabled: boolean;
  created_at: string;
  last_accessed_at: string | null;
}

/** Cryptographically random token (URL-safe, 32 chars ≈ 192 bits). */
function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // URL-safe base64 without padding.
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function authedClient(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return {
      err: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }),
    } as const;
  }
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return {
      err: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    } as const;
  }
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      err: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    } as const;
  }
  return { supabase, user } as const;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await authedClient(req);
    if ("err" in ctx) return ctx.err;
    const { supabase, user } = ctx;

    // Try to read the existing token first.
    const { data: existing } = (await supabase
      .from("calendar_sync_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()) as { data: TokenRow | null };

    if (existing && existing.enabled) {
      return NextResponse.json({ token: existing.token });
    }

    // No row or disabled → upsert a fresh enabled token.
    const fresh = newToken();
    const { error } = await supabase
      .from("calendar_sync_tokens")
      .upsert(
        { user_id: user.id, token: fresh, enabled: true },
        { onConflict: "user_id" },
      );
    if (error) {
      console.error("[/api/calendar/sync-token GET]", error.message);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    return NextResponse.json({ token: fresh });
  } catch (e) {
    console.error("[/api/calendar/sync-token GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // Rotate: replace the existing token with a fresh one, instantly
  // invalidating the previous calendar subscription. We don't return
  // 204 — the new token is the meaningful payload.
  try {
    const ctx = await authedClient(req);
    if ("err" in ctx) return ctx.err;
    const { supabase, user } = ctx;

    const fresh = newToken();
    const { error } = await supabase
      .from("calendar_sync_tokens")
      .upsert(
        { user_id: user.id, token: fresh, enabled: true },
        { onConflict: "user_id" },
      );
    if (error) {
      console.error("[/api/calendar/sync-token DELETE]", error.message);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    return NextResponse.json({ token: fresh, rotated: true });
  } catch (e) {
    console.error("[/api/calendar/sync-token DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
