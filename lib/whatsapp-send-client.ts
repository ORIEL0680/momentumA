/**
 * R78 — client-side wrapper around POST /api/whatsapp/send.
 *
 * Server-side concerns (Twilio creds, rate limit, phone normalization)
 * stay in the API route + lib/twilio-whatsapp. This module just builds
 * the request and shapes the response into something a button-click
 * handler can consume.
 *
 * No `server-only` import — this file runs in the browser intentionally.
 */
import { getSupabase } from "@/lib/supabase";

export type WhatsAppSendError =
  | "not_configured"
  | "auth"
  | "phone_required"
  | "invalid_phone"
  | "message_or_template_required"
  | "message_too_long"
  | "rate_limited"
  | "twilio_error"
  | "outside_24h_window" // synthesized from twilio_error detail
  | "network";

export interface WhatsAppSendResult {
  ok: boolean;
  /** Twilio message SID on success. */
  sid?: string;
  status?: string;
  error?: WhatsAppSendError;
  /** Human-readable detail (already truncated by the server). */
  detail?: string;
  /** Hebrew hint matched to the error code — show this in toasts. */
  hebrewHint?: string;
}

const HINTS: Record<WhatsAppSendError, string> = {
  not_configured: "שירות WhatsApp לא מוגדר עדיין",
  auth: "התחבר מחדש ונסה שוב",
  phone_required: "חסר מספר טלפון לאורח",
  invalid_phone: "מספר הטלפון לא תקין",
  message_or_template_required: "חסרה הודעה לשליחה",
  message_too_long: "ההודעה ארוכה מדי",
  rate_limited: "עברת את מגבלת השליחות לשעה",
  twilio_error: "השליחה נכשלה — נסה שוב או שלח דרך וואטסאפ",
  outside_24h_window:
    "מחוץ לחלון 24 השעות של WhatsApp — צריך תבנית מאושרת לפניה ראשונה",
  network: "אין חיבור לאינטרנט",
};

interface SendArgs {
  phone: string;
  /** Free-form body — only delivered if recipient is inside the 24h window. */
  message?: string;
  /** Approved Content SID (e.g. "HX...") — required for first contact. */
  templateSid?: string;
  /** Positional template variables, keyed "1", "2", ... — e.g.
   *  { "1": "דנה", "2": "טל וענת", ... } */
  variables?: Record<string, string>;
}

/**
 * Send a WhatsApp message to a phone via Momentum's number. Pass either
 * `message` (free-form, works only inside the 24h customer-service
 * window) or `templateSid + variables` (any time, required for first
 * contact).
 *
 * For the "send invitation" flow the right pattern is:
 *   1) Try templateSid → works for new guests.
 *   2) If template is rejected or not configured → try free-form.
 *   3) If both fail → caller falls back to wa.me.
 *
 * Returns a typed result; never throws.
 */
export async function sendWhatsAppMessage(
  args: SendArgs,
): Promise<WhatsAppSendResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      error: "auth",
      hebrewHint: HINTS.auth,
    };
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return {
      ok: false,
      error: "auth",
      hebrewHint: HINTS.auth,
    };
  }

  try {
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: args.phone,
        ...(args.templateSid
          ? { templateSid: args.templateSid, variables: args.variables }
          : { message: args.message }),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Partial<{
      ok: boolean;
      sid: string;
      status: string;
      error: string;
      detail: string;
    }>;

    if (res.ok && body.ok) {
      return { ok: true, sid: body.sid, status: body.status };
    }

    // Synthesize "outside_24h_window" from Twilio's structured error
    // codes (63016 = no opted-in user, 63007 = no matching template).
    // The detail string is what we'd surface to a developer; the
    // hebrewHint is what the toast shows the user.
    let errorCode = (body.error ?? "twilio_error") as WhatsAppSendError;
    if (
      errorCode === "twilio_error" &&
      typeof body.detail === "string" &&
      /63016|63007|24[- ]?hour|outside.*window|template/i.test(body.detail)
    ) {
      errorCode = "outside_24h_window";
    }
    return {
      ok: false,
      error: errorCode,
      detail: body.detail,
      hebrewHint: HINTS[errorCode] ?? HINTS.twilio_error,
    };
  } catch (e) {
    return {
      ok: false,
      error: "network",
      detail: e instanceof Error ? e.message : "fetch failed",
      hebrewHint: HINTS.network,
    };
  }
}
