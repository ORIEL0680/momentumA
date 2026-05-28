"use client";

import type { VendorType } from "@/lib/types";

/**
 * R84-2 — premium fallback image for vendor catalog tiles when the
 * vendor hasn't uploaded a hero photo yet.
 *
 * Replaces the generic stock-image-by-category that
 * `vendorImageFor()` returned — those felt commodity (every catering
 * vendor had the same buffet photo). Each vendor now gets a unique
 * gradient + monogram derived deterministically from their name, so
 * the tile is recognizable + branded even without a real photo.
 *
 * Design:
 *   • Diagonal gradient — hue range picked from the vendor name's
 *     char-sum modulo a curated palette of 6 "luxury" palettes (warm
 *     gold, deep blue, rose, dusk, sage, plum). All saturations
 *     anchored so the result reads as on-brand, not random.
 *   • Subtle radial-dot pattern overlay (5% opacity) for texture.
 *   • Large serif monogram (first character of business name) in
 *     a soft white with drop-shadow for legibility.
 *   • Small category emoji in the bottom-end corner for context.
 *
 * Static SVG/CSS — no JS animations, no canvas. Renders identically
 * for the same name every time so cards don't shuffle on re-render.
 */

// Curated palette of premium gradient pairs (HSL: [hue, sat%, light%])
// keyed by the modulo of the name's char-sum. 6 entries to give
// enough variety without becoming chaotic on a 12-tile catalog.
const PALETTES: Array<[[number, number, number], [number, number, number]]> = [
  [
    [36, 65, 50],
    [24, 70, 30],
  ], // warm gold → bronze
  [
    [218, 50, 40],
    [240, 45, 25],
  ], // dusk blue → indigo
  [
    [340, 55, 55],
    [320, 60, 35],
  ], // rose → plum
  [
    [180, 35, 45],
    [200, 40, 30],
  ], // muted teal → ocean
  [
    [85, 25, 50],
    [110, 30, 35],
  ], // sage → forest
  [
    [275, 45, 50],
    [255, 55, 30],
  ], // lavender → deep purple
];

const CATEGORY_EMOJI: Partial<Record<VendorType | string, string>> = {
  venue: "🏛️",
  catering: "🍽️",
  photography: "📸",
  videography: "🎬",
  dj: "🎧",
  band: "🎻",
  rabbi: "📿",
  makeup: "💄",
  dress: "👰",
  florist: "💐",
  stationery: "✉️",
  printing: "🖨️",
  designer: "✨",
  transportation: "🚗",
  entertainment: "🎉",
};

function paletteFor(name: string): [string, string] {
  // Sum char codes — stable, fast, no crypto needed.
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  const [a, b] = PALETTES[sum % PALETTES.length];
  return [`hsl(${a[0]}, ${a[1]}%, ${a[2]}%)`, `hsl(${b[0]}, ${b[1]}%, ${b[2]}%)`];
}

export function VendorImagePlaceholder({
  name,
  category,
}: {
  name: string;
  /** A string from VendorType (catering, photography, ...) or any
   *  string id. Unknown values fall back to no emoji. */
  category?: string;
}) {
  const trimmed = name.trim() || "Momentum";
  const initial = trimmed.charAt(0).toUpperCase();
  const [from, to] = paletteFor(trimmed);
  const emoji = category ? CATEGORY_EMOJI[category] ?? "" : "";

  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
      aria-hidden
    >
      {/* R96 — soft "photo-like" blobs. Two blurred radial highlights
          (offset top-right + bottom-left) give the tile depth and
          the suggestion of a focal point, so the placeholder reads
          as a styled abstract photo rather than a flat color swatch.
          Sized in % so the same composition works across all
          breakpoints. */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-20%",
          right: "-15%",
          width: "70%",
          height: "70%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.28), transparent 60%)",
          filter: "blur(28px)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "-25%",
          left: "-20%",
          width: "75%",
          height: "75%",
          background:
            "radial-gradient(circle, rgba(0,0,0,0.32), transparent 60%)",
          filter: "blur(36px)",
        }}
      />

      {/* Decorative dot pattern — same scale across all tiles so they
          look related, not random. Reduced opacity since the blobs
          now carry most of the visual depth. */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 50%, white 1px, transparent 1px), radial-gradient(circle at 70% 80%, white 1px, transparent 1px)",
          backgroundSize: "26px 26px, 32px 32px",
        }}
      />

      {/* Subtle vignette so the monogram pops + bottom-edge gradient
          for legibility of the title bar below the image. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.38) 100%)",
        }}
      />

      {/* R96 — monogram in a softer "engraved on plaster" treatment
          (subtle inner shadow + light/dark stack) so it reads as
          intentional typographic art, not a stamp on a placeholder. */}
      <div
        className="relative font-extrabold flex flex-col items-center"
        style={{
          color: "rgba(255,255,255,0.96)",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "clamp(4rem, 8vw, 6rem)",
          textShadow:
            "0 1px 0 rgba(255,255,255,0.18), 0 4px 18px rgba(0,0,0,0.45), 0 2px 4px rgba(0,0,0,0.35)",
          lineHeight: 1,
        }}
      >
        <span>{initial}</span>
        {/* A delicate hairline under the monogram, like an
            engraver's mark. Adds craft + depth without clutter. */}
        <span
          aria-hidden
          className="mt-3 block"
          style={{
            width: 28,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
          }}
        />
      </div>

      {/* Category emoji — corner accent. Soft + small so it never
          competes with the monogram. */}
      {emoji && (
        <div
          className="absolute bottom-3 end-3 text-2xl select-none"
          style={{ opacity: 0.55, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
        >
          {emoji}
        </div>
      )}
    </div>
  );
}
