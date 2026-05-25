import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendWhatsApp,
  sendWhatsAppTemplate,
  isWhatsAppConfigured,
} from "@/lib/twilio-whatsapp";
import { rateLimit } from "@/lib/serverRateLimit";

/**
 * R100 — POST /api/whatsapp/send
 *
 * Body shapes (one of):
 *   { phone: string, message: string }
 *     → free-form text. Only delivered if the recipient is inside the
 *       24-hour customer-service window.
 *
 *   { phone: string, templateSid: string, variables?: Record<string,string> }
 *     → approved WhatsApp Business template. Required for the first
 *       message to a user (and any message outside the 24h window).
 *
 * Auth: Bearer <supabase access token> — only signed-in users can
 * trigger an outbound message. The `phone` field is the recipient, not
 * the caller; the caller is identified by the access token.
 *
 * Rate limit: 30 messages per user per hour (in-process sliding window;
 * good enough to stop a tight abuse loop / cost-amplification at this
 * scale — Twilio also caps and bills per attempt).
 *
 * Returns:
 *   200  { ok: true, sid, status }            — accepted by Twilio
 *   400  { ok: false, error, detail? }        — bad input
 *   401  { ok: false, error: "auth" }         — missing/bad token
 *   429  { ok: false, error: "rate_limited" } — over the per-user cap
 *   503  { ok: false, error: "not_configured" } — env vars missing
 *   502  { ok: false, error: "twilio_error", detail } — upstream failed
 */

interface Body {
  phone?: string;
  message?: string;
  templateSid?: string;
  variables?: Record<string, string>;
}

const MAX_MESSAGE_LEN = 1600; // WhatsApp message body cap.

export async function POST(req: NextRequest) {
  if (!isWhatsAppConfigured()) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503 },
    );
  }

  // ── Auth ──────────────────────────────────────────────────────────
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

  // ── Body validation ───────────────────────────────────────────────
  const body = (await req.json().catch(() => ({}))) as Body;
  const phone = (body.phone ?? "").trim();
  const message = (body.message ?? "").trim();
  const templateSid = (body.templateSid ?? "").trim();

  if (!phone) {
    return NextResponse.json(
      { ok: false, error: "phone_required" },
      { status: 400 },
    );
  }

  // Either free-form message OR template SID — not neither.
  if (!message && !templateSid) {
    return NextResponse.json(
      { ok: false, error: "message_or_template_required" },
      { status: 400 },
    );
  }

  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      { ok: false, error: "message_too_long" },
      { status: 400 },
    );
  }

  // ── Rate limit ────────────────────────────────────────────────────
  // R105: 500/hr per user. Wedding-scale bulk sends (200-400 guests
  // pushed in one batch) need headroom; abuse worst-case at $0.025/msg
  // is ~$12.50/hr/attacker, which is fine. Twilio itself accepts
  // 80 msg/sec so the bottleneck is now our DB/network, not this gate.
  if (!rateLimit("whatsapp-send", user.id, 500, 60 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  // ── Send ──────────────────────────────────────────────────────────
  const result = templateSid
    ? await sendWhatsAppTemplate({
        to: phone,
        contentSid: templateSid,
        contentVariables: body.variables,
      })
    : await sendWhatsApp({ to: phone, body: message });

  if (!result.ok) {
    const status =
      result.error === "invalid_phone"
        ? 400
        : result.error === "rate_limited"
          ? 429
          : result.error === "not_configured"
            ? 503
            : 502;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({
    ok: true,
    sid: result.sid,
    status: result.status,
  });
}
