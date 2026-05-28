"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Phone,
  MessageCircle,
  Globe,
  MapPin,
  Award,
  Sparkles,
  Languages,
  Star,
} from "lucide-react";
import { getVendorPhotoUrl } from "@/lib/vendorStudio";
import { safeHttpUrl } from "@/lib/safeUrl";
import { Logo } from "@/components/Logo";
import { VendorRatingSummary } from "@/components/vendors/VendorRatingSummary";
import { ReviewCard } from "@/components/vendors/ReviewCard";
// R84-3 — inline "rate this vendor" CTA. Opens the existing
// ReviewForm modal (3-step ratings → details → media) so the couple
// can publish a review without leaving the public page.
import { VendorRateLauncher } from "@/components/vendors/VendorRateLauncher";
import {
  InstagramGlyph,
  FacebookGlyph,
} from "@/components/vendors/typeIcons";
import type { VendorLandingData, VendorReview } from "@/lib/types";

/**
 * R20 Phase 9 — Luxurious template.
 *
 * Black background, gold gradient text, full-bleed hero. The other two
 * templates (Modern, Rustic) currently delegate to this one as MVP
 * placeholders — they'll get distinct designs in Phase 10.
 */
export interface TemplateProps {
  vendor: VendorLandingData;
  reviews: VendorReview[];
  onAction: (a: string) => void;
  whatsappUrl: string;
  // R12 §3U — pre-built `tel:` URL with normalized E.164 digits.
  // Computed once in VendorLandingClient so all three templates share the
  // exact same normalization (was `tel:${vendor.phone}` raw which broke on
  // numbers stored as "050-1234567" or "+972 50-123-4567").
  telUrl: string;
  // R14 §G — opens the lead-interest modal. Lifted to VendorLandingClient
  // so all three templates share one modal implementation + state.
  onSendInterest: () => void;
}

export function LuxuriousTemplate({
  vendor,
  reviews,
  onAction,
  whatsappUrl,
  telUrl,
  onSendInterest,
}: TemplateProps) {
  const [activePhoto, setActivePhoto] = useState(0);
  // R86 — three distinct visual roles, with fallback chains:
  //   • coverImg: full-bleed hero background. Prefers cover_image_url
  //     (wide aspect, set explicitly by the vendor) → falls back to
  //     hero_photo_path (legacy single image).
  //   • logoImg: optional small overlay logo. Prefers logo_url → falls
  //     back to nothing (we don't double-use the same image as both
  //     logo AND cover — that would be visually redundant).
  //   • galleryUrls: vendor.gallery_paths as before.
  // Cache-bust via ?v=image_updated_at so a re-uploaded same-path
  // file actually refreshes in the browser.
  const ts = vendor.image_updated_at
    ? Date.parse(vendor.image_updated_at)
    : null;
  const bust = (url: string | null): string | null => {
    if (!url) return null;
    if (!ts || !Number.isFinite(ts)) return url;
    return url.includes("?") ? url : `${url}?v=${ts}`;
  };
  const rawCover = vendor.cover_image_url || vendor.hero_photo_path;
  const rawLogo = vendor.logo_url;
  const coverImg = bust(rawCover ? getVendorPhotoUrl(rawCover) : null);
  const logoImg = bust(rawLogo ? getVendorPhotoUrl(rawLogo) : null);
  const galleryUrls = vendor.gallery_paths
    .map((p) => bust(getVendorPhotoUrl(p)))
    .filter((u): u is string => Boolean(u));

  return (
    <main className="min-h-screen" style={{ background: "var(--surface-0)" }}>
      {/* === HERO ===
          Layout pivots on whether the vendor uploaded a hero image:
          - WITH image  → tall (80vh) + content pinned to bottom over the
            gradient overlay (classic "billboard" look).
          - WITHOUT image → shorter (auto height) + content vertically
            centered, so the title doesn't hug the bottom of a black void
            and the page feels "open in the middle of the screen" rather
            than stuck at the bottom.
          On mobile we cap at 60vh either way so the user can scroll past
          the hero with one swipe. */}
      <section
        className={`relative overflow-hidden flex ${
          coverImg
            ? "min-h-[60vh] md:min-h-[80vh] items-end"
            : "min-h-[50vh] md:min-h-[55vh] items-center justify-center"
        }`}
      >
        {coverImg && (
          <div className="absolute inset-0">
            {/* Public Supabase Storage URL — next/image needs an allow-list
                for remote patterns we don't manage. <img> is intentional. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImg}
              alt={vendor.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          </div>
        )}

        {/* R86 — logo overlay. Premium gold ring + soft drop shadow,
            top-center (or top-left when no cover so the title gets
            visual weight first). Only renders when logo_url is set
            AND is distinct from coverImg (no double-image redundancy). */}
        {logoImg && logoImg !== coverImg && (
          <div
            className="absolute top-6 start-1/2 -translate-x-1/2 z-20"
            style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.55))" }}
          >
            <div
              className="rounded-2xl p-[2px]"
              style={{
                background:
                  "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
              }}
            >
              <div
                className="rounded-2xl overflow-hidden flex items-center justify-center"
                style={{
                  background: "var(--surface-1)",
                  width: 88,
                  height: 88,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoImg}
                  alt={`${vendor.name} — לוגו`}
                  className="w-full h-full object-contain p-2"
                />
              </div>
            </div>
          </div>
        )}

        <div
          className={`relative max-w-5xl mx-auto px-5 w-full ${
            coverImg ? "pb-16 pt-32" : "py-12 text-center"
          }`}
        >
          <div className="absolute top-6 end-5 flex items-center gap-2">
            <Logo size={18} />
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: "var(--foreground-muted)" }}
            >
              powered by Momentum
            </span>
          </div>

          {/* When there's no hero image, center the title block on the
              horizontal axis (it's a card-style introduction rather than
              an overlay on a photo). */}
          <div className={`max-w-2xl ${coverImg ? "" : "mx-auto"}`}>
            {/* R95 — eyebrow above the title for editorial rhythm,
                matches R138/R93 luxury hero language. */}
            <span
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold mb-4"
              style={{
                color: "var(--accent)",
                textShadow: coverImg ? "0 2px 8px rgba(0,0,0,0.5)" : "none",
              }}
            >
              <Sparkles size={11} aria-hidden /> {vendor.category ?? "ספק"}
            </span>
            {/* R95 — title in Frank Ruhl Libre (the luxury display
                serif used across the app's hero surfaces). Slightly
                tighter clamp + shimmer treatment for the brand mark
                feel. */}
            <h1
              className="font-extrabold tracking-tight gradient-gold-shimmer leading-[1.02]"
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: "clamp(2.75rem, 7vw, 4.75rem)",
              }}
            >
              {vendor.name}
            </h1>
            {vendor.tagline && (
              <p
                className="mt-5 text-lg md:text-2xl font-light italic"
                style={{
                  color: "var(--foreground-soft)",
                  fontFamily: "var(--font-display), Georgia, serif",
                }}
              >
                {vendor.tagline}
              </p>
            )}
            {/* R95 — ornamental rule (line + diamond floret + line)
                under tagline. Mirrors R93 catalog hero and R138
                IntimateHero. Subtle visual continuity. */}
            <div
              className={`hero-luxury-rule mt-6 ${coverImg ? "" : "justify-center"}`}
              aria-hidden
              style={coverImg ? { color: "var(--accent)" } : undefined}
            >
              <span className="line" />
              <span className="floret" />
              <span className="line" />
            </div>

            <div
              className={`mt-6 flex items-center gap-5 flex-wrap text-sm ${
                coverImg ? "" : "justify-center"
              }`}
              style={{ color: "var(--foreground-soft)" }}
            >
              {vendor.city && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden /> {vendor.city}
                </span>
              )}
              {vendor.years_experience && (
                <span className="inline-flex items-center gap-1.5 ltr-num">
                  <Award size={14} aria-hidden /> {vendor.years_experience} שנים בתחום
                </span>
              )}
              <VendorRatingSummary vendorId={vendor.id} compact />
            </div>

            <div
              className={`mt-8 flex flex-wrap gap-3 ${
                coverImg ? "" : "justify-center"
              }`}
            >
              {/* R14 §G — primary lead capture. Higher prominence than
                  WhatsApp because it creates a trackable lead in the
                  vendor's dashboard (SMS / WhatsApp clicks don't). */}
              <button
                type="button"
                onClick={onSendInterest}
                className="btn-gold inline-flex items-center gap-2 px-7 py-4 text-base"
              >
                <MessageCircle size={18} aria-hidden /> שלח התעניינות
              </button>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onAction("whatsapp")}
                  className="rounded-2xl px-7 py-4 text-base inline-flex items-center gap-2 backdrop-blur-md"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <MessageCircle size={18} aria-hidden /> WhatsApp
                </a>
              )}
              {telUrl && (
                <a
                  href={telUrl}
                  onClick={() => onAction("phone")}
                  className="rounded-2xl px-7 py-4 text-base inline-flex items-center gap-2 backdrop-blur-md"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <Phone size={18} aria-hidden /> התקשר
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* === ABOUT === */}
      {/* R95 — editorial about. Centered eyebrow + serif h2 +
          slightly larger leading on the body for the long-form
          reading-friendly feel. Service-area / language pills get
          a gold-bordered treatment matching the catalog tile
          chrome. */}
      {vendor.about_long && (
        <section className="max-w-3xl mx-auto px-5 py-20">
          <div className="text-center mb-8">
            <span
              className="text-[11px] uppercase tracking-[0.22em] font-semibold"
              style={{ color: "var(--accent)" }}
            >
              קצת עליי
            </span>
            <h2
              className="mt-3 font-extrabold tracking-tight gradient-gold-shimmer leading-tight"
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: "clamp(1.875rem, 4vw, 2.5rem)",
              }}
            >
              הסיפור שלנו
            </h2>
            <div className="hero-luxury-rule mt-5 justify-center" aria-hidden>
              <span className="line" />
              <span className="floret" />
              <span className="line" />
            </div>
          </div>
          <p
            className="text-lg leading-[1.85] whitespace-pre-wrap"
            style={{ color: "var(--foreground-soft)" }}
          >
            {vendor.about_long}
          </p>

          {(vendor.service_areas.length > 0 || vendor.languages.length > 0) && (
            <div className="mt-10 grid sm:grid-cols-2 gap-6">
              {vendor.service_areas.length > 0 && (
                <div>
                  <h3
                    className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-3 inline-flex items-center gap-1.5"
                    style={{ color: "var(--accent)" }}
                  >
                    <MapPin size={11} aria-hidden /> איזורי שירות
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {vendor.service_areas.map((area) => (
                      <span
                        key={area}
                        className="text-sm px-3 py-1.5 rounded-full"
                        style={{
                          background:
                            "linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--accent) 4%, transparent))",
                          border: "1px solid var(--border-gold)",
                          color: "var(--accent)",
                        }}
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {vendor.languages.length > 0 && (
                <div>
                  <h3
                    className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-3 inline-flex items-center gap-1.5"
                    style={{ color: "var(--accent)" }}
                  >
                    <Languages size={11} aria-hidden /> שפות
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {vendor.languages.map((lang) => (
                      <span
                        key={lang}
                        className="text-sm px-3 py-1.5 rounded-full"
                        style={{
                          background:
                            "linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--accent) 4%, transparent))",
                          border: "1px solid var(--border-gold)",
                          color: "var(--accent)",
                        }}
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* === GALLERY === */}
      {/* R95 — gallery polish: centered editorial header, larger
          main viewer with a gold ring, thumbnail strip with smooth
          opacity + scale transitions. */}
      {galleryUrls.length > 0 && (
        <section className="py-20" style={{ background: "var(--surface-1)" }}>
          <div className="max-w-6xl mx-auto px-5">
            <div className="text-center mb-10">
              <span
                className="text-[11px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: "var(--accent)" }}
              >
                גלריה
              </span>
              <h2
                className="mt-3 font-extrabold tracking-tight gradient-gold-shimmer leading-tight"
                style={{
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: "clamp(1.875rem, 4vw, 2.5rem)",
                }}
              >
                תיק עבודות
              </h2>
              <p
                className="text-sm mt-3 max-w-md mx-auto"
                style={{ color: "var(--foreground-soft)" }}
              >
                רגעים אמיתיים מאירועים שצילמנו / עיצבנו / השתתפנו בהם
              </p>
              <div className="hero-luxury-rule mt-5 justify-center" aria-hidden>
                <span className="line" />
                <span className="floret" />
                <span className="line" />
              </div>
            </div>

            <button
              type="button"
              className="block w-full mb-5 rounded-3xl overflow-hidden transition"
              style={{
                border: "1px solid var(--border-gold)",
                boxShadow:
                  "0 30px 80px -30px rgba(0,0,0,0.7), 0 0 0 1px var(--accent-glow)",
              }}
              onClick={() => onAction("gallery_open")}
              aria-label="פתח גלריה"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={galleryUrls[activePhoto]}
                alt=""
                className="w-full max-h-[640px] object-cover"
              />
            </button>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5">
              {galleryUrls.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActivePhoto(i)}
                  className={`aspect-square rounded-xl overflow-hidden transition duration-300 ease-out ${
                    i === activePhoto
                      ? "ring-2 ring-[--accent] scale-[1.03]"
                      : "opacity-60 hover:opacity-100 hover:scale-[1.02]"
                  }`}
                  style={
                    i === activePhoto
                      ? { boxShadow: "0 6px 18px -6px var(--accent-glow)" }
                      : undefined
                  }
                  aria-label={`תמונה ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* === REVIEWS === */}
      {/* R95 — centered editorial header. Star icon embedded in
          the gold ornament position, no longer a side-affixed
          afterthought. */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-5">
          <div className="text-center mb-10">
            <span
              className="text-[11px] uppercase tracking-[0.22em] font-semibold inline-flex items-center gap-1.5"
              style={{ color: "var(--accent)" }}
            >
              <Star size={11} aria-hidden /> דירוגים
            </span>
            <h2
              className="mt-3 font-extrabold tracking-tight gradient-gold-shimmer leading-tight"
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: "clamp(1.875rem, 4vw, 2.5rem)",
              }}
            >
              מה הזוגות אומרים
            </h2>
            <div className="hero-luxury-rule mt-5 justify-center" aria-hidden>
              <span className="line" />
              <span className="floret" />
              <span className="line" />
            </div>
          </div>

          <VendorRatingSummary vendorId={vendor.id} />

          {/* R84-3 — inline rate-this-vendor CTA. Wraps the existing
              ReviewForm (used in catalog QuickLook) so the couple can
              publish a review straight from the public page. Hidden
              for the vendor themselves; routes signed-out visitors
              to /signup with a returnTo. */}
          <VendorRateLauncher
            vendorId={vendor.id}
            vendorName={vendor.name}
            ownerUserId={vendor.owner_user_id}
            returnTo={`/vendor/${vendor.slug}`}
          />

          {reviews.length > 0 && (
            <div className="mt-8 space-y-4">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* === CONTACT FOOTER === */}
      {/* R95 — invitation-style closing section. Bigger headline,
          italic serif sub, ornamental rule between heading + CTAs.
          The background is a layered radial so the section reads
          as a "let's talk" cinematic close, not just another card. */}
      <section
        className="py-24 relative overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent) 14%, var(--surface-1)), var(--surface-1) 60%)",
        }}
      >
        <div className="max-w-3xl mx-auto px-5 text-center relative z-10">
          <span
            className="text-[11px] uppercase tracking-[0.22em] font-semibold"
            style={{ color: "var(--accent)" }}
          >
            יצירת קשר
          </span>
          <h2
            className="mt-3 font-extrabold tracking-tight gradient-gold-shimmer leading-tight"
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(2.25rem, 5vw, 3.25rem)",
            }}
          >
            בואו נדבר
          </h2>
          <p
            className="mt-5 text-lg italic mb-2"
            style={{
              color: "var(--foreground-soft)",
              fontFamily: "var(--font-display), Georgia, serif",
            }}
          >
            מעוניינים בשירות שלי? יצירת קשר זה התחלה של חתונה מושלמת.
          </p>
          <div className="hero-luxury-rule mt-6 mb-8 justify-center" aria-hidden>
            <span className="line" />
            <span className="floret" />
            <span className="line" />
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onAction("whatsapp")}
                className="btn-gold inline-flex items-center gap-2 px-8 py-4"
              >
                <MessageCircle size={18} aria-hidden /> שלח WhatsApp
              </a>
            )}
            {(() => {
              // R11 P1 #8 — sanitize every URL before it lands in href.
              // `safeHttpUrl` drops javascript:/data:/file: schemes; the
              // instagram/facebook handles get encoded + the leading "@"
              // is stripped so "@studio" → "studio" → encoded.
              const safeWebsite = safeHttpUrl(vendor.website);
              const igHandle = vendor.instagram?.replace(/^@/, "").trim();
              const fbHandle = vendor.facebook?.trim();
              return (
                <>
                  {safeWebsite && (
                    <a
                      href={safeWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onAction("website")}
                      className="rounded-2xl px-6 py-4 inline-flex items-center gap-2"
                      style={{
                        background: "var(--input-bg)",
                        border: "1px solid var(--border-strong)",
                      }}
                    >
                      <Globe size={18} aria-hidden /> אתר
                    </a>
                  )}
                  {igHandle && (
                    <a
                      href={`https://instagram.com/${encodeURIComponent(igHandle)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onAction("instagram")}
                      className="rounded-2xl px-6 py-4 inline-flex items-center gap-2"
                      style={{
                        background: "var(--input-bg)",
                        border: "1px solid var(--border-strong)",
                      }}
                    >
                      <InstagramGlyph size={18} /> Instagram
                    </a>
                  )}
                  {fbHandle && (
                    <a
                      href={`https://facebook.com/${encodeURIComponent(fbHandle)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onAction("facebook")}
                      className="rounded-2xl px-6 py-4 inline-flex items-center gap-2"
                      style={{
                        background: "var(--input-bg)",
                        border: "1px solid var(--border-strong)",
                      }}
                    >
                      <FacebookGlyph size={18} /> Facebook
                    </a>
                  )}
                </>
              );
            })()}
          </div>

          <div
            className="mt-12 pt-8 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs"
              style={{ color: "var(--foreground-muted)" }}
            >
              <Logo size={16} />
              דף נוצר על ידי Momentum — פלטפורמת תכנון אירועים בישראל
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
