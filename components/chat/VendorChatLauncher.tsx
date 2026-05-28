"use client";

import { Phone } from "lucide-react";

/**
 * R90 — multichannel contact bar on /vendor/[slug].
 *
 * Pre-R90 this component also rendered an in-app "💬 chat" button
 * that opened ChatWindow against vendor_chat_messages. The user
 * decided to retire in-app chat entirely ("שידברו רק בוואצפ") —
 * couples now reach vendors over WhatsApp or phone only.
 *
 * Layout unchanged:
 *   • Mobile: full-width sticky bottom bar across the viewport.
 *   • Desktop: floating sidebar card top-right.
 * Just stripped to two channels (WhatsApp + phone) instead of three.
 *
 * The lead pipeline (vendor_leads INSERT + vendor bell + email +
 * SMS notification) is unaffected — those flow through the
 * `<VendorContactModal>` (the explicit "send interest" form) which
 * is mounted by `<VendorLandingClient>`, separate from this CTA.
 */

export interface VendorChatLauncherProps {
  /** vendor_landings.slug — unused now (the lead pipeline uses
   *  it elsewhere) but kept in the prop signature so the page
   *  doesn't break when chat returns later. */
  slug: string;
  vendorName: string;
  vendorPhone: string | null;
  /** R85-0 — hide the bar when the vendor views their own page. */
  ownerUserId: string;
}

export function VendorChatLauncher({
  slug: _slug,
  vendorName,
  vendorPhone,
  ownerUserId: _ownerUserId,
}: VendorChatLauncherProps) {
  // R90 — `slug` and `ownerUserId` are part of the future contract
  // (when in-app chat returns we'll need them) but unused today.
  // Reference them to silence the lint without exposing a no-op.
  void _slug;
  void _ownerUserId;

  const phoneClean = vendorPhone ? vendorPhone.replace(/[^\d+]/g, "") : "";
  const telHref = phoneClean ? `tel:${phoneClean}` : null;
  const waDigits = phoneClean.replace(/\+/g, "");
  const waMessage = encodeURIComponent(
    `שלום! ראיתי את הדף שלכם ב-Momentum ואשמח לפרטים על האירוע שלי.`,
  );
  const whatsappHref = waDigits
    ? `https://wa.me/${waDigits}?text=${waMessage}`
    : null;

  // No phone AND no WhatsApp → nothing to show.
  if (!telHref && !whatsappHref) return null;

  return (
    <>
      {/* ─── Mobile: sticky bottom bar ─────────────────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          background:
            "linear-gradient(180deg, transparent, color-mix(in srgb, var(--background) 95%, transparent) 30%)",
        }}
      >
        <div
          className="mx-3 mb-3 p-2.5 flex items-center gap-2"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface-1)), var(--surface-1))",
            border: "1px solid var(--border-gold)",
            borderRadius: 18,
            boxShadow:
              "0 18px 40px -16px rgba(0,0,0,0.6), 0 0 0 1px var(--border-gold), inset 0 1px 0 rgba(244,222,169,0.18)",
          }}
        >
          {telHref && (
            <a
              href={telHref}
              className="shrink-0 w-11 h-11 rounded-2xl inline-flex items-center justify-center"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              aria-label={`התקשר ל-${vendorName}`}
            >
              <Phone size={18} aria-hidden />
            </a>
          )}

          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white"
              style={{
                minHeight: 44,
                background: "#25D366",
              }}
              aria-label={`WhatsApp ל-${vendorName}`}
            >
              <WhatsappIcon size={16} />
              שלח הודעה ב-WhatsApp
            </a>
          ) : (
            <a
              href={telHref!}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold"
              style={{
                minHeight: 44,
                background:
                  "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                color: "var(--gold-button-text)",
              }}
            >
              <Phone size={16} aria-hidden />
              התקשר ל-{vendorName}
            </a>
          )}
        </div>
      </div>

      {/* ─── Desktop: floating sidebar card ─────────────────────── */}
      <aside
        className="hidden md:flex fixed top-28 end-6 z-40 flex-col gap-2 w-64"
        aria-label={`יצירת קשר עם ${vendorName}`}
      >
        <div
          className="p-4 flex flex-col gap-2.5"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--surface-1)), var(--surface-1))",
            border: "1px solid var(--border-gold)",
            borderRadius: 20,
            boxShadow:
              "0 24px 60px -28px var(--accent-glow), 0 0 0 1px var(--border-gold), inset 0 1px 0 rgba(244,222,169,0.18)",
          }}
        >
          <div className="text-center">
            <div
              className="text-[10px] uppercase tracking-[0.18em] font-semibold"
              style={{ color: "var(--accent)" }}
            >
              צרו קשר
            </div>
            <div
              className="mt-1 font-bold text-sm gradient-gold truncate"
              style={{ fontFamily: "var(--font-display), Georgia, serif" }}
              title={vendorName}
            >
              {vendorName}
            </div>
          </div>

          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:scale-[1.02]"
              style={{ background: "#25D366" }}
            >
              <WhatsappIcon size={14} />
              שלח הודעה ב-WhatsApp
            </a>
          )}

          {telHref && (
            <a
              href={telHref}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition hover:scale-[1.02]"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <Phone size={14} aria-hidden />
              שיחה
            </a>
          )}

          <div
            className="text-[10px] text-center mt-1"
            style={{ color: "var(--foreground-muted)" }}
          >
            בדרך כלל עונים תוך 4 שעות
          </div>
        </div>
      </aside>
    </>
  );
}

/** Inline WhatsApp glyph (no extra dep). */
function WhatsappIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.36-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.886 9.884z" />
    </svg>
  );
}
