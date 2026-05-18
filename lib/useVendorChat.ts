"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

/** A row of vendor_chat_messages (R43). */
export interface ChatMessage {
  id: string;
  lead_id: string;
  sender_role: "couple" | "vendor";
  sender_user_id: string | null;
  body: string;
  ai_summary: string | null;
  ai_tags: string[] | null;
  is_read: boolean;
  created_at: string;
}

/**
 * R43 — realtime chat for one lead. Initial fetch (ascending) + an
 * INSERT subscription scoped to the lead. id-deduped. Strict cleanup
 * (channel removed on unmount / leadId change) — no listener leak.
 * No-ops without Supabase. RLS already restricts rows to the two
 * parties of the lead, so no extra client-side authorization needed.
 */
export function useVendorChat(leadId: string | undefined): ChatMessage[] {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!leadId) {
      // Intentional one-shot reset when the lead clears (not a
      // cascading update — there's a `return` right after).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages([]);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("vendor_chat_messages")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((data ?? []) as ChatMessage[]);
    })();

    const channel = supabase
      .channel(`chat-${leadId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "vendor_chat_messages",
          filter: `lead_id=eq.${leadId}`,
        } as never,
        (payload: { new: ChatMessage }) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id)
              ? prev
              : [...prev, payload.new],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [leadId]);

  return messages;
}

/** Mark every message NOT sent by me as read (best-effort, fail-soft). */
export async function markChatRead(
  leadId: string,
  myRole: "couple" | "vendor",
): Promise<void> {
  try {
    const supabase = getSupabase();
    if (!supabase || !leadId) return;
    await supabase
      .from("vendor_chat_messages")
      .update({ is_read: true })
      .eq("lead_id", leadId)
      .neq("sender_role", myRole)
      .eq("is_read", false);
  } catch {
    /* read receipts are best-effort */
  }
}
