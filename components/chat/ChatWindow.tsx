"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { haptic } from "@/lib/haptic";
import { useVendorChat, markChatRead } from "@/lib/useVendorChat";

async function authToken(): Promise<string | null> {
  try {
    const s = getSupabase();
    if (!s) return null;
    const { data } = await s.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * R43 — shared chat surface. Couple bubbles right/gold, vendor
 * left/gray (per spec, by sender_role not by "me"). Realtime via
 * useVendorChat. Smart-reply chips (vendor inbox only) call
 * /api/ai/smart-replies and cache per last-message-id in localStorage
 * so the same thread state never re-asks the AI.
 */
export function ChatWindow({
  leadId,
  myRole,
  enableSmartReplies = false,
}: {
  leadId: string;
  myRole: "couple" | "vendor";
  enableSmartReplies?: boolean;
}) {
  const messages = useVendorChat(leadId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replies, setReplies] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark counterpart messages read whenever the thread changes.
  useEffect(() => {
    if (messages.length) void markChatRead(leadId, myRole);
  }, [leadId, myRole, messages.length]);

  // Keep pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  // Smart replies (vendor only), cached by last message id.
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!enableSmartReplies || !lastId) return;
    const last = messages[messages.length - 1];
    if (!last || last.sender_role === "vendor") {
      // Clear chips when the last message is ours — one-shot, returns
      // immediately after (no cascading render loop).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReplies([]);
      return;
    }
    const cacheKey = `momentum.smartreplies.${lastId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setReplies(JSON.parse(cached));
        return;
      }
    } catch {
      /* ignore */
    }
    let cancelled = false;
    void (async () => {
      const token = await authToken();
      if (!token) return;
      try {
        const res = await fetch("/api/ai/smart-replies", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ leadId }),
        });
        const data = (await res.json()) as { replies?: string[] };
        if (cancelled) return;
        const r = Array.isArray(data.replies) ? data.replies : [];
        setReplies(r);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(r));
        } catch {
          /* ignore */
        }
      } catch {
        /* fail-soft — no chips */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enableSmartReplies, lastId, leadId, messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    haptic.light();
    try {
      const token = await authToken();
      if (!token) {
        setSending(false);
        return;
      }
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leadId, body: text, senderRole: myRole }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: { id: string };
      };
      if (data.ok) {
        setDraft("");
        setReplies([]);
        // Fire-and-forget AI enrichment for the message just sent.
        if (data.message?.id) {
          void fetch("/api/ai/chat-assist", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ messageId: data.message.id }),
          }).catch(() => {});
        }
      }
    } catch {
      /* the realtime feed will reconcile if it actually landed */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div
            className="text-center text-sm py-10"
            style={{ color: "var(--foreground-muted)" }}
          >
            עדיין אין הודעות — שלחו את הראשונה ✨
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_role === myRole;
            const couple = m.sender_role === "couple";
            return (
              <div
                key={m.id}
                className={`flex ${couple ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                  style={{
                    background: couple
                      ? "linear-gradient(135deg, var(--gold-100), var(--gold-500))"
                      : "var(--input-bg)",
                    color: couple
                      ? "var(--gold-button-text)"
                      : "var(--foreground)",
                    border: couple ? "none" : "1px solid var(--border)",
                  }}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {m.body}
                  </div>
                  {mine && (
                    <div
                      className="text-[10px] mt-1 text-end"
                      style={{ opacity: 0.7 }}
                    >
                      {m.is_read ? "✓✓ נקרא" : "✓ נשלח"}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {enableSmartReplies && replies.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {replies.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDraft(r)}
              className="text-xs rounded-full px-3 py-1.5 inline-flex items-center gap-1.5"
              style={{
                background: "rgba(212,176,104,0.10)",
                border: "1px solid var(--border-gold)",
                color: "var(--accent)",
              }}
            >
              <Sparkles size={12} /> {r}
            </button>
          ))}
        </div>
      )}

      <div
        className="p-3 flex items-end gap-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="כתבו הודעה…"
          className="input flex-1 resize-none"
          style={{ maxHeight: 120 }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !draft.trim()}
          aria-label="שלח"
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{
            background:
              "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
            color: "var(--gold-button-text)",
          }}
        >
          {sending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
}
