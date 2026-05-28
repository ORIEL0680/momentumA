import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { fetchVendorBySlug, getVendorPhotoUrl } from "@/lib/vendorStudio";
import {
  fetchApprovedApplication,
  findLandingForApplication,
  isAutoLandingSlug,
  applicationIdFromSlug,
} from "@/lib/vendorAutoLanding";
import { VENDOR_CATEGORIES } from "@/lib/vendorApplication";
import { jsonLdSafe } from "@/lib/jsonLdSafe";
import { VendorLandingClient } from "@/components/vendor-studio/VendorLandingClient";
import { VendorAutoLanding } from "@/components/vendors/VendorAutoLanding";
import { VendorChatLauncher } from "@/components/chat/VendorChatLauncher";
import { VendorViewTracker } from "@/components/vendors/VendorViewTracker";

/**
 * R20 Phase 9 — public vendor landing page.
 *
 * Server-rendered for SEO. `generateMetadata` builds OG + Twitter cards.
 * The page emits JSON-LD `LocalBusiness` structured data so Google can
 * surface name, phone, address, and social profiles in the SERP.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

// R86 — re-fetch every 30s on a public-page hit so a vendor who
// just updated their logo / cover / gallery sees the change appear
// to couples within ~30s (vs. the indefinite CDN cache Next defaults
// to for static-tagged SSR responses). 30 is the sweet spot: fresh
// enough that the vendor doesn't feel "stuck on the old version"
// after saving, slow enough that the public URL still hits CDN for
// most requests.
export const revalidate = 30;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  // R11 P0 #1 — empty / whitespace-only slug short-circuits before we hit
  // the DB. Otherwise we'd build a partially-formed JSON-LD with "/vendor/"
  // as the canonical URL.
  if (!slug?.trim()) return { title: "ספק לא נמצא — Momentum" };

  // R85 (R67 fix) — auto landings for approved applications (slug
  // prefix `app-`) get their own lightweight metadata so the catalog
  // card's link → real page works without 404s, and OG previews look
  // clean when shared.
  if (isAutoLandingSlug(slug)) {
    const v = await fetchApprovedApplication(slug);
    if (!v) return { title: "ספק לא נמצא — Momentum" };
    const cat = VENDOR_CATEGORIES.find((c) => c.id === v.category)?.label;
    // R124 — every share gets a hero image. Auto-landings don't have a
    // custom photo yet, so we use the brand fallback so WhatsApp /
    // Facebook / Twitter previews never go bare.
    const ogFallback = [
      {
        url: "/og-default-1200x630.png",
        width: 1200,
        height: 630,
        alt: v.business_name,
      },
    ];
    return {
      title: `${v.business_name} — ${cat ?? "ספק"}${v.city ? ` ב-${v.city}` : ""} | Momentum`,
      description: (v.about ?? `${v.business_name} — ספק מאומת ב-Momentum.`).slice(0, 160),
      alternates: { canonical: `/vendor/${slug}` },
      openGraph: {
        title: v.business_name,
        description: (v.about ?? "").slice(0, 200),
        type: "website",
        locale: "he_IL",
        images: ogFallback,
      },
      twitter: {
        card: "summary_large_image",
        title: v.business_name,
        description: (v.about ?? "").slice(0, 200),
        images: ["/og-default-1200x630.png"],
      },
    };
  }

  // R100 — match the page-render call below: allow unpublished.
  const vendor = await fetchVendorBySlug(slug, true);
  if (!vendor) return { title: "ספק לא נמצא — Momentum" };

  const heroImg = vendor.hero_photo_path
    ? getVendorPhotoUrl(vendor.hero_photo_path)
    : undefined;
  const description = (
    vendor.tagline ??
    vendor.description ??
    `${vendor.name} — ספק ${vendor.category ?? ""} מומלץ ב-${vendor.city ?? "ישראל"}. דרך Momentum, פלטפורמת תכנון אירועים מובילה.`
  ).trim();

  const keywords = [
    vendor.name,
    vendor.category,
    vendor.city,
    "חתונה",
    "אירועים",
    "Momentum",
  ].filter((k): k is string => typeof k === "string" && k.length > 0);

  // R124 — always provide an OG image. When the vendor hasn't
  // uploaded a hero yet, fall back to the brand-default in /public so
  // share previews still look polished. The default exists at
  // /og-default-1200x630.png.
  const ogImages = heroImg
    ? [{ url: heroImg, width: 1200, height: 630, alt: vendor.name }]
    : [
        {
          url: "/og-default-1200x630.png",
          width: 1200,
          height: 630,
          alt: vendor.name,
        },
      ];
  const twitterImages = [heroImg ?? "/og-default-1200x630.png"];

  return {
    title: `${vendor.name} — ${vendor.category ?? "ספק"}${vendor.city ? ` ב-${vendor.city}` : ""} | Momentum`,
    description: description.slice(0, 160),
    keywords,
    openGraph: {
      title: vendor.name,
      description,
      images: ogImages,
      type: "website",
      locale: "he_IL",
    },
    twitter: {
      card: "summary_large_image",
      title: vendor.name,
      description,
      images: twitterImages,
    },
    alternates: {
      canonical: `/vendor/${slug}`,
    },
  };
}

export default async function VendorLandingPage({ params }: PageProps) {
  const { slug } = await params;
  // R11 P0 #1 — same guard as generateMetadata. notFound() throws, which
  // Next handles by rendering the 404 page.
  if (!slug?.trim()) notFound();

  // R85 (R67 fix) / R99 / R101 — auto-landing path: slug shaped
  // like `app-<uuid>` is an approved vendor application.
  //
  // R99 added a server-side redirect to /vendor/<canonical-slug>
  // when a real landing existed. R101 REMOVED the redirect (it
  // caused intermittent 404s due to RLS / publish-flag chains).
  // Instead, we now:
  //   1. Render VendorAutoLanding directly (always reachable).
  //   2. Look up the canonical landing UUID server-side and pass
  //      it to <VendorViewTracker> so analytics records the view
  //      against the correct vendor_id (the landing UUID, which
  //      is what the dashboard + analytics queries by).
  //   3. Fall back to the application id for the tracker if no
  //      landing exists yet — the row is logged for future
  //      backfill / debugging.
  if (isAutoLandingSlug(slug)) {
    const autoVendor = await fetchApprovedApplication(slug);
    if (!autoVendor) notFound();
    const appId = applicationIdFromSlug(slug);
    const realLanding = appId ? await findLandingForApplication(appId) : null;
    const trackerVendorId = realLanding?.id ?? autoVendor.id;
    return (
      <>
        <VendorAutoLanding vendor={autoVendor} />
        <VendorViewTracker vendorId={trackerVendorId} />
      </>
    );
  }

  // R100 — `allowUnpublished = true` so an approved vendor's slug
  // page renders even when `landing_published = false`. The flag
  // was originally meant for a "draft → preview → publish" workflow
  // that never shipped; every approved vendor should be reachable.
  // The catalog only exposes approved vendors (RPC filter), so
  // there's no risk of revealing a private draft via this route —
  // a bogus slug still hits notFound() below.
  const vendor = await fetchVendorBySlug(slug, true);
  if (!vendor) notFound();

  // R11 P1 #14 — pull aggregate stats so Google can render a star
  // snippet in the SERP. Mirrors fetchVendorBySlug's server-side client
  // pattern (createClient + anon key) — getSupabase is client-only.
  let aggregate: { avg_rating: number; total_reviews: number } | null = null;
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (sbUrl && sbKey) {
    const client = createClient(sbUrl, sbKey);
    const { data: statsData } = (await client
      .from("vendor_review_stats")
      .select("avg_rating, total_reviews")
      .eq("vendor_id", vendor.id)
      .maybeSingle()) as {
      data: { avg_rating: number; total_reviews: number } | null;
    };
    if (statsData && statsData.total_reviews > 0) {
      aggregate = statsData;
    }
  }

  // R11 P1 #9 — build sameAs[] with explicit per-field sanitization.
  // - website: only http(s); anything else (javascript:, data:) is dropped.
  // - instagram / facebook: handle is encoded; leading "@" is stripped so
  //   "@studio" and "studio" produce the same link.
  const sameAsLinks: string[] = [];
  if (vendor.website && /^https?:\/\//i.test(vendor.website)) {
    sameAsLinks.push(vendor.website);
  }
  if (vendor.instagram) {
    sameAsLinks.push(
      `https://instagram.com/${encodeURIComponent(vendor.instagram.replace(/^@/, ""))}`,
    );
  }
  if (vendor.facebook) {
    sameAsLinks.push(
      `https://facebook.com/${encodeURIComponent(vendor.facebook)}`,
    );
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: vendor.name,
    description: vendor.description ?? vendor.tagline ?? undefined,
    image: vendor.hero_photo_path
      ? getVendorPhotoUrl(vendor.hero_photo_path)
      : undefined,
    url: site ? `${site}/vendor/${slug}` : `/vendor/${slug}`,
    telephone: vendor.phone ?? undefined,
    email: vendor.email ?? undefined,
    address: vendor.city
      ? {
          "@type": "PostalAddress",
          addressLocality: vendor.city,
          addressCountry: "IL",
        }
      : undefined,
    sameAs: sameAsLinks,
  };
  if (aggregate) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: aggregate.avg_rating,
      reviewCount: aggregate.total_reviews,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return (
    <>
      <script
        type="application/ld+json"
        // R12 §1A — jsonLdSafe escapes `<` etc so a malicious vendor
        // name can't break out of the script tag with `</script>`.
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }}
      />
      <VendorLandingClient vendor={vendor} />
      {/* R85-0 — spacer reserves room for the mobile sticky bottom
          bar so the page's last paragraph isn't covered by the CTA.
          Hidden on md+ where the contact sidebar lives top-right. */}
      <div aria-hidden className="h-24 md:hidden" />
      {/* R43 / R148 / R85-0 — couple-side multichannel contact bar.
          Mobile = sticky bottom bar across the screen.
          Desktop = floating sidebar card top-right.
          Wraps the existing chat infra (vendor_leads + ChatWindow)
          plus WhatsApp + tel links so a couple sees ALL contact
          options in one premium gold card. */}
      <VendorChatLauncher
        slug={slug}
        vendorName={vendor.name}
        vendorPhone={vendor.phone}
        ownerUserId={vendor.owner_user_id}
      />
    </>
  );
}
