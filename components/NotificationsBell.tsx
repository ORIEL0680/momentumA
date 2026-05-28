"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Info,
  Trash2,
  Inbox as InboxIcon,
  Star as StarIcon,
  // R90 — MessageCircle no longer needed (chat KIND_UI removed).
  TrendingUp,
} from "lucide-react";
import {
  useNotifications,
  addNotification,
  markRead,
  markAllRead,
  clearAll,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";
import { subscribeRsvpUpdates, type RsvpUpdate } from "@/lib/rsvpSync";
import { useAppState } from "@/lib/store";
// R146 — vendor-side realtime subscriber (new leads / reviews /
// chats) that pushes into the same notifications inbox the host
// uses. Mounted via a hook below; opts out for non-vendors.
import { useVendorNotificationsSubscription } from "@/lib/useVendorNotifications";
import { useVendorContext } from "@/lib/useVendorContext";
import { getSupabase } from "@/lib/supabase";

/**
 * R111 — premium notifications bell + dropdown panel.
 *
 * Sits in the Header. Click → drops a glass-strong card with the
 * recent inbox. Unread items glow with a small gold dot; the bell
 * itself gets a tiny gold count badge when there's anything new.
 *
 * Design intent: feels closer to a luxury product status feed than a
 * generic web notifications widget — soft gold borders, no harsh
 * separators, gentle hover lifts. Empty state speaks Hebrew copy
 * (not "no items"). Mobile sheet drops below the header instead of
 * crashing into the right edge.
 */
export function NotificationsBell() {
  const { items, unreadCount, mounted } = useNotifications();
  const { state } = useAppState();
  const { isVendor, vendorLanding } = useVendorContext();
  // R146 — current auth user id (for the chat-messages subscription).
  // We don't import useUser here because it pulls in the cloud-sync
  // localStorage layer; supabase.auth.getUser() directly is cheaper.
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    // Also re-read on auth state changes (sign-in / sign-out).
    const sub = supabase.auth.onAuthStateChange((_evt, sess) => {
      if (!cancelled) setUserId(sess?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, []);
  // R146 — vendor-side realtime subscriber. No-ops for hosts (both
  // args become null when isVendor is false). For vendors, opens
  // three Supabase channels (leads / reviews / chats) and pushes
  // any fresh INSERT into the shared notifications inbox.
  useVendorNotificationsSubscription({
    vendorSlug: isVendor ? vendorLanding?.slug ?? null : null,
    vendorLandingId: isVendor ? vendorLanding?.id ?? null : null,
    userId: isVendor ? userId : null,
  });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // R111 — bridge rsvpSync → notifications store. The bell mounts in
  // the Header so this fires on every page; subscribeRsvpUpdates is
  // refcounted, so multiple subscribers (e.g. /guests' page-level
  // subscriber too) share the same Supabase channel + polling timer.
  //
  // We skip "self" (host clicked it themselves — no surprise) and
  // "initial-fetch" (historical replay on dashboard mount — would
  // dump 200 fake "new" notifications on first load). Both "supabase"
  // (live realtime) and "broadcast" (cross-tab) are genuine events
  // worth surfacing.
  //
  // Guest name resolution: we look up the guest in the local store
  // via a ref so the effect can mount once with `[]` deps. The bell
  // is the only consumer that needs this; rsvpSync stays UI-agnostic.
  const guestsRef = useRef(state.guests);
  useEffect(() => {
    guestsRef.current = state.guests;
  }, [state.guests]);
  useEffect(() => {
    const off = subscribeRsvpUpdates((u: RsvpUpdate) => {
      if (u.source === "self" || u.source === "initial-fetch") return;
      const guest = guestsRef.current.find((g) => g.id === u.guestId);
      const name = guest?.name ?? "אורח";
      const kindMap = {
        confirmed: "rsvp_confirmed",
        declined: "rsvp_declined",
        maybe: "rsvp_maybe",
      } as const;
      const kind = kindMap[u.status as keyof typeof kindMap];
      if (!kind) return; // pending/invited shouldn't surface as notifs
      const title =
        u.status === "confirmed"
          ? `${name} אישר/ה הגעה`
          : u.status === "declined"
            ? `${name} לא יוכל/תוכל להגיע`
            : `${name} עדיין לא בטוח/ה`;
      const body =
        u.status === "confirmed" && u.attendingCount > 1
          ? `+${u.attendingCount - 1} ${
              u.attendingCount - 1 === 1 ? "אורח נוסף" : "אורחים נוספים"
            }`
          : undefined;
      // Use guest-id + status as the dedup id — re-RSVPing the same
      // way doesn't spam; switching from confirmed→declined creates a
      // new entry (different status segment).
      addNotification({
        id: `rsvp:${u.guestId}:${u.status}:${u.respondedAt}`,
        kind,
        title,
        body,
        createdAt: u.respondedAt,
        meta: {
          guestId: u.guestId,
          eventId: u.eventId,
          attendingCount: u.attendingCount,
        },
      });
    });
    return off;
  }, []);

  // Close on outside-click + Esc, same convention as AvatarMenu.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Bell shake when a new notification lands — drives the user's eye
  // there. Triggered by the unread count going UP (not down via
  // markRead). Pure refs, no React state churn.
  const lastUnreadRef = useRef(unreadCount);
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (unreadCount > lastUnreadRef.current) {
      setShaking(true);
      const t = window.setTimeout(() => setShaking(false), 700);
      lastUnreadRef.current = unreadCount;
      return () => window.clearTimeout(t);
    }
    lastUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const displayBadge = mounted && unreadCount > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unreadCount > 0
            ? `התראות (${unreadCount} חדשות)`
            : "התראות"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative w-9 h-9 rounded-full inline-flex items-center justify-center transition hover:bg-white/5"
        style={{
          color: displayBadge ? "var(--accent)" : "var(--foreground-soft)",
          animation: shaking ? "r111-bell-shake 700ms ease-in-out" : undefined,
        }}
      >
        <Bell size={18} aria-hidden />
        {displayBadge && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold ltr-num"
            style={{
              background:
                "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
              color: "var(--gold-button-text, #1a1310)",
              boxShadow: "0 2px 6px -1px var(--accent-glow)",
              border: "2px solid var(--background)",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="תיבת התראות"
          className="absolute end-0 top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] max-h-[80vh] z-[60] rounded-3xl overflow-hidden scale-in"
          style={{
            background:
              "linear-gradient(170deg, var(--surface) 0%, var(--background) 100%)",
            border: "1px solid var(--border-gold)",
            boxShadow: "0 24px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px var(--border-gold)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center justify-between gap-3"
            style={{
              borderBottom: "1px solid var(--border)",
              background:
                "linear-gradient(180deg, rgba(212,176,104,0.06), transparent)",
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-xs uppercase tracking-widest font-bold"
                style={{ color: "var(--accent)" }}
              >
                התראות
              </span>
              {unreadCount > 0 && (
                <span
                  className="ltr-num text-[10px] font-bold rounded-full px-2 py-0.5"
                  style={{
                    background: "rgba(212,176,104,0.15)",
                    color: "var(--accent)",
                    border: "1px solid var(--border-gold)",
                  }}
                >
                  {unreadCount} חדש{unreadCount > 1 ? "ות" : "ה"}
                </span>
              )}
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="text-xs underline hover:no-underline transition"
                style={{ color: "var(--foreground-muted)" }}
                title="סמן הכל כנקרא"
              >
                סמן הכל כנקרא
              </button>
            )}
          </div>

          {/* List */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: "calc(80vh - 130px)" }}
          >
            {items.length === 0 ? (
              <EmptyState isVendor={isVendor} />
            ) : (
              <ul className="py-2">
                {items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                      // R146 — if the notification carries an explicit
                      // href (e.g., a vendor lead linking to
                      // /vendors/dashboard/leads), navigate to it. Hosts
                      // notifications usually don't set href; clicking
                      // them just marks-as-read.
                      const href = n.meta?.href;
                      if (href) {
                        // Use location.assign so React Router / Next
                        // Link interception doesn't get in the way of
                        // the popover close animation.
                        window.location.assign(href);
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Footer — R146: vendor-aware. Hosts get "צפה ברשימת
              האורחים", vendors get "פתח את הלידים". The clearAll
              action stays the same on both sides. */}
          {items.length > 0 && (
            <div
              className="px-4 py-3 flex items-center justify-between gap-2"
              style={{
                borderTop: "1px solid var(--border)",
                background: "var(--surface-2)",
              }}
            >
              <Link
                href={isVendor ? "/vendors/dashboard/leads" : "/guests"}
                onClick={() => setOpen(false)}
                className="text-xs font-semibold inline-flex items-center gap-1"
                style={{ color: "var(--accent)" }}
              >
                {isVendor ? "פתח את הלידים →" : "צפה ברשימת האורחים →"}
              </Link>
              <button
                type="button"
                onClick={() => clearAll()}
                className="text-xs inline-flex items-center gap-1 transition hover:opacity-80"
                style={{ color: "var(--foreground-muted)" }}
                title="נקה את כל ההתראות"
              >
                <Trash2 size={11} />
                נקה הכל
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes r111-bell-shake {
          0%,
          100% {
            transform: rotate(0);
          }
          15% {
            transform: rotate(-12deg);
          }
          30% {
            transform: rotate(10deg);
          }
          45% {
            transform: rotate(-8deg);
          }
          60% {
            transform: rotate(6deg);
          }
          75% {
            transform: rotate(-4deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          button[style*="r111-bell-shake"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────── Single row ───────────────────────

function NotificationRow({
  n,
  onClick,
}: {
  n: AppNotification;
  onClick: () => void;
}) {
  const unread = !n.readAt;
  const kindUI = KIND_UI[n.kind];

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full px-4 py-3 flex items-start gap-3 text-start transition relative"
        style={{
          background: unread
            ? "color-mix(in srgb, var(--gold-100) 6%, transparent)"
            : "transparent",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = unread
            ? "color-mix(in srgb, var(--gold-100) 10%, transparent)"
            : "rgba(255,255,255,0.03)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = unread
            ? "color-mix(in srgb, var(--gold-100) 6%, transparent)"
            : "transparent")
        }
      >
        {/* Unread dot — gold */}
        {unread && (
          <span
            aria-hidden
            className="absolute start-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
            style={{
              background: "var(--accent)",
              boxShadow: "0 0 8px var(--accent-glow)",
            }}
          />
        )}

        {/* Icon chip */}
        <div
          className="w-10 h-10 rounded-2xl inline-flex items-center justify-center shrink-0"
          style={{
            background: kindUI.bg,
            border: `1px solid ${kindUI.border}`,
            color: kindUI.color,
          }}
        >
          {kindUI.icon}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-semibold leading-snug truncate"
            style={{
              color: unread ? "var(--foreground)" : "var(--foreground-soft)",
            }}
          >
            {n.title}
          </div>
          {n.body && (
            <div
              className="text-xs mt-0.5 leading-relaxed truncate"
              style={{ color: "var(--foreground-muted)" }}
            >
              {n.body}
            </div>
          )}
          <div
            className="text-[11px] mt-1 ltr-num"
            style={{ color: "var(--foreground-muted)" }}
          >
            {relativeTime(n.createdAt)}
          </div>
        </div>
      </button>
    </li>
  );
}

// ─────────────────── Empty state ───────────────────────

function EmptyState({ isVendor }: { isVendor: boolean }) {
  return (
    <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
      <div
        className="w-14 h-14 rounded-2xl inline-flex items-center justify-center"
        style={{
          background: "color-mix(in srgb, var(--gold-100) 8%, transparent)",
          border: "1px solid var(--border-gold)",
          color: "var(--accent)",
        }}
      >
        <Bell size={22} aria-hidden />
      </div>
      <div className="text-sm font-semibold">אין התראות חדשות</div>
      {/* R146 — copy switches per role. Hosts care about RSVPs;
          vendors care about leads / reviews / chats. */}
      <div
        className="text-xs leading-relaxed max-w-[260px]"
        style={{ color: "var(--foreground-muted)" }}
      >
        {isVendor
          ? "כל ליד חדש, ביקורת או הודעה מזוג יופיעו כאן בזמן אמת."
          : "כל אישור הגעה, סירוב או עדכון מאורח יופיע כאן בזמן אמת."}
      </div>
    </div>
  );
}

// ─────────────────── Kind → visual mapping ───────────

const KIND_UI: Record<
  NotificationKind,
  {
    icon: React.ReactNode;
    color: string;
    bg: string;
    border: string;
  }
> = {
  rsvp_confirmed: {
    icon: <CheckCircle2 size={18} />,
    color: "rgb(110,231,183)",
    bg: "rgba(52,211,153,0.10)",
    border: "rgba(52,211,153,0.30)",
  },
  rsvp_declined: {
    icon: <XCircle size={18} />,
    color: "rgb(252,165,165)",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.30)",
  },
  rsvp_maybe: {
    icon: <HelpCircle size={18} />,
    color: "rgb(252,211,77)",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.30)",
  },
  // R146 — vendor-side notification visuals. Same gold language as
  // the rest of the vendor area; each kind gets a distinct icon so a
  // vendor can scan the list and instantly know "new lead vs. new
  // review vs. new chat".
  vendor_new_lead: {
    icon: <InboxIcon size={18} />,
    color: "var(--accent)",
    bg: "color-mix(in srgb, var(--accent) 12%, transparent)",
    border: "var(--border-gold)",
  },
  vendor_new_review: {
    icon: <StarIcon size={18} />,
    color: "rgb(252,211,77)",
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.30)",
  },
  // R90 — vendor_chat_message KIND_UI removed (in-app chat retired).
  vendor_milestone: {
    icon: <TrendingUp size={18} />,
    color: "var(--accent)",
    bg: "rgba(212,176,104,0.10)",
    border: "var(--border-gold)",
  },
  // R147 — soft signal that a couple interacted with the public
  // landing (WhatsApp tap, save, etc.). Same visual chip as a
  // milestone, slightly different icon so vendors can tell them
  // apart at a glance.
  vendor_page_action: {
    icon: <TrendingUp size={18} />,
    color: "rgb(167,139,250)",
    bg: "rgba(167,139,250,0.10)",
    border: "rgba(167,139,250,0.30)",
  },
  system: {
    icon: <Info size={18} />,
    color: "var(--accent)",
    bg: "rgba(212,176,104,0.10)",
    border: "var(--border-gold)",
  },
};

// ─────────────────── Hebrew relative time ───────────

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "ממש עכשיו";
  const min = Math.floor(sec / 60);
  if (min < 60) return `לפני ${min} ${min === 1 ? "דקה" : "דקות"}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `לפני ${hr} ${hr === 1 ? "שעה" : "שעות"}`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `לפני ${day} ${day === 1 ? "יום" : "ימים"}`;
  // Anything older — show a real date.
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

