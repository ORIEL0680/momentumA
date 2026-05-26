// R100 — server-only Twilio WhatsApp sender. The `server-only` import
// makes any accidental client import a build error (keeps
// TWILIO_AUTH_TOKEN out of the browser bundle).
//
// Why the SDK and not direct REST (like lib/twilioClient.ts for SMS)?
// The WhatsApp Business API has richer features we'll want next
// (templates, media, statuses, content variables). The Twilio SDK
// already wraps those endpoints with proper types so we don't have to
// shape the form-encoded payload by hand for each one.
//
// Bundle cost: ~1MB on the serverless function, server-side only.
import "server-only";
import Twilio from "twilio";
import { normalizeIsraeliPhone } from "@/lib/phone";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
/** Sender number in E.164 form, e.g. "+972533625007". The "whatsapp:"
 *  channel prefix is added at send time so the var stays readable. */
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

let _client: Twilio.Twilio | null = null;
function getClient(): Twilio.Twilio | null {
  if (_client) return _client;
  if (!TWILIO_SID || !TWILIO_TOKEN) return null;
  _client = Twilio(TWILIO_SID, TWILIO_TOKEN);
  return _client;
}

/** True when all required env vars are present. */
export function isWhatsAppConfigured(): boolean {
  return !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_WHATSAPP_FROM);
}

/**
 * R133 — true when the configured sender is Twilio's shared WhatsApp
 * Sandbox number (`+14155238886`).
 *
 * Sandbox mode has a hard limitation that bit the owner: Twilio will
 * ONLY deliver messages to phones that have manually sent
 * `join <keyword>` to that number first. The owner's phone joined
 * during setup → receives messages. Guests never joined → Twilio
 * silently drops their messages (sometimes returns "queued" or
 * "sent" status, but no delivery actually happens).
 *
 * The only path to deliver-to-anyone is moving off the sandbox to a
 * verified WhatsApp Business sender through Twilio + Meta. Until
 * then the UI surfaces this banner so the host doesn't waste real
 * invitations on the silent-drop path.
 */
export function isWhatsAppSandbox(): boolean {
  if (!TWILIO_WHATSAPP_FROM) return false;
  // The canonical sandbox number. Normalize for "+", spaces, dashes.
  const digits = TWILIO_WHATSAPP_FROM.replace(/\D/g, "");
  return digits === "14155238886";
}

export interface SendResult {
  ok: boolean;
  /** Twilio message SID on success — pass to status webhooks for tracking. */
  sid?: string;
  status?: string;
  /** Short machine-readable error code so callers can branch. */
  error?:
    | "not_configured"
    | "invalid_phone"
    | "twilio_error"
    | "rate_limited"
    | "network";
  /** Human-readable detail (truncated, safe to surface in toasts). */
  detail?: string;
}

/**
 * Send a plain WhatsApp message via Twilio.
 *
 * IMPORTANT — WhatsApp Business 24-hour rule: outbound messages to a
 * user who hasn't messaged you in the last 24 hours MUST use an
 * approved Template (Message Templates in the Twilio console / WABA).
 * Free-form text only works inside the 24-hour customer-service
 * window. For initial outreach use `sendWhatsAppTemplate` below.
 *
 * Never throws — returns a result object so callers can degrade
 * gracefully (the wa.me share link is the fallback path).
 */
export async function sendWhatsApp({
  to,
  body,
}: {
  /** Recipient number — accepts Israeli local ("050-1234567") or E.164. */
  to: string;
  body: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client || !TWILIO_WHATSAPP_FROM) {
    return { ok: false, error: "not_configured" };
  }

  const normalized = normalizeIsraeliPhone(to);
  if (!normalized.valid) {
    return { ok: false, error: "invalid_phone", detail: to };
  }
  // Twilio WhatsApp wants E.164 with leading "+". normalizeIsraeliPhone
  // returns digits-only ("972..."), so prepend "+".
  const e164 = `+${normalized.phone}`;

  try {
    const msg = await client.messages.create({
      from: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${e164}`,
      body,
    });
    return { ok: true, sid: msg.sid, status: msg.status };
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 200) : "unknown";
    console.error("[twilio-whatsapp] send failed", e);
    // Twilio error code 20429 = rate limit; 21610 = recipient opted out;
    // 63016 = outside 24h window without template.
    const rawCode = (e as { code?: number | string } | null)?.code;
    if (rawCode === 20429) return { ok: false, error: "rate_limited", detail };
    return { ok: false, error: "twilio_error", detail };
  }
}

/** Status snapshot of a single WhatsApp message Twilio is tracking. */
export interface MessageStatus {
  sid: string;
  to: string;
  from: string;
  body?: string;
  status: string;
  /** Twilio error code, when status === "failed" or "undelivered". */
  errorCode?: number | null;
  errorMessage?: string | null;
  dateCreated?: string;
  dateUpdated?: string;
  dateSent?: string;
}

/**
 * Fetch the latest WhatsApp messages this account has sent. Used by
 * the host-side diagnostic panel to answer "did the message actually
 * get delivered, or did Twilio silently reject it?".
 *
 * Filtered to the `whatsapp:` channel only (the account also sends SMS
 * via lib/twilioClient for vendor flows; those would clutter the view).
 */
export async function fetchRecentWhatsAppMessages(
  limit = 20,
): Promise<{ ok: true; messages: MessageStatus[] } | { ok: false; error: string }> {
  const client = getClient();
  if (!client || !TWILIO_WHATSAPP_FROM) {
    return { ok: false, error: "not_configured" };
  }
  try {
    const list = await client.messages.list({
      from: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
      limit,
    });
    const messages: MessageStatus[] = list.map((m) => ({
      sid: m.sid,
      to: m.to,
      from: m.from,
      body: m.body,
      status: m.status,
      errorCode: m.errorCode ?? null,
      errorMessage: m.errorMessage ?? null,
      dateCreated: m.dateCreated?.toISOString(),
      dateUpdated: m.dateUpdated?.toISOString(),
      dateSent: m.dateSent?.toISOString(),
    }));
    return { ok: true, messages };
  } catch (e) {
    console.error("[twilio-whatsapp] fetch recent failed", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    };
  }
}

/**
 * Send an approved WhatsApp template — required for the first message
 * to a user (or any message outside the 24-hour service window).
 *
 * Templates must be created and approved in the Twilio console first;
 * pass the `contentSid` (e.g. "HXxxxxxxxxxxxx") and any variables.
 *
 * Reference: https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-with-templates
 */
export async function sendWhatsAppTemplate({
  to,
  contentSid,
  contentVariables,
}: {
  to: string;
  contentSid: string;
  contentVariables?: Record<string, string>;
}): Promise<SendResult> {
  const client = getClient();
  if (!client || !TWILIO_WHATSAPP_FROM) {
    return { ok: false, error: "not_configured" };
  }

  const normalized = normalizeIsraeliPhone(to);
  if (!normalized.valid) {
    return { ok: false, error: "invalid_phone", detail: to };
  }
  const e164 = `+${normalized.phone}`;

  try {
    const msg = await client.messages.create({
      from: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${e164}`,
      contentSid,
      ...(contentVariables
        ? { contentVariables: JSON.stringify(contentVariables) }
        : {}),
    });
    return { ok: true, sid: msg.sid, status: msg.status };
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 200) : "unknown";
    console.error("[twilio-whatsapp] template send failed", e);
    return { ok: false, error: "twilio_error", detail };
  }
}
