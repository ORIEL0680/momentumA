"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

/**
 * R87 — unified modal/sheet primitive.
 *
 * Replaces a sprawl of one-off `fixed inset-0` + `bottom-0 inset-x-0`
 * dialogs spread across `components/*` and `app/*`. Pre-R87 every
 * dialog re-implemented:
 *   - backdrop + ESC close
 *   - body scroll lock
 *   - safe-area-inset-bottom padding
 *   - dvh sizing for iOS keyboard
 *   - focus management
 * …each with subtly different bugs. The user reported:
 *   • chat modal in catalog opened "too low", input got cut off
 *     under the iOS keyboard
 *   • appointment sheet rendered as bottom-sheet on desktop too
 *     (felt awkward on a wide screen)
 *
 * `<Sheet>` is the single source of truth.
 *
 * Visual variants:
 *   • `position="center"` → modal centered both axes (default).
 *     Desktop: 560px wide, mobile: viewport - 32px. Animates with a
 *     scale-in/scale-out spring.
 *   • `position="bottom"` → bottom-sheet on mobile, but PIVOTS to
 *     center on `md+` (desktop bottom-sheets are anti-pattern).
 *     Animates with a translateY slide from the bottom.
 *
 * iOS-safe specifics:
 *   • `max-height: 85dvh` — DYNAMIC viewport height, contracts when
 *     the on-screen keyboard rises. Static `vh` would leave the sheet
 *     tall and the input hidden behind the keyboard.
 *   • `paddingBottom: env(safe-area-inset-bottom)` so the sticky
 *     footer (e.g., chat send bar) doesn't sit on top of the home
 *     indicator.
 *   • All sticky inputs inside the sheet honor `font-size: 16px`
 *     globally (set in globals.css `input:focus, textarea:focus`)
 *     so Safari doesn't auto-zoom on focus.
 *
 * Focus trap:
 *   • On open, focuses the first interactive element inside the
 *     sheet body (input/textarea/button/[tabindex≥0]).
 *   • TAB / SHIFT+TAB are intercepted and cycle within the sheet.
 *
 * Reduced motion:
 *   • When `prefers-reduced-motion: reduce` is set, both variants
 *     fade in/out (no slide, no scale) so vestibular-sensitive
 *     users aren't pushed.
 */

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Optional title rendered as `<h2>` in a sticky header with the
   *  close button on the opposite side. Omit for headerless sheets
   *  (e.g., when the caller renders its own custom title). */
  title?: ReactNode;
  children: ReactNode;
  /** "center" (default) — modal centered both axes.
   *  "bottom" — bottom-sheet on mobile, centered on `md+`. */
  position?: "center" | "bottom";
  /** Hard cap on the sheet's height. Default `85dvh` — dynamic
   *  viewport height so on-screen keyboards don't push the content
   *  off-screen. Override to e.g. `auto` for short confirms. */
  maxHeight?: string;
  /** Desktop width cap. Mobile is always `100vw - 32px` for
   *  `center`, full-width for `bottom`. */
  maxWidth?: string;
  /** Extra className on the sheet's inner card. Use sparingly — the
   *  defaults already handle background / border / radius. */
  className?: string;
  /** Optional descriptive label for assistive tech when no visible
   *  title is rendered. */
  ariaLabel?: string;
}

const HEADER_ID = "r87-sheet-title";

export function Sheet({
  open,
  onClose,
  title,
  children,
  position = "center",
  maxHeight = "85dvh",
  maxWidth = "560px",
  className,
  ariaLabel,
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // ESC closes — bound only while the sheet is open so other sheets
  // don't trip over each other's listeners.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll while open. Restore the previous overflow on
  // close so stacked modals don't unlock each other prematurely.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Initial focus into the sheet on open. We use a queueMicrotask so
  // the focus call fires AFTER framer-motion's enter animation
  // mounts the node — otherwise we'd focus a stale ref.
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      const root = sheetRef.current;
      if (!root) return;
      const target = root.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      target?.focus();
    });
  }, [open]);

  // Focus trap — Tab key cycles within the sheet so users can't
  // tab back out into the (hidden) page behind. Standard accessible
  // dialog pattern.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = sheetRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hidden && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Spring config — overshoots slightly on enter for a tactile feel.
  // Bypassed when prefers-reduced-motion fires.
  const enterTransition = reduceMotion
    ? { duration: 0.18 }
    : { type: "spring" as const, damping: 28, stiffness: 320 };

  const initialAnim = reduceMotion
    ? { opacity: 0 }
    : position === "bottom"
      ? { y: "100%", opacity: 0 }
      : { opacity: 0, scale: 0.94 };
  const enterAnim = reduceMotion
    ? { opacity: 1 }
    : position === "bottom"
      ? { y: 0, opacity: 1 }
      : { opacity: 1, scale: 1 };
  const exitAnim = reduceMotion
    ? { opacity: 0 }
    : position === "bottom"
      ? { y: "100%", opacity: 0 }
      : { opacity: 0, scale: 0.96 };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — covers the full viewport, click closes. z-100
              keeps us above the global Header (z-50) + the bottom
              chat launcher (z-40). */}
          <motion.div
            className="fixed inset-0 z-[100]"
            style={{
              background: "rgba(0,0,0,0.62)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />

          {/* Sheet card */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? HEADER_ID : undefined}
            aria-label={!title ? ariaLabel : undefined}
            className={[
              "fixed z-[101] flex flex-col overflow-hidden shadow-2xl",
              position === "bottom"
                ? "inset-x-0 bottom-0 rounded-t-[28px] md:bottom-auto md:inset-x-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
                : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl",
              className ?? "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              background:
                "linear-gradient(170deg, var(--surface-1), var(--background))",
              border: "1px solid var(--border-gold)",
              boxShadow:
                "0 30px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px var(--accent-glow)",
              // Width: bottom variant goes 100% on mobile, capped at
              // maxWidth on md+ (via the responsive Tailwind classes
              // above). Center variant is always min(maxWidth, vw-32).
              width:
                position === "bottom"
                  ? "100%"
                  : `min(${maxWidth}, calc(100vw - 32px))`,
              maxWidth: position === "center" ? maxWidth : undefined,
              maxHeight,
              // Safe-area padding so on iPhone X+ home indicator
              // doesn't sit on top of the sheet's footer.
              paddingBottom:
                position === "bottom" ? "env(safe-area-inset-bottom)" : undefined,
            }}
            initial={initialAnim}
            animate={enterAnim}
            exit={exitAnim}
            transition={enterTransition}
          >
            {/* Optional sticky header — only rendered when a title is
                provided. Sticky so the close X stays accessible even
                inside a long-scrolling body. */}
            {title && (
              <header
                className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <h2
                  id={HEADER_ID}
                  className="text-lg font-bold gradient-gold-shimmer truncate"
                  style={{ fontFamily: "var(--font-display), Georgia, serif" }}
                >
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="סגור"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-[var(--input-bg)]"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--foreground-soft)",
                  }}
                >
                  <X size={18} aria-hidden />
                </button>
              </header>
            )}

            {/* Body — scrollable. `overscroll-contain` stops scroll
                chaining so iOS doesn't bounce the page behind. */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
