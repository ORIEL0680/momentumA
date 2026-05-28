import type { LucideIcon } from "lucide-react";
import {
  Home,
  Users,
  Briefcase,
  LayoutGrid,
  Sparkles,
} from "lucide-react";

/**
 * Navigation sources for the two nav surfaces. They diverge intentionally:
 *
 * - **`NAV_ITEMS`** powers the mobile bottom bar — a 5-column grid with
 *   iconography. Stays at 5 items so each tap target stays comfortable.
 *
 * - **`HEADER_NAV`** powers the desktop top-bar pill row (R72/R61). Six
 *   primary destinations always visible; secondary/conditional items
 *   live in `MORE_MENU_NAV` (the "..." dropdown) and the avatar menu.
 *
 * R72 (R61) — pill row restructured: 6 destinations on a single visible
 * row (was 3 with overflow). Routes match what actually exists in the
 * app (the spec's /dashboard/* nesting doesn't exist; flat routes do).
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "המסע", icon: Home },
  { href: "/guests", label: "אורחים", icon: Users },
  { href: "/vendors", label: "ספקים", icon: Briefcase },
  // R74 — /calendar removed; the seating tool fills the planner slot
  // in the mobile bottom bar.
  { href: "/seating", label: "הושבה", icon: LayoutGrid },
  { href: "/event-day", label: "מצב חי", icon: Sparkles },
] as const;

export interface HeaderNavItem {
  href: string;
  label: string;
}

/**
 * R72 (R61) — desktop top-bar pill row. Six destinations, always
 * visible on tier 2 of the header. Order is conversion / first-use
 * tuned: highest-priority "המסע" first, then the four planning
 * surfaces, then "מאזן" as the financial summary tail.
 */
export const HEADER_NAV: readonly HeaderNavItem[] = [
  { href: "/dashboard", label: "המסע" },
  { href: "/guests", label: "אורחים" },
  { href: "/budget", label: "תקציב" },
  { href: "/vendors", label: "ספקים" },
  // R90 — "צ׳אטים" pill removed. In-app chat with vendors is
  // retired; couples reach vendors over WhatsApp / phone only.
  { href: "/seating", label: "הושבה" },
  { href: "/balance", label: "מאזן" },
] as const;

/**
 * R114 — vendor-side desktop top-bar pill row. Replaces HEADER_NAV
 * entirely for users with a vendor_landings row. Hosts' "guests /
 * budget / seating" surfaces don't apply to vendors, and showing them
 * confuses brand-new vendors who can't tell whether they're in the
 * right app. This nav keeps them inside the vendor area.
 *
 * R143 — "הדף שלי" originally pointed to `/vendors/my`, but that
 * route is the HOST's "saved-vendor list" page (where a wedding host
 * tracks the vendors they're talking to). A vendor clicking it saw
 * an empty saved-vendor list with a "go to catalog" CTA — total
 * dead-end. Replaced with "עריכת הדף" pointing to the actual landing
 * editor (`/dashboard/vendor-studio`). The vendor's public-profile
 * preview button lives on the dashboard hero, so a separate nav
 * entry isn't needed.
 */
export const VENDOR_HEADER_NAV: readonly HeaderNavItem[] = [
  { href: "/vendors/dashboard", label: "דשבורד" },
  { href: "/vendors/dashboard/leads", label: "לידים" },
  // R90 — "הודעות" pill removed. The /vendors/dashboard/inbox
  // page was deleted. Vendors talk to couples on WhatsApp directly
  // (couples open WhatsApp from the public landing page CTA bar).
  { href: "/vendors/dashboard/analytics", label: "אנליטיקס" },
  { href: "/dashboard/vendor-studio", label: "עריכת הדף" },
  { href: "/vendors", label: "הקטלוג" },
] as const;

export interface MoreMenuItem {
  href: string;
  label: string;
  /**
   * Lucide icon name (string, so consumers can pick how to import).
   * Resolved via a small lookup table in the Header to avoid pulling
   * every lucide icon into the navigation module bundle.
   */
  icon: string;
}

/**
 * Secondary "..." overflow on tier 2. These are conditional or
 * lower-frequency destinations; the Header decides visibility based on
 * state (event proximity, vendor flag, admin flag, unread inbox).
 */
export const MORE_MENU_NAV: readonly MoreMenuItem[] = [
  { href: "/event-day", label: "מצב חי", icon: "Activity" },
  { href: "/vendors/dashboard", label: "דשבורד ספק", icon: "Briefcase" },
  { href: "/admin/dashboard", label: "Admin", icon: "Shield" },
  { href: "/inbox", label: "הודעות", icon: "Mail" },
  { href: "/settings", label: "הגדרות", icon: "Settings" },
] as const;
