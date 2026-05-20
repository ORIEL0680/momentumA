import { normalizeIsraeliPhone } from "./phone";

/**
 * R20 Phase 3 — WhatsApp welcome message a manager sends to a guest the
 * moment they check in at the door. The message announces their table
 * number.
 *
 * R71 (R60-4): the public /pass/[eventId]/[guestId] page was removed
 * (Guest Pass QR feature deferred indefinitely). The welcome message
 * now contains just the warm greeting + the table assignment — no
 * link, no QR. Managers can still hand a printed seating chart at the
 * door if they want.
 */
export interface GuestWelcomeInput {
  guestName: string;
  guestPhone: string;
  guestId: string;
  eventId: string;
  /** The table's display label (uses SeatingTable.name in our schema). */
  tableLabel: string;
  hostName: string;
  partnerName?: string;
}

export interface GuestWelcomeResult {
  /** Ready-to-open wa.me URL. Falls back to recipient-less when phone
   *  fails normalization — manager can still paste the message. */
  url: string;
  text: string;
  /** False if the guest's phone failed normalization (won't open targeted
   *  wa.me). Manager UI should toast a hint in that case. */
  valid: boolean;
}

export function buildGuestWelcomeWhatsapp(input: GuestWelcomeInput): GuestWelcomeResult {
  const subjects = input.partnerName
    ? `${input.hostName} ו-${input.partnerName}`
    : input.hostName;

  const text = [
    `${input.guestName}, ברוך/ה הבא/ה! 🥂`,
    "",
    `${subjects} שמחים שהצטרפת לאירוע!`,
    "",
    `🪑 *השולחן שלך: ${input.tableLabel}*`,
    "",
    "תהנה/י! 💛",
  ].join("\n");
  const encoded = encodeURIComponent(text);

  const { phone, valid } = normalizeIsraeliPhone(input.guestPhone);
  return {
    url: valid
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`,
    text,
    valid,
  };
}
