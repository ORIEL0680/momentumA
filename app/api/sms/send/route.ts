import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { rateLimit } from "@/lib/serverRateLimit";

/**
 * R117 — direct Twilio call so we can resolve the SMS sender at
 * runtime. lib/twilioClient.sendSms() requires TWILIO_SMS_FROM
 * specifically; this route falls back to TWILIO_WHATSAPP_FROM
 * when that's the only sender the host has configured. A single
 * Twilio number with WhatsApp Business enabled can also send
 * plain SMS, so reusing the WhatsApp sender works without any
 * env-var change on the user's end.
 */
async function sendSmsViaTwilio({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from =
    process.env.TWILIO_SMS_FROM ?? process.env.TWILIO_WHATSAPP_FROM ?? "";
  if (!sid || !token || !from) {
    return { ok: false, error: "twilio not configured" };
  }

  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", from);
  form.set("Body", body);

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(
        `[api/sms/send] Twilio ${res.status}: ${errBody.slice(0, 200)}`,
      );
      return { ok: false, error: `twilio ${res.status}: ${errBody.slice(0, 150)}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[api/sms/send] fetch failed", e);
    return { ok: false, error: "network" };
  }
}

/**
 * R116 — POST /api/sms/send
 *
 * Reliable SMS fallback path while the WhatsApp Business template is
 * pending Meta approval. WhatsApp + Twilio approve the template SID
 * but Meta has its own approval workflow that can take days; until it
 * clears, every first-contact message is silently rejected (error
 * 63016 / 63020) and guests see nothing. SMS doesn't have that
 * approval bottleneck and works for every Israeli mobile number.
 *
 * Body: { phone: string, message: string }
 * Auth: Bearer <supabase access token>
 * Rate limit: 500 / user / hour (same as the WhatsApp route)
 *
 * Returns:
 *   200  { ok: true }                                  — accepted by Twilio
 *   400  { ok: false, error: "phone_required" }
 *   400  { ok: false, error: "message_required" }
 *   400  { ok: false, error: "invalid_phone", detail } — bad number
 *   401  { ok: false, error: "auth" }
 *   429  { ok: false, error: "rate_limited" }
 *   503  { ok: false, error: "not_configured" }       — TWILIO_SMS_FROM unset
 *   502  { ok: false, error: "twilio_error", detail }
 */

interface Body {
  phone?: string;
  message?: string;
}

const MAX_MESSAGE_LEN = 1600; // Same body cap as the WhatsApp route.

export async function POST(req: NextRequest) {
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

  if (!phone) {
    return NextResponse.json(
      { ok: false, error: "phone_required" },
      { status: 400 },
    );
  }
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "message_required" },
      { status: 400 },
    );
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      { ok: false, error: "message_too_long" },
      { status: 400 },
    );
  }

  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized.valid) {
    return NextResponse.json(
      { ok: false, error: "invalid_phone", detail: phone },
      { status: 400 },
    );
  }

  // ── Rate limit (shared bucket with WhatsApp so a host can't bypass
  //   the cap by switching channels). 500/hr/user; abuse worst-case at
  //   ~$0.04/SMS = $20/hr/attacker, acceptable. ────────────────────
  if (!rateLimit("messaging-send", user.id, 500, 60 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  // ── Send ──────────────────────────────────────────────────────────
  const e164 = `+${normalized.phone}`;
  const result = await sendSmsViaTwilio({ to: e164, body: message });
  if (!result.ok) {
    const isConfig = result.error === "twilio not configured";
    return NextResponse.json(
      { ok: false, error: isConfig ? "not_configured" : "twilio_error", detail: result.error },
      { status: isConfig ? 503 : 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
