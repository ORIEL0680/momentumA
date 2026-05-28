/**
 * R116 — client-side wrapper around POST /api/sms/send.
 *
 * SMS is the reliable fallback channel while the WhatsApp Business
 * template is pending Meta approval. The shape mirrors
 * `whatsapp-send-client.ts` so callers can swap channels with minimal
 * branching.
 *
 * No `server-only` import — this runs in the browser.
 */
import { getSupabase } from "@/lib/supabase";

export type SmsSendError =
  | "not_configured"
  | "auth"
  | "phone_required"
  | "invalid_phone"
  | "message_required"
  | "message_too_long"
  | "rate_limited"
  | "twilio_error"
  | "network";

export interface SmsSendResult {
  ok: boolean;
  error?: SmsSendError;
  detail?: string;
  hebrewHint?: string;
}

const HINTS: Record<SmsSendError, string> = {
  not_configured: "שירות SMS לא מוגדר עדיין",
  auth: "התחבר מחדש ונסה שוב",
  phone_required: "חסר מספר טלפון לאורח",
  invalid_phone: "מספר הטלפון לא תקין",
  message_required: "חסרה הודעה לשליחה",
  message_too_long: "ההודעה ארוכה מדי",
  rate_limited: "עברת את מגבלת השליחות לשעה",
  twilio_error: "השליחה נכשלה — נסה שוב",
  network: "אין חיבור לאינטרנט",
};

interface SendArgs {
  phone: string;
  message: string;
}

export async function sendSmsMessage(
  args: SendArgs,
): Promise<SmsSendResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "auth", hebrewHint: HINTS.auth };
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return { ok: false, error: "auth", hebrewHint: HINTS.auth };
  }

  try {
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone: args.phone, message: args.message }),
    });
    const body = (await res.json().catch(() => ({}))) as Partial<{
      ok: boolean;
      error: string;
      detail: string;
    }>;
    if (res.ok && body.ok) return { ok: true };
    const errorCode = (body.error ?? "twilio_error") as SmsSendError;
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
