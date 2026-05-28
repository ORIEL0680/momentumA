import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * R107 — sticky "back to catalog" pill rendered on every vendor
 * landing page (both VendorAutoLanding + LuxuriousTemplate via the
 * page-level mount in /vendor/[slug]/page.tsx).
 *
 * Placement: fixed top, end-aligned (RTL = top-right). Sits above
 * the hero overlay but below modals + the global Header. Premium
 * gold-bordered pill with backdrop-blur so it stays legible over
 * full-bleed cover photos.
 *
 * Pre-R107 the only "go back" affordance on a landing page was a
 * single inline link near the top of `VendorAutoLanding` — invisible
 * on the studio template, and disappeared as soon as the user
 * scrolled past it. The new sticky pill is always there.
 */
export function VendorBackButton() {
  return (
    <Link
      href="/vendors"
      aria-label="חזרה לקטלוג הספקים"
      className="fixed top-20 end-4 md:end-6 z-30 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition hover:scale-[1.04] hover:gap-2"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface-1)), color-mix(in srgb, var(--accent) 6%, var(--surface-1)))",
        border: "1px solid var(--border-gold)",
        color: "var(--accent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow:
          "0 10px 28px -12px rgba(0,0,0,0.6), 0 0 0 1px var(--border-gold), inset 0 1px 0 rgba(244,222,169,0.18)",
      }}
    >
      <ArrowRight size={14} aria-hidden />
      חזרה לקטלוג
    </Link>
  );
}
