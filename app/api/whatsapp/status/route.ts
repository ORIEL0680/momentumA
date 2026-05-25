import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchRecentWhatsAppMessages,
  isWhatsAppConfigured,
} from "@/lib/twilio-whatsapp";
import { rateLimit } from "@/lib/serverRateLimit";

/**
 * R113 — GET /api/whatsapp/status
 *
 * Returns the most recent WhatsApp messages this account has sent
 * (channel "whatsapp:<TWILIO_WHATSAPP_FROM>"), with their Twilio
 * delivery status: queued, sent, delivered, read, failed, undelivered.
 *
 * Used by the host-side diagnostic panel on /guests to answer "did
 * the invitations I just sent actually reach my guests?". A failure
 * mode common after R105's bulk-send: Twilio accepts the request +
 * returns a SID, but Meta/WhatsApp rejects delivery silently (template
 * not yet approved, recipient not opted-in, etc.). Without this
 * endpoint the host can't tell.
 *
 * Auth: Bearer Supabase access token (same shape as /api/whatsapp/send).
 * Rate limit: 60 GETs/user/hour.
 *
 * Returns:
 *   200  { ok: true, messages: MessageStatus[] }
 *   401  { ok: false, error: "auth" }
 *   429  { ok: false, error: "rate_limited" }
 *   503  { ok: false, error: "not_configured" }
 *   502  { ok: false, error: "twilio_error", detail }
 */

export async function GET(req: NextRequest) {
  if (!isWhatsAppConfigured()) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  }
  const token = auth.slice(7);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  }

  if (!rateLimit("whatsapp-status", user.id, 60, 60 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : 20;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(50, Math.max(1, parsedLimit))
    : 20;

  const result = await fetchRecentWhatsAppMessages(limit);
  if (!result.ok) {
    const status = result.error === "not_configured" ? 503 : 502;
    return NextResponse.json(
      { ok: false, error: result.error },
      { status },
    );
  }

  return NextResponse.json({ ok: true, messages: result.messages });
}
