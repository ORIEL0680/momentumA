import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { fetchVendorBySlug, getVendorPhotoUrl } from "@/lib/vendorStudio";
import {
  fetchApprovedApplication,
  isAutoLandingSlug,
} from "@/lib/vendorAutoLanding";
import { VENDOR_CATEGORIES } from "@/lib/vendorApplication";
import { jsonLdSafe } from "@/lib/jsonLdSafe";
import { VendorLandingClient } from "@/components/vendor-studio/VendorLandingClient";
import { VendorAutoLanding } from "@/components/vendors/VendorAutoLanding";
import { VendorChatLauncher } from "@/components/chat/VendorChatLauncher";

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
    return {
      title: `${v.business_name} — ${cat ?? "ספק"}${v.city ? ` ב-${v.city}` : ""} | Momentum`,
      description: (v.about ?? `${v.business_name} — ספק מאומת ב-Momentum.`).slice(0, 160),
      alternates: { canonical: `/vendor/${slug}` },
      openGraph: {
        title: v.business_name,
        description: (v.about ?? "").slice(0, 200),
        type: "website",
        locale: "he_IL",
      },
    };
  }

  const vendor = await fetchVendorBySlug(slug);
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

  return {
    title: `${vendor.name} — ${vendor.category ?? "ספק"}${vendor.city ? ` ב-${vendor.city}` : ""} | Momentum`,
    description: description.slice(0, 160),
    keywords,
    openGraph: {
      title: vendor.name,
      description,
      images: heroImg ? [{ url: heroImg, width: 1200, height: 630, alt: vendor.name }] : undefined,
      type: "website",
      locale: "he_IL",
    },
    twitter: {
      card: heroImg ? "summary_large_image" : "summary",
      title: vendor.name,
      description,
      images: heroImg ? [heroImg] : undefined,
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

  // R85 (R67 fix) — auto-landing path: slug shaped like `app-<uuid>`
  // is an approved vendor application. Render the mini landing
  // component, which is server-rendered + reads ONLY public-safe
  // columns via the service-role helper.
  if (isAutoLandingSlug(slug)) {
    const autoVendor = await fetchApprovedApplication(slug);
    if (!autoVendor) notFound();
    return <VendorAutoLanding vendor={autoVendor} />;
  }

  const vendor = await fetchVendorBySlug(slug);
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
      {/* R43 — couple chat entry; self-hides unless an active lead exists. */}
      <VendorChatLauncher slug={slug} />
    </>
  );
}
