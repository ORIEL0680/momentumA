"use client";

import { memo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

// Module-scope counter — guarantees uniqueness even when two floaters
// emit in the same millisecond on a host that lacks crypto.randomUUID.
let floaterCounter = 0;
function nextFloaterId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  floaterCounter += 1;
  return `f-${Date.now()}-${floaterCounter}`;
}
import {
  Star,
  ShieldCheck,
  Phone,
  Plus,
  Check,
  Trophy,
  Globe,
} from "lucide-react";
import { actions } from "@/lib/store";
import { vendorImageFor } from "@/lib/images";
import { REGION_LABELS, VENDOR_TYPE_LABELS, type Vendor } from "@/lib/types";
import { VendorImagePlaceholder } from "./VendorImagePlaceholder";
import {
  buildInstagramUrl,
  buildFacebookUrl,
  buildWebsiteUrl,
} from "@/lib/socialHandles";
import { FacebookGlyph, InstagramGlyph } from "./typeIcons";

// R70 (R59) — `has_saved_vendor` localStorage gate. Read via
// useSyncExternalStore so React handles SSR/CSR snapshots and lint
// doesn't trip on setState-in-effect. Listeners pattern matches
// the useSyncExternalStore pattern.
const HAS_SAVED_KEY = "momentum.has_saved_vendor.v1";
const savedListeners = new Set<() => void>();
function notifySavedSameTab(): void {
  for (const l of savedListeners) l();
}
function subscribeHasSaved(cb: () => void): () => void {
  savedListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === HAS_SAVED_KEY) cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    savedListeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}
function getHasSavedSnapshot(): boolean {
  try {
    if (typeof window === "undefined") return true; // SSR: hide pill
    return window.localStorage.getItem(HAS_SAVED_KEY) === "1";
  } catch {
    return false;
  }
}
function getHasSavedServerSnapshot(): boolean {
  return true; // SSR: hide pill (matches first-paint, no mismatch)
}

interface VendorCardProps {
  vendor: Vendor;
  /** Position in the grid — drives image variant + ken-burns trigger. */
  meshIndex: number;
  selected: boolean;
  inCompare: boolean;
  /** Compare bucket is full (3) and this vendor isn't already in it. */
  compareDisabled: boolean;
  /** Open the Quick Look modal for this vendor. */
  onOpenQuickLook: (vendor: Vendor) => void;
}

function VendorCardImpl({
  vendor,
  meshIndex,
  selected,
  inCompare,
  compareDisabled,
  onOpenQuickLook,
}: VendorCardProps) {
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const meshClass = `mesh-${(meshIndex % 6) + 1}`;
  // R147 — the vendor's OWN logo / hero photo is the catalog tile's
  // primary visual when it exists. Pre-R147 we showed a generic stock
  // image from `vendorImageFor()` and tucked the real logo into a
  // small circular avatar at the corner. That made every "מטעמי
  // שרביט" tile look the same as every other catering tile —
  // commodity. Now the vendor's brand IS the tile; stock falls back
  // for vendors who haven't uploaded yet.
  //
  // `usesVendorPhoto` switches object-cover → object-contain so a
  // square logo isn't cropped to landscape; the stock fallback path
  // stays object-cover because those images ARE landscape.
  const usesVendorPhoto = !!vendor.photoUrl;
  const imageUrl = vendor.photoUrl || vendorImageFor(vendor.type, meshIndex);

  // R95 — every approved-vendor card has its own /vendor/<id> landing
  // page (built in R85). Click should open that page directly. The
  // QuickLook modal is preserved as a fallback for static-seed entries
  // (lib/vendors.ts was emptied in R94, but if any future entry has
  // an id NOT starting with "app-", we still pop the modal).
  const hasLandingPage = vendor.id.startsWith("app-");

  // "+1" floaters that bubble up from the trophy/heart on click.
  // Ids must be unique even within the same millisecond — two simultaneous
  // emits used to share `Date.now() + Math.random()` collisions on devices
  // with low-resolution Math.random, which made React render only one of
  // them (same key → discarded sibling).
  const [floaters, setFloaters] = useState<Array<{ id: string; kind: "compare" | "save" }>>([]);
  const emitFloater = (kind: "compare" | "save") => {
    if (reducedMotion) return;
    const id = nextFloaterId();
    setFloaters((prev) => [...prev, { id, kind }]);
    window.setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== id));
    }, 700);
  };

  // R18 §H — first-run "add to my list" affordance. R70 (R59): read
  // through useSyncExternalStore so SSR snapshot (true = hide pill) and
  // CSR snapshot (read localStorage) are coordinated by React itself
  // and no hydration mismatch ever fires. See the useSyncExternalStore pattern for
  // the original pattern this mirrors.
  const hasSavedEver = useSyncExternalStore(
    subscribeHasSaved,
    getHasSavedSnapshot,
    getHasSavedServerSnapshot,
  );

  const markSavedEver = () => {
    if (hasSavedEver) return;
    try {
      window.localStorage.setItem(HAS_SAVED_KEY, "1");
      notifySavedSameTab();
    } catch {
      /* private mode — in-memory only */
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    actions.toggleVendor(vendor.id);
    if (!selected) {
      emitFloater("save");
      markSavedEver();
    }
  };
  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (compareDisabled) return;
    actions.toggleCompareVendor(vendor.id);
    if (!inCompare) emitFloater("compare");
  };
  const openVendor = () => {
    // R95 — primary action: navigate to the dedicated mini landing
    // page. Falls back to QuickLook modal for any legacy / static
    // vendor that doesn't have its own page yet.
    if (hasLandingPage) {
      router.push(`/vendor/${encodeURIComponent(vendor.id)}`);
    } else {
      onOpenQuickLook(vendor);
    }
  };
  const handleCardClick = (e: React.MouseEvent) => {
    // Only navigate if the click isn't on an interactive child.
    const target = e.target as HTMLElement;
    if (target.closest("button, a, [data-no-quicklook]")) return;
    openVendor();
  };
  const handleCardKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openVendor();
    }
  };

  // R84-2 — kenBurns animation no longer attached now that we use
  // either object-contain logos (which shouldn't pan) or the static
  // VendorImagePlaceholder. Variable kept for backward compat with
  // any future stock-image variant; flagged unused via void.
  void (!reducedMotion && meshIndex < 6); // kenBurns budget

  return (
    <motion.div
      layout
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className={`card overflow-hidden flex flex-col card-hover ${selected ? "card-selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`פתח תצוגה מהירה של ${vendor.name}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKey}
    >
      <div className={`aspect-[16/10] relative ${meshClass} overflow-hidden`}>
        {/* R96 — two render branches with `object-cover` everywhere
            for a uniform photo-like look across every tile:
              1. Vendor uploaded something (cover / logo / hero) →
                 fill the 16:10 frame edge-to-edge. Logos that are
                 square get cropped slightly top/bottom — almost
                 always invisible since most logos have transparent
                 backgrounds. Trade-off worth it for grid symmetry.
              2. No upload at all → richer VendorImagePlaceholder
                 (gradient + monogram + soft photo-like blobs).
            The R84 dual blur-backdrop + contained-foreground combo
            was visually correct for logo uploads but made every
            tile look slightly different in weight; switching to a
            single object-cover gives the catalog the consistent
            "every vendor has a photo" feel the user asked for. */}
        {usesVendorPhoto ? (
          <Image
            src={imageUrl}
            alt={vendor.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            quality={70}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out hover:scale-105"
          />
        ) : (
          <VendorImagePlaceholder
            name={vendor.name}
            category={vendor.type}
          />
        )}
        {/* Keep the legacy reference so `imageUrl` doesn't become a
            dead import — used by future template variants that may
            want the stock fallback again. */}
        {false && <span data-stock-url={imageUrl} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

        <div className="absolute top-3 start-3 flex items-center gap-2">
          {vendor.inCatalog && (
            <span className="pill pill-gold">
              <ShieldCheck size={11} /> בקטלוג
            </span>
          )}
        </div>

        <div className="absolute top-3 end-3 flex items-center gap-1.5" data-no-quicklook>
          <motion.button
            type="button"
            onClick={handleCompare}
            disabled={compareDisabled}
            whileTap={reducedMotion ? undefined : { scale: 0.92 }}
            className={`relative w-9 h-9 rounded-full backdrop-blur-md border flex items-center justify-center transition disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-1 focus-visible:ring-offset-black ${
              inCompare
                ? "bg-[--accent] border-[--accent] text-black"
                : "bg-black/40 border-white/15 text-white/85 hover:bg-black/60"
            }`}
            aria-label={inCompare ? `הסר את ${vendor.name} מההשוואה` : `הוסף את ${vendor.name} להשוואה`}
            aria-pressed={inCompare}
            title={compareDisabled ? "מקסימום 3 ספקים בהשוואה" : inCompare ? "הסר מהשוואה" : "הוסף להשוואה"}
          >
            <Trophy size={14} fill={inCompare ? "currentColor" : "none"} />
            {floaters
              .filter((f) => f.kind === "compare")
              .map((f) => (
                <FloatingPlusOne key={f.id} />
              ))}
          </motion.button>
          {/* R7: ex-Heart button. Now a circular Plus/Check badge — same
              footprint so the top-right cluster (compare + save) stays balanced,
              but the icon and aria-label communicate "list", not "favorite".
              The full-text "הוסף לרשימה שלי" pill lives in VendorQuickLook
              where there's room for it. The `heart-pulse` class is reused
              here as a generic gold pulse on add — it's just a CSS class name. */}
          <motion.button
            type="button"
            onClick={handleSave}
            whileTap={reducedMotion ? undefined : { scale: 1.3 }}
            transition={{ type: "spring", stiffness: 600, damping: 14 }}
            className={`relative w-9 h-9 rounded-full backdrop-blur-md border flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-1 focus-visible:ring-offset-black ${
              selected
                ? "bg-[--accent] border-[--accent] text-black"
                : "bg-black/40 border-white/15 text-white/85 hover:bg-black/60"
            } ${selected ? "heart-pulse" : ""}`}
            aria-label={selected ? `הסר את ${vendor.name} מהרשימה שלך` : `הוסף את ${vendor.name} לרשימה שלך`}
            aria-pressed={selected}
            title={selected ? "ברשימה שלך" : "הוסף לרשימה שלי"}
          >
            {selected ? <Check size={16} /> : <Plus size={16} />}
            {floaters
              .filter((f) => f.kind === "save")
              .map((f) => (
                <FloatingPlusOne key={f.id} />
              ))}
          </motion.button>
        </div>

        {/* R37 — no fabricated rating for a brand-new catalog vendor.
            Zero reviews → an honest "new vendor" badge instead of a
            number nobody actually gave. */}
        <div className="absolute bottom-3 start-3 inline-flex items-center gap-1 text-xs bg-black/50 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/10">
          {vendor.reviews > 0 ? (
            <>
              <Star size={11} className="text-[--accent]" fill="currentColor" />
              <span className="font-bold ltr-num">{vendor.rating}</span>
              <span className="text-white/50 ltr-num">({vendor.reviews})</span>
            </>
          ) : (
            // R36+R37 — no ⭐ / fabricated count for a brand-new vendor.
            <span className="font-semibold">✨ חדש בקטלוג</span>
          )}
        </div>

        {/* R147 — VendorAvatar (small gold circle over the bottom-right
            corner) removed. The vendor's logo is now the FULL tile
            image, so a separate avatar was redundant and made the
            tile feel cluttered ("עיגול הקטן שנמצא בפנים איפה
            שהלוגו"). If the vendor never uploaded a logo, the stock
            mesh image is shown alone — same calm composition. */}
      </div>

      {/* R84-1 — fixed card body height so every tile in the grid is
          the same size regardless of name length / description length.
          The grid container above sets `gridAutoRows: 1fr` so every
          row gets the tallest item's height; `min-h` here guarantees
          a sensible floor even on rows with all-short cards. */}
      <div className="p-5 flex flex-col flex-1" style={{ minHeight: 170 }}>
        <h3 className="font-semibold text-lg leading-tight line-clamp-1">{vendor.name}</h3>
        <div className="text-xs text-white/50 mt-1 line-clamp-1">
          {VENDOR_TYPE_LABELS[vendor.type]} · {REGION_LABELS[vendor.region]}
        </div>

        <p className="text-sm text-white/65 mt-3 leading-relaxed line-clamp-2">{vendor.description}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {vendor.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[11px] rounded-full border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-white/55"
            >
              {tag}
            </span>
          ))}
        </div>

        <SocialRow vendor={vendor} />

        {/* R67 (R84) — price block removed per "no prices anywhere"
            policy. The Vendor type still carries priceFrom for future
            re-introduction (filter chips, sort order); the catalog UI
            simply no longer surfaces a shekel value. */}
        {/* R90 — in-app chat retired. Couples reach vendors through
            WhatsApp / phone only now (on the public landing page).
            Catalog card only carries the phone tap; the "💬 צ׳אט"
            button + onChat handler were removed. */}
        <div className="mt-auto pt-5 flex items-center justify-end" data-no-quicklook>
          {vendor.phone && (
            <a
              href={`tel:${vendor.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
              aria-label={`התקשר ל${vendor.name}`}
            >
              <Phone size={14} />
            </a>
          )}
        </div>

        {/* R18 §H — prominent in-body "save" pill, shown only until the
            user has saved their first vendor (then the overlay badge is
            enough). Disappears once `selected` too. */}
        {!hasSavedEver && !selected && (
          <button
            type="button"
            onClick={handleSave}
            data-no-quicklook
            className="mt-3 w-full rounded-full py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 transition hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            style={{
              background: "linear-gradient(135deg, rgba(244,222,169,0.18), rgba(168,136,74,0.08))",
              border: "1px solid var(--border-gold)",
              color: "var(--accent)",
            }}
            aria-label={`הוסף את ${vendor.name} לרשימה שלי`}
          >
            <Plus size={15} />
            הוסף לרשימה שלי
          </button>
        )}
      </div>
    </motion.div>
  );
}

function SocialRow({ vendor }: { vendor: Vendor }) {
  // R85 (R67 fix) — all three URLs through the central normalizer
  // (lib/socialHandles). Replaces the old naive prepend that broke
  // when a vendor pasted a full URL into the handle field.
  const igUrl = buildInstagramUrl(vendor.instagram) ?? undefined;
  const fbUrl = buildFacebookUrl(vendor.facebook) ?? undefined;
  const webUrl = buildWebsiteUrl(vendor.website) ?? undefined;
  if (!igUrl && !fbUrl && !webUrl) return null;
  return (
    <div className="mt-3 flex items-center gap-1.5" data-no-quicklook onClick={(e) => e.stopPropagation()}>
      {igUrl && (
        <a
          href={igUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-[var(--secondary-button-bg-hover)] hover:border-[var(--border-gold)] flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
          aria-label={`${vendor.name} באינסטגרם`}
          title="Instagram"
        >
          <span className="text-white/70"><InstagramGlyph /></span>
        </a>
      )}
      {fbUrl && (
        <a
          href={fbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-[var(--secondary-button-bg-hover)] hover:border-[var(--border-gold)] flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
          aria-label={`${vendor.name} בפייסבוק`}
          title="Facebook"
        >
          <span className="text-white/70"><FacebookGlyph /></span>
        </a>
      )}
      {webUrl && (
        <a
          href={webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-[var(--secondary-button-bg-hover)] hover:border-[var(--border-gold)] flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
          aria-label={`אתר של ${vendor.name}`}
          title="Website"
        >
          <Globe size={12} className="text-white/70" />
        </a>
      )}
    </div>
  );
}

/** "+1" that floats up + fades. Pure CSS, hosts inside the action button. */
// R147 — VendorAvatar removed. The vendor's logo now fills the full
// catalog tile image; a separate corner avatar duplicated the brand
// and made every tile feel cluttered. See R117 in git history for
// the original component if we ever want a hybrid layout back.

function FloatingPlusOne() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 text-[11px] font-bold flex items-center justify-center"
      style={{
        color: "var(--accent)",
        animation: "float-plus-one 700ms ease-out forwards",
      }}
    >
      +1
    </span>
  );
}

/**
 * Memoize: the parent re-renders on EVERY filter/search keystroke. Cards are
 * the heaviest cell in the grid; a shallow equality check on props skips most
 * of the work. Functions (onChat/onOpenQuickLook) are passed unchanged from
 * the parent (no inline fns) so identity stays stable.
 */
export const VendorCard = memo(VendorCardImpl);

export type { VendorCardProps };
