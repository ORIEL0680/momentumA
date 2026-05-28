import {
  MapPin,
  Briefcase,
  Award,
  Phone,
  MessageCircle,
  Globe,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { VendorAutoLandingRow } from "@/lib/vendorAutoLanding";
import { VENDOR_CATEGORIES } from "@/lib/vendorApplication";
import {
  buildInstagramUrl,
  buildFacebookUrl,
  buildWebsiteUrl,
  buildWhatsAppUrl,
} from "@/lib/socialHandles";
import { Header } from "@/components/Header";
import { InstagramGlyph, FacebookGlyph } from "@/components/vendors/typeIcons";

/**
 * R85 (R67 fix) — auto-generated mini landing for an approved vendor
 * application. Server-rendered (no "use client"). All vendor data is
 * already trusted (escaped via React's default text rendering); links
 * go through the central normalizer in lib/socialHandles so a vendor
 * who typed `https://instagram.com/foo/` and one who typed `@foo` both
 * end up at the same canonical URL.
 *
 * Sections, in order:
 *   1. Header (global) — keeps the app shell consistent.
 *   2. Hero — category emoji + gradient business name + city/years chips.
 *   3. Contact bar — WhatsApp / Call / Sample-work. Sticky on mobile.
 *   4. About — long-form vendor description.
 *   5. Trust strip — "verified by Momentum" + years in business.
 *   6. Social — Instagram / Facebook / website (only the ones present).
 *   7. CTA card — encourages the visitor to also message via WhatsApp.
 *
 * Notes:
 *   • No prices anywhere — per R67 policy.
 *   • No gallery yet (the application form only captures a single
 *     `sample_work_url`). When/if vendors upload more, we'll add a
 *     grid here; for now the sample link sits as a primary action.
 */
export function VendorAutoLanding({
  vendor,
}: {
  vendor: VendorAutoLandingRow;
}) {
  const category = VENDOR_CATEGORIES.find((c) => c.id === vendor.category);
  const categoryLabel = category?.label ?? vendor.category;
  const categoryEmoji = category?.emoji ?? "✨";

  const instagram = buildInstagramUrl(vendor.instagram);
  const facebook = buildFacebookUrl(vendor.facebook);
  const website = buildWebsiteUrl(vendor.website);
  const sample = buildWebsiteUrl(vendor.sample_work_url);

  const waMessage = `שלום ${vendor.contact_name || ""}, ראיתי את ${vendor.business_name} ב-Momentum ומעוניין לשמוע פרטים על האירוע שלי`;
  const waUrl = buildWhatsAppUrl(vendor.phone, waMessage);
  const telUrl = vendor.phone ? `tel:${vendor.phone.replace(/\D/g, "")}` : null;

  const hasAnySocial = !!(instagram || facebook || website);
  const hasContact = !!(waUrl || telUrl);

  return (
    <>
      <Header />
      <main className="flex-1 pb-32">
        {/* Hero */}
        <section
          className="relative overflow-hidden"
          style={{
            background:
              // R88 (R71) — theme-aware hero gradient. The gold halo
              // stays gold; the under-layer flips between dark and
              // light via --background / --background-2.
              "radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 60%), linear-gradient(180deg, var(--background-2) 0%, var(--background) 100%)",
          }}
        >
          {/* Soft floating gold orb. */}
          <div
            aria-hidden
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full pointer-events-none float-slow"
            style={{
              background:
                "radial-gradient(circle, rgba(244,222,169,0.18), transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 pt-12 pb-10 text-center">
            {/* R107 — inline "back to catalog" link removed; the sticky
                <VendorBackButton /> pill mounted by the page now covers
                this affordance and stays visible on scroll. */}
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-wider font-semibold"
              style={{
                background: "rgba(0,0,0,0.35)",
                border: "1px solid var(--border-gold)",
                color: "var(--accent)",
              }}
            >
              <span aria-hidden>{categoryEmoji}</span>
              {categoryLabel}
            </div>
            <h1
              className="mt-4 font-extrabold tracking-tight gradient-gold-shimmer leading-[1.05]"
              style={{ fontSize: "clamp(2.25rem, 6vw, 3.75rem)" }}
            >
              {vendor.business_name}
            </h1>
            <div
              className="mt-4 inline-flex items-center flex-wrap justify-center gap-x-4 gap-y-2 text-sm"
              style={{ color: "var(--foreground-soft)" }}
            >
              {vendor.city && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden /> {vendor.city}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Briefcase size={14} aria-hidden /> {categoryLabel}
              </span>
              {vendor.years_in_field > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Award size={14} aria-hidden />
                  <span className="ltr-num">{vendor.years_in_field}</span> שנות
                  ותק
                </span>
              )}
            </div>
            <div
              className="mt-4 inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
              style={{
                background: "rgba(110,231,183,0.10)",
                border: "1px solid rgba(110,231,183,0.30)",
                color: "rgb(110,231,183)",
              }}
            >
              <ShieldCheck size={12} aria-hidden />
              ספק מאומת ב-Momentum
            </div>
          </div>
        </section>

        {/* Sticky contact bar (visible after hero scrolls off; here it
            sits inline directly under the hero — desktop-friendly. The
            mobile sticky-bottom variant is at the page end.) */}
        {hasContact && (
          <section className="max-w-3xl mx-auto px-5 sm:px-8 -mt-2">
            <div
              className="card-gold p-3 grid grid-cols-1 sm:grid-cols-2 gap-2"
              style={{ borderRadius: "1.25rem" }}
            >
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-sm transition hover:translate-y-[-1px]"
                  style={{
                    background:
                      "linear-gradient(135deg, #25D366, #128C7E)",
                    color: "white",
                    boxShadow: "0 4px 14px rgba(37,211,102,0.3)",
                  }}
                >
                  <MessageCircle size={16} aria-hidden />
                  שלחו וואטסאפ
                </a>
              )}
              {telUrl && (
                <a
                  href={telUrl}
                  className="btn-gold inline-flex items-center justify-center gap-2 py-3"
                >
                  <Phone size={16} aria-hidden />
                  התקשרו עכשיו
                </a>
              )}
            </div>
          </section>
        )}

        {/* About */}
        {vendor.about && (
          <section className="max-w-3xl mx-auto px-5 sm:px-8 mt-10">
            <h2
              className="text-xs uppercase tracking-widest font-semibold mb-3"
              style={{ color: "var(--accent)" }}
            >
              קצת עלינו
            </h2>
            <div
              className="card p-6 text-base leading-relaxed whitespace-pre-line"
              style={{ color: "var(--foreground-soft)" }}
            >
              {vendor.about}
            </div>
          </section>
        )}

        {/* Trust strip — three small badges */}
        <section className="max-w-3xl mx-auto px-5 sm:px-8 mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TrustBadge
              icon={<ShieldCheck size={18} aria-hidden />}
              title="מאומת"
              body="כל ספק עובר אימות זהות וניסיון לפני שמופיע בקטלוג"
            />
            <TrustBadge
              icon={<Sparkles size={18} aria-hidden />}
              title="מומלץ"
              body="חלק מהקהילה של זוגות שתכננו ב-Momentum"
            />
            <TrustBadge
              icon={<Briefcase size={18} aria-hidden />}
              title={
                vendor.years_in_field > 0
                  ? `${vendor.years_in_field}+ שנות ניסיון`
                  : "ניסיון מקצועי"
              }
              body="עם רקורד אמיתי באירועים בישראל"
            />
          </div>
        </section>

        {/* Sample work — single link, prominent */}
        {sample && (
          <section className="max-w-3xl mx-auto px-5 sm:px-8 mt-8">
            <h2
              className="text-xs uppercase tracking-widest font-semibold mb-3"
              style={{ color: "var(--accent)" }}
            >
              דוגמת עבודה
            </h2>
            <a
              href={sample}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-5 flex items-center justify-between gap-3 transition hover:-translate-y-0.5 hover:border-[var(--border-gold)]"
            >
              <div>
                <div className="font-semibold">צפו בעבודה אמיתית</div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  נפתח בלשונית חדשה
                </div>
              </div>
              <ExternalLink
                size={16}
                style={{ color: "var(--accent)" }}
                aria-hidden
              />
            </a>
          </section>
        )}

        {/* Social */}
        {hasAnySocial && (
          <section className="max-w-3xl mx-auto px-5 sm:px-8 mt-8">
            <h2
              className="text-xs uppercase tracking-widest font-semibold mb-3"
              style={{ color: "var(--accent)" }}
            >
              ברשתות
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {instagram && (
                <SocialChip href={instagram} label="אינסטגרם">
                  <InstagramGlyph size={16} />
                </SocialChip>
              )}
              {facebook && (
                <SocialChip href={facebook} label="פייסבוק">
                  <FacebookGlyph size={16} />
                </SocialChip>
              )}
              {website && (
                <SocialChip href={website} label="אתר">
                  <Globe size={16} aria-hidden />
                </SocialChip>
              )}
            </div>
          </section>
        )}

        {/* Bottom CTA card */}
        {hasContact && (
          <section className="max-w-3xl mx-auto px-5 sm:px-8 mt-12">
            <div
              className="card-gold p-7 text-center"
              style={{ borderRadius: "1.5rem" }}
            >
              <h3 className="text-xl font-extrabold gradient-gold-shimmer">
                אהבתם? פנו ל-{vendor.business_name}
              </h3>
              <p
                className="mt-2 text-sm leading-relaxed max-w-md mx-auto"
                style={{ color: "var(--foreground-soft)" }}
              >
                שלחו הודעה ישירות בוואטסאפ. הספק רואה את הפנייה ויחזור אליכם
                בדרך כלל באותו היום.
              </p>
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-full font-bold text-sm transition hover:translate-y-[-1px] mt-5"
                  style={{
                    background:
                      "linear-gradient(135deg, #25D366, #128C7E)",
                    color: "white",
                    boxShadow: "0 4px 14px rgba(37,211,102,0.3)",
                  }}
                >
                  <MessageCircle size={16} aria-hidden />
                  פתחו וואטסאפ עם ההודעה מוכנה
                </a>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Mobile sticky bottom CTA */}
      {hasContact && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2"
          style={{
            // R88 (R71) — theme-aware. Both were hardcoded dark and
            // looked wrong against a light-mode page.
            background:
              "linear-gradient(180deg, transparent, color-mix(in srgb, var(--background) 92%, transparent) 40%)",
          }}
        >
          <div
            className="grid grid-cols-2 gap-2 rounded-2xl p-2"
            style={{
              background: "color-mix(in srgb, var(--background) 92%, transparent)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              border: "1px solid var(--border-gold)",
            }}
          >
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                style={{
                  background: "linear-gradient(135deg, #25D366, #128C7E)",
                  color: "white",
                }}
              >
                <MessageCircle size={15} aria-hidden /> וואטסאפ
              </a>
            )}
            {telUrl && (
              <a
                href={telUrl}
                className="btn-gold inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm"
              >
                <Phone size={15} aria-hidden /> שיחה
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function TrustBadge({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className="card p-4 flex items-start gap-3"
      style={{ borderColor: "var(--border)" }}
    >
      <div
        className="w-9 h-9 rounded-full inline-flex items-center justify-center shrink-0"
        style={{
          background: "color-mix(in srgb, var(--accent) 12%, transparent)",
          color: "var(--accent)",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold">{title}</div>
        <div
          className="text-xs mt-0.5 leading-snug"
          style={{ color: "var(--foreground-muted)" }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

function SocialChip({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm py-2 px-4 rounded-full transition hover:translate-y-[-1px]"
      style={{
        background: "rgba(212,176,104,0.10)",
        border: "1px solid var(--border-gold)",
        color: "var(--accent)",
      }}
    >
      {children}
      {label}
    </a>
  );
}
