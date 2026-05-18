"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * R43 — total unread chat messages addressed to the current user
 * across all their leads (works for couple AND vendor — RLS already
 * scopes vendor_chat_messages to leads the user is a party to; we just
 * exclude messages the user authored). Fail-soft: returns 0 when
 * Supabase / session is unavailable. Realtime-refreshed; channel
 * cleaned up on unmount.
 */
export function useChatUnread(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;

    const recount = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { count: c } = await supabase
          .from("vendor_chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("is_read", false)
          .neq("sender_user_id", user.id);
        if (!cancelled) setCount(c ?? 0);
      } catch {
        /* fail-soft → leave previous count */
      }
    };

    void recount();
    const channel = supabase
      .channel(`chat-unread-${crypto.randomUUID()}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "vendor_chat_messages" } as never,
        () => {
          void recount();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
