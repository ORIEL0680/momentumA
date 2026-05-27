"use client";

import { useEffect } from "react";
import { getSupabase } from "./supabase";
import { addNotification } from "./notifications";

/**
 * R146 — Vendor-side realtime notifications subscriber.
 *
 * Bridges Supabase realtime channels for the vendor's leads, reviews,
 * and chat messages into the shared notifications inbox
 * (NotificationsBell). The bell is rendered by the global Header on
 * every page, so a vendor gets a gold-badged ping the moment a couple
 * opens a lead, posts a review, or sends a chat — no matter which
 * page they're on.
 *
 * Design notes:
 *   • One subscription per browser tab (the hook bails fast for
 *     hosts via the args === null short-circuit, so mounting it in
 *     the global bell costs nothing for non-vendors).
 *   • Soft-fails: if any channel can't subscribe we log + continue.
 *     Only the live bell goes quiet until the next page refresh; the
 *     dashboard still works.
 *   • Freshness gate is enforced inside addNotification — historical
 *     replays (channel resubscribe after sleep) are dropped silently
 *     so the bell doesn't fake "10 new leads from 6 months ago".
 *
 * Public API:
 *   useVendorNotificationsSubscription({
 *     vendorSlug, userId
 *   })
 *
 * Pass null/empty args to opt out (e.g., when the caller isn't a
 * vendor or the context hasn't resolved yet). The hook will
 * subscribe once the args become defined.
 */

interface Args {
  /** vendor_leads.vendor_id + vendor_reviews.vendor_id (the landing slug). */
  vendorSlug: string | null;
  /** vendor_landings.id (UUID) — used by vendor_page_actions.vendor_id.
   *  Distinct from `vendorSlug` because the page-actions table stores
   *  the landing UUID, not the slug. */
  vendorLandingId: string | null;
  /** Auth user id — used by chat_messages.recipient_id when a couple
   *  sends a chat to the vendor. */
  userId: string | null;
}

export function useVendorNotificationsSubscription({
  vendorSlug,
  vendorLandingId,
  userId,
}: Args): void {
  useEffect(() => {
    // Need at least one identifier to subscribe.
    if (!vendorSlug && !userId && !vendorLandingId) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const channels: Array<ReturnType<typeof supabase.channel>> = [];

    // ─── Leads ───────────────────────────────────────────────
    if (vendorSlug) {
      const leadsCh = supabase
        .channel(`vendor_notif_leads_${vendorSlug}`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          {
            event: "INSERT",
            schema: "public",
            table: "vendor_leads",
            filter: `vendor_id=eq.${vendorSlug}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const row = payload.new as {
              id?: string;
              couple_name?: string | null;
              message?: string | null;
              created_at?: string;
            };
            const coupleName = row.couple_name?.trim() || "זוג חדש";
            const message = row.message?.trim();
            addNotification({
              id: `vendor_lead:${row.id ?? crypto.randomUUID()}`,
              kind: "vendor_new_lead",
              title: `ליד חדש מ-${coupleName}`,
              body: message
                ? message.length > 80
                  ? `${message.slice(0, 80)}…`
                  : message
                : "פתח את הדשבורד כדי לראות את הפרטים",
              createdAt: row.created_at ?? new Date().toISOString(),
              meta: {
                leadId: row.id,
                href: "/vendors/dashboard/leads",
              },
            });
          },
        )
        .subscribe();
      channels.push(leadsCh);
    }

    // ─── Reviews ────────────────────────────────────────────
    if (vendorSlug) {
      const reviewsCh = supabase
        .channel(`vendor_notif_reviews_${vendorSlug}`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          {
            event: "INSERT",
            schema: "public",
            table: "vendor_reviews",
            filter: `vendor_id=eq.${vendorSlug}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const row = payload.new as {
              id?: string;
              overall_rating?: number;
              title?: string | null;
              created_at?: string;
            };
            const rating = row.overall_rating ?? 0;
            const stars = "★".repeat(
              Math.max(0, Math.min(5, Math.round(rating))),
            );
            addNotification({
              id: `vendor_review:${row.id ?? crypto.randomUUID()}`,
              kind: "vendor_new_review",
              title: `ביקורת חדשה ${stars}`,
              body: row.title?.trim() || `דירוג ${rating}/5`,
              createdAt: row.created_at ?? new Date().toISOString(),
              meta: {
                reviewId: row.id,
                href: "/vendors/dashboard/analytics#reviews",
              },
            });
          },
        )
        .subscribe();
      channels.push(reviewsCh);
    }

    // ─── Page actions ───────────────────────────────────────
    // R147 — when a couple taps WhatsApp / phone / website / saves
    // the vendor from the catalog or landing, an INSERT lands in
    // `vendor_page_actions` with the landing UUID. We surface this
    // as a soft "someone's checking you out" notification so the
    // vendor can reach out proactively even without a formal lead.
    if (vendorLandingId) {
      const ACTION_LABELS: Record<string, string> = {
        whatsapp: "מישהו לחץ על WhatsApp",
        phone: "מישהו לחץ על הטלפון",
        website: "מישהו לחץ על האתר",
        save: "מישהו שמר אותך לרשימה",
        contact: "מישהו פתח את כפתור יצירת קשר",
      };
      const actionsCh = supabase
        .channel(`vendor_notif_actions_${vendorLandingId}`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          {
            event: "INSERT",
            schema: "public",
            table: "vendor_page_actions",
            filter: `vendor_id=eq.${vendorLandingId}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const row = payload.new as {
              id?: string;
              action_type?: string;
              action_at?: string;
            };
            const actionType = row.action_type ?? "interaction";
            const title = ACTION_LABELS[actionType] ?? `פעולה חדשה (${actionType})`;
            addNotification({
              id: `vendor_action:${row.id ?? crypto.randomUUID()}`,
              kind: "vendor_page_action",
              title,
              body: "פעולה בדף הציבורי שלך — שווה לפנות אליהם",
              createdAt: row.action_at ?? new Date().toISOString(),
              meta: {
                href: "/vendors/dashboard/analytics",
              },
            });
          },
        )
        .subscribe();
      channels.push(actionsCh);
    }

    // ─── Chat messages ──────────────────────────────────────
    // Vendor receives a chat from a couple. The chat_messages table
    // uses recipient_id (= the auth user receiving the message). We
    // subscribe on the user id, not the slug, because chats are
    // user-to-user not user-to-landing.
    if (userId) {
      const chatCh = supabase
        .channel(`vendor_notif_chat_${userId}`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `recipient_id=eq.${userId}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const row = payload.new as {
              id?: string;
              body?: string | null;
              sender_name?: string | null;
              created_at?: string;
            };
            const sender = row.sender_name?.trim() || "מישהו";
            const body = row.body?.trim() ?? "";
            addNotification({
              id: `vendor_chat:${row.id ?? crypto.randomUUID()}`,
              kind: "vendor_chat_message",
              title: `הודעה חדשה מ-${sender}`,
              body: body.length > 80 ? `${body.slice(0, 80)}…` : body,
              createdAt: row.created_at ?? new Date().toISOString(),
              meta: {
                href: "/vendors/dashboard/inbox",
              },
            });
          },
        )
        .subscribe();
      channels.push(chatCh);
    }

    return () => {
      for (const ch of channels) {
        try {
          void supabase.removeChannel(ch);
        } catch {
          /* tear-down should never throw */
        }
      }
    };
  }, [vendorSlug, vendorLandingId, userId]);
}
