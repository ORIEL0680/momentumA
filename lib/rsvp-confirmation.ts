/**
 * R119 — RSVP confirmation orchestrator.
 *
 * Meta rejected the `rsvp_confirmation_v2` WhatsApp template, so
 * confirmations go out via SMS (Twilio) + Email (Resend) instead.
 * This module is the single place that knows what an RSVP
 * confirmation looks like in plain text and in HTML so the API
 * route is just a thin auth + dispatch layer.
 *
 * Server-only: imports Twilio + Resend creds. If accidentally
 * imported from a client bundle the `server-only` guard will fail
 * the build before the secrets leak.
 */

import "server-only";

const NOTIFY_TIMEOUT_MS = 5000;

interface ConfirmationParams {
  guestPhone?: string | null;
  guestEmail?: string | null;
  guestName: string;
  hostNames: string;
  /** Pre-formatted Hebrew date string (e.g. "ראשון, 15 בספטמבר 2026"). */
  dateText: string;
  /** Venue + city (whatever the host has set). */
  venue: string;
  /** Optional Waze URL — emitted only when both venue text + a parseable
   *  address are available. */
  wazeUrl?: string;
}

export interface ConfirmationResult {
  sms: { status: "sent" | "skipped" | "failed"; error?: string };
  email: { status: "sent" | "skipped" | "failed"; error?: string };
}

/**
 * Send an RSVP "thanks, we got it" via SMS + email. Either channel is
 * optional — pass `null`/empty to skip. Both channels are best-effort;
 * a failure in one never blocks the other. Caller logs the result.
 */
export async function sendRsvpConfirmation(
  params: ConfirmationParams,
): Promise<ConfirmationResult> {
  const smsResult = params.guestPhone?.trim()
    ? await sendConfirmationSms({
        to: params.guestPhone,
        text: buildSmsText(params),
      })
    : { status: "skipped" as const };

  const emailResult = params.guestEmail?.trim()
    ? await sendConfirmationEmail({
        to: params.guestEmail,
        subject: buildEmailSubject(params),
        html: buildEmailHtml(params),
        text: buildSmsText(params),
      })
    : { status: "skipped" as const };

  return { sms: smsResult, email: emailResult };
}

/**
 * Decline notification — sent when a guest replies "no". Shorter than
 * the confirmation since there's no logistics to share, but still
 * leaves a link to change one's mind. */
export async function sendRsvpDecline(params: {
  guestPhone?: string | null;
  guestEmail?: string | null;
  guestName: string;
  hostNames: string;
  rsvpUrl: string;
}): Promise<ConfirmationResult> {
  const text =
    `שלום ${params.guestName}, ` +
    `קיבלנו את העדכון שלא תוכל/י להגיע לאירוע של ${params.hostNames}. ` +
    `אם המצב משתנה — אפשר תמיד לעדכן כאן: ${params.rsvpUrl}`;

  const smsResult = params.guestPhone?.trim()
    ? await sendConfirmationSms({ to: params.guestPhone, text })
    : { status: "skipped" as const };

  const emailResult = params.guestEmail?.trim()
    ? await sendConfirmationEmail({
        to: params.guestEmail,
        subject: `עדכון RSVP — ${params.hostNames}`,
        html: buildDeclineEmailHtml({ ...params, text }),
        text,
      })
    : { status: "skipped" as const };

  return { sms: smsResult, email: emailResult };
}

// ─── Channel implementations ──────────────────────────────────────────

async function sendConfirmationSms({
  to,
  text,
}: {
  to: string;
  text: string;
}): Promise<ConfirmationResult["sms"]> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from =
    process.env.TWILIO_SMS_FROM ?? process.env.TWILIO_WHATSAPP_FROM ?? "";
  if (!sid || !token || !from) {
    return { status: "skipped", error: "twilio_not_configured" };
  }

  // Normalize to E.164 ("+972...") — tolerates "050-...", "+972 50 ...".
  const e164 = normalizeIsraeliPhoneE164(to);
  if (!e164) {
    return { status: "failed", error: "invalid_phone" };
  }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const form = new URLSearchParams();
    form.set("To", e164);
    form.set("From", from);
    form.set("Body", text);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(
        `[rsvp-confirm/sms] twilio ${res.status}: ${errBody.slice(0, 200)}`,
      );
      return {
        status: "failed",
        error: `twilio_${res.status}: ${errBody.slice(0, 120)}`,
      };
    }
    console.log(`[rsvp-confirm/sms] sent to=${e164}`);
    return { status: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[rsvp-confirm/sms] exception: ${msg}`);
    return { status: "failed", error: msg };
  }
}

async function sendConfirmationEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<ConfirmationResult["email"]> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { status: "skipped", error: "resend_not_configured" };
  }
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Momentum <${fromEmail}>`,
        to: [to],
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(
        `[rsvp-confirm/email] resend ${res.status}: ${errBody.slice(0, 200)}`,
      );
      return {
        status: "failed",
        error: `resend_${res.status}: ${errBody.slice(0, 120)}`,
      };
    }
    console.log(`[rsvp-confirm/email] sent to=${to}`);
    return { status: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[rsvp-confirm/email] exception: ${msg}`);
    return { status: "failed", error: msg };
  }
}

// ─── Message builders ─────────────────────────────────────────────────

function buildSmsText(params: ConfirmationParams): string {
  // Keep under ~160 chars where possible so it stays one SMS segment.
  // We accept multi-segment when there's a Waze link (always long).
  const wazeLine = params.wazeUrl ? ` ניווט: ${params.wazeUrl}` : "";
  return (
    `שלום ${params.guestName}, ` +
    `אישרנו את הגעתך לאירוע של ${params.hostNames} ב-${params.dateText}. ` +
    `מיקום: ${params.venue}.${wazeLine}`
  );
}

function buildEmailSubject(params: ConfirmationParams): string {
  return `✓ אישור הגעה — ${params.hostNames}`;
}

function buildEmailHtml(params: ConfirmationParams): string {
  const wazeBlock = params.wazeUrl
    ? `<div style="text-align:center;margin-top:28px;">
         <a href="${escapeHtml(params.wazeUrl)}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#F4DEA9,#D4B068);color:#0A0A0F;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;">פתח ניווט ב-Waze</a>
       </div>`
    : "";
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;background:#0A0A0F;font-family:-apple-system,'Segoe UI',sans-serif;color:#E8D9B8;padding:40px 20px;">
  <div style="max-width:540px;margin:0 auto;background:linear-gradient(170deg,#1A1A1F,#0A0A0F);border:1px solid #D4B068;border-radius:24px;padding:36px 28px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;line-height:1;margin-bottom:8px;color:#F4DEA9;">✓</div>
      <div style="font-size:13px;color:#A8884A;letter-spacing:0.18em;text-transform:uppercase;">אישור הגעה</div>
      <div style="font-size:22px;font-weight:900;color:#F4DEA9;margin-top:6px;">${escapeHtml(params.hostNames)}</div>
    </div>
    <p style="font-size:15px;line-height:1.7;color:#E8D9B8;margin:0 0 16px;">שלום ${escapeHtml(params.guestName)},</p>
    <p style="font-size:15px;line-height:1.7;color:#E8D9B8;margin:0 0 20px;">
      קיבלנו את אישור ההגעה שלך לאירוע של <strong style="color:#F4DEA9;">${escapeHtml(params.hostNames)}</strong>. נחכה לראותך שם!
    </p>
    <div style="background:rgba(212,176,104,0.08);border:1px solid rgba(212,176,104,0.25);border-radius:14px;padding:18px 20px;margin:20px 0;">
      <div style="font-size:13px;color:#A8884A;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">פרטי האירוע</div>
      <div style="font-size:14px;line-height:1.9;color:#E8D9B8;">
        <div>📅 ${escapeHtml(params.dateText)}</div>
        <div>📍 ${escapeHtml(params.venue)}</div>
      </div>
    </div>
    ${wazeBlock}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(212,176,104,0.2);font-size:11px;color:#6A5F4A;text-align:center;line-height:1.6;">
      Momentum · moomentum.events
    </div>
  </div>
</body>
</html>`;
}

function buildDeclineEmailHtml(params: {
  guestName: string;
  hostNames: string;
  rsvpUrl: string;
  text: string;
}): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;background:#0A0A0F;font-family:-apple-system,'Segoe UI',sans-serif;color:#E8D9B8;padding:40px 20px;">
  <div style="max-width:540px;margin:0 auto;background:linear-gradient(170deg,#1A1A1F,#0A0A0F);border:1px solid rgba(212,176,104,0.4);border-radius:24px;padding:36px 28px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:13px;color:#A8884A;letter-spacing:0.18em;text-transform:uppercase;">עדכון</div>
      <div style="font-size:22px;font-weight:900;color:#F4DEA9;margin-top:6px;">${escapeHtml(params.hostNames)}</div>
    </div>
    <p style="font-size:15px;line-height:1.8;color:#E8D9B8;margin:0 0 16px;">שלום ${escapeHtml(params.guestName)},</p>
    <p style="font-size:15px;line-height:1.8;color:#E8D9B8;margin:0 0 22px;">
      קיבלנו את העדכון שלא תוכל/י להגיע לאירוע. תודה שעדכנת — זה עוזר לנו לתכנן.
    </p>
    <div style="text-align:center;">
      <a href="${escapeHtml(params.rsvpUrl)}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#F4DEA9,#D4B068);color:#0A0A0F;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;">לעדכון התשובה</a>
    </div>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(212,176,104,0.2);font-size:11px;color:#6A5F4A;text-align:center;line-height:1.6;">
      Momentum · moomentum.events
    </div>
  </div>
</body>
</html>`;
}

// ─── helpers ──────────────────────────────────────────────────────────

function normalizeIsraeliPhoneE164(input: string): string | null {
  const clean = input.replace(/[^\d+]/g, "");
  if (!clean) return null;
  if (clean.startsWith("+972")) return clean;
  if (clean.startsWith("972")) return `+${clean}`;
  if (clean.startsWith("0")) return `+972${clean.slice(1)}`;
  if (clean.startsWith("5") && clean.length >= 9) return `+972${clean}`;
  // Any other +xx number we pass through unchanged — the host might be
  // sending to an international guest.
  if (clean.startsWith("+")) return clean;
  return null;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
