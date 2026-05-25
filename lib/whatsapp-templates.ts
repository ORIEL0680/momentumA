/**
 * R79 — public registry of approved WhatsApp Content Templates.
 *
 * The Content SID is the unique identifier WhatsApp gives an approved
 * template (starts with "HX..."). Reading it as a NEXT_PUBLIC_* env var
 * means the client knows up-front whether a template path is even
 * possible — so we can fall back gracefully to free-form / wa.me when
 * the template isn't configured yet (e.g. during the 24-48h approval
 * window after submission).
 *
 * Empty string when the env var isn't set; callers MUST check before
 * passing to sendWhatsAppMessage({ templateSid }).
 */

/** First-contact guest invitation — required for the very first message
 *  a guest receives. Once the user has replied, free-form text works
 *  inside the 24h customer-service window. */
export const GUEST_INVITATION_TEMPLATE_SID: string =
  process.env.NEXT_PUBLIC_TWILIO_TEMPLATE_INVITATION_SID ?? "";

/** Reminder template for guests who haven't responded in N days. Same
 *  rule: required outside the 24h window. */
export const RSVP_REMINDER_TEMPLATE_SID: string =
  process.env.NEXT_PUBLIC_TWILIO_TEMPLATE_REMINDER_SID ?? "";

/** True when the invitation template SID is set. The send flow uses
 *  this to decide whether to attempt a template-based first send or to
 *  fall straight back to the wa.me path. */
export function hasGuestInvitationTemplate(): boolean {
  return GUEST_INVITATION_TEMPLATE_SID.startsWith("HX");
}

export interface GuestInvitationVars {
  /** Guest first name — {{1}} in the template. */
  guestName: string;
  /** Host names — {{2}} in the template. */
  hostNames: string;
  /** Formatted date string — {{3}} in the template. */
  date: string;
  /** Venue + city — {{4}} in the template. */
  venue: string;
  /** Bare RSVP URL — {{5}} in the template. */
  rsvpUrl: string;
}

/** Build the `variables` map that POST /api/whatsapp/send expects when
 *  the request carries a `templateSid`. The shape mirrors Twilio's
 *  ContentVariables — keys are positional ("1", "2", ...). */
export function buildGuestInvitationVariables(
  vars: GuestInvitationVars,
): Record<string, string> {
  return {
    "1": vars.guestName,
    "2": vars.hostNames,
    "3": vars.date,
    "4": vars.venue,
    "5": vars.rsvpUrl,
  };
}
