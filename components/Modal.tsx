"use client";

import { type ReactNode } from "react";
import { Sheet } from "./ui/Sheet";

/**
 * R18 §P — shared modal shell.
 *
 * R87 — re-implemented as a thin wrapper around `<Sheet>`. The
 * previous bespoke implementation had:
 *   • static `vh` sizing → broke under the iOS keyboard
 *   • no focus trap
 *   • no safe-area handling
 *   • no spring animations
 * Reusing `<Sheet>` gives every existing caller (UpgradePlanModal,
 * SavedVendorEditModal, DeleteEventModal, ExpressSendModal,
 * BulkSendViaMomentumModal, ReviewForm, etc.) all of those for free
 * without per-file migrations.
 *
 * The API stays the same so no callers need to change:
 *   • `maxWidthClass` — translated to `maxWidth` (Tailwind `max-w-*`
 *     mapped to common pixel values; falls back to `560px`).
 *
 * To progressively switch callers to `<Sheet>` directly (and gain
 * access to `position="bottom"`, custom titles, etc.), do so file by
 * file — there's no urgency since both paths are now backed by the
 * same primitive.
 */

// Tailwind `max-w-*` → pixel width, so old callers passing
// `maxWidthClass="max-w-md"` still get the right desktop width.
const MAX_WIDTH_MAP: Record<string, string> = {
  "max-w-xs": "320px",
  "max-w-sm": "384px",
  "max-w-md": "448px",
  "max-w-lg": "512px",
  "max-w-xl": "576px",
  "max-w-2xl": "672px",
  "max-w-3xl": "768px",
  "max-w-4xl": "896px",
  "max-w-5xl": "1024px",
};

export function Modal({
  onClose,
  title,
  children,
  maxWidthClass = "max-w-md",
  // `labelledBy` was used by the old hand-rolled markup so callers
  // could supply a custom id for their title. With Sheet we just use
  // the title prop directly; this parameter is now accepted but
  // ignored — kept in the signature for backward compat so existing
  // call sites don't have to drop it.
  labelledBy: _labelledBy = "modal-title",
}: {
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidthClass?: string;
  labelledBy?: string;
}) {
  // Reference the deprecated arg to silence the unused-var lint. The
  // ESLint convention here is to prefix the unused param with `_`;
  // the parameter destructuring above already does that.
  void _labelledBy;
  const maxWidth = MAX_WIDTH_MAP[maxWidthClass] ?? "560px";
  return (
    <Sheet
      open
      onClose={onClose}
      title={title ?? undefined}
      position="center"
      maxWidth={maxWidth}
    >
      <div className="p-6">{children}</div>
    </Sheet>
  );
}
