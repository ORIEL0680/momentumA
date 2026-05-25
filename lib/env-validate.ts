/**
 * R47 — startup sanity check for the public-origin env var, so a
 * mis-set or stale value after the moomentum.events migration shows up
 * loudly in Vercel build/Function logs instead of silently breaking
 * auth redirects.
 *
 * Pure logging only — never throws (a hard crash at import time would
 * take the whole app down for a non-fatal misconfig). Server-side only.
 */
export function validateEnv(): void {
  const url = process.env.NEXT_PUBLIC_SITE_URL;

  if (!url) {
    console.error("[env] ❌ NEXT_PUBLIC_SITE_URL is missing!");
    return;
  }

  if (url.includes("momentum-psi-ten")) {
    console.warn(
      "[env] ⚠️ NEXT_PUBLIC_SITE_URL still points to the old domain:",
      url,
    );
  }

  if (!url.startsWith("https://")) {
    console.warn("[env] ⚠️ NEXT_PUBLIC_SITE_URL should use https://:", url);
  }

  // R100 — Twilio WhatsApp credentials. Optional feature, so missing
  // values are a warning, not an error: the WhatsApp send route returns
  // 503 "not_configured" rather than 500, and the app keeps working
  // (wa.me share links are the fallback path).
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;
  const anyTwilio = twilioSid || twilioToken || twilioFrom;
  const allTwilio = twilioSid && twilioToken && twilioFrom;
  if (anyTwilio && !allTwilio) {
    console.warn(
      "[env] ⚠️ Partial Twilio WhatsApp config — set all three of " +
        "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (or none).",
    );
  }
  if (allTwilio && !twilioFrom?.startsWith("+")) {
    console.warn(
      "[env] ⚠️ TWILIO_WHATSAPP_FROM should be in E.164 form (e.g. +972533625007):",
      twilioFrom,
    );
  }
}
