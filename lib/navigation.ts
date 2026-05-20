import type { LucideIcon } from "lucide-react";
import { Home, Users, Briefcase, Calendar, Sparkles } from "lucide-react";

/**
 * Navigation sources for the two nav surfaces. They diverge intentionally:
 *
 * - **`NAV_ITEMS`** powers the mobile bottom bar, which is a 5-column grid
 *   with iconography. Adding more items here would shrink each tap target
 *   below comfortable size; removing one would break the grid math.
 *
 * - **`HEADER_NAV`** powers the desktop top bar, where horizontal space is
 *   abundant. R15 restored the original 7-item label-only set so users can
 *   jump straight to הושבה / תקציב / מאזן from any page.
 *
 * Pages reachable on desktop top bar but NOT in mobile bottom bar (seating,
 * budget, balance) are still reachable on mobile via the dashboard's
 * "כלי עזר" grid + direct URL.
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
  // R71 (R60-6) — /checklist removed; calendar replaces it as the
  // bottom-bar planner anchor.
  { href: "/calendar", label: "לוח שנה", icon: Calendar },
  // R25 — surface Momentum Live in the bottom nav so couples discover it
  // without digging. Settings stays reachable via the header user-menu.
  { href: "/event-day", label: "מצב חי", icon: Sparkles },
] as const;

export interface HeaderNavItem {
  href: string;
  label: string;
}

/**
 * R67 (R56) — desktop top-bar restructure.
 *
 * Old: 8 items inline. Felt cramped next to admin/vendor badges + chat
 * bell + event switcher + theme toggle + user menu on the right. New:
 * 3 primary items inline, the rest in an overflow "..." dropdown so
 * the top bar breathes.
 *
 * Mobile hamburger still shows the union (HEADER_NAV + MORE_MENU_NAV)
 * because the drawer has the vertical room.
 */
export const HEADER_NAV: readonly HeaderNavItem[] = [
  { href: "/dashboard", label: "המסע" },
  { href: "/guests", label: "מוזמנים" },
  { href: "/calendar", label: "לוח שנה" },
] as const;

/** Secondary nav — surfaced in the desktop "..." dropdown and inline
 *  in the mobile hamburger. R71 (R60-6): dropped /checklist (folded
 *  into /calendar). */
export const MORE_MENU_NAV: readonly HeaderNavItem[] = [
  { href: "/vendors", label: "ספקים" },
  { href: "/seating", label: "הושבה" },
  { href: "/budget", label: "תקציב" },
  { href: "/balance", label: "מאזן" },
  { href: "/settings", label: "הגדרות" },
] as const;
