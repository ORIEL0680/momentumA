"use client";

import { useEffect, useRef, useState } from "react";
import { useAppState, actions } from "@/lib/store";
import type { Vendor } from "@/lib/types";
import { Send, ShieldCheck, Phone, Star } from "lucide-react";
import { Avatar } from "./Avatar";
import { Sheet } from "./ui/Sheet";

/**
 * R87 — VendorChatModal rebuilt on the unified `<Sheet>` primitive.
 *
 * Pre-R87 the modal was a custom `fixed inset-0` block that opened
 * "low" on mobile (bottom-sheet aspect) and the input got obscured
 * by the on-screen keyboard. R87 swaps the chrome to `<Sheet>` with
 * `position="center"` + `maxHeight="85dvh"` so:
 *   • Desktop: centered modal, 560px wide.
 *   • Mobile: still centered (not a bottom-sheet — too cramped for
 *     a real conversation).
 *   • `dvh` sizing contracts when the iOS keyboard rises so the
 *     input stays on screen.
 *   • Sticky composer row at the bottom with `modal-safe-bottom`
 *     class for safe-area padding.
 *
 * The chat itself is still a localStorage-backed mock for the
 * STATIC catalog seed (vendor.id without "app-" prefix). DB-backed
 * vendor chat (real `vendor_chat_messages` rows) flows through
 * `VendorChatLauncher` / `<ChatWindow>` on `/vendor/[slug]` (R148).
 */

const QUICK_REPLIES = [
  "האם פנוי בתאריך שלי?",
  "מה כלול במחיר?",
  "האם אפשר להגיע לפגישה?",
  "יש מבצעים לתקופה?",
];

const VENDOR_RESPONSES = [
  "תודה רבה על פנייתך! נשמח לעזור — אעדכן אותך תוך מספר שעות עם פרטים מלאים.",
  "אנחנו פנויים בתאריך שלך 🎉 מוזמן/ת להגיע לפגישת היכרות בסטודיו שלנו.",
  "שלחתי לך הצעת מחיר מפורטת לאימייל. נדבר אחרי שתבדוק/בדקי?",
  "במחיר שצוטטת כלול הכל — אין הפתעות בסוף. אגב, יש לנו 5% הנחה לזוגות שמזמינים השנה.",
  "אנחנו מוזמנים בכבוד לאירוע שלכם 💛",
];

export function VendorChatModal({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const { state } = useAppState();
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track in-flight mock-reply timeout. Closing the modal mid-reply used to
  // call setTyping(false) on a torn-down component.
  const replyTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (replyTimeoutRef.current !== null) {
        window.clearTimeout(replyTimeoutRef.current);
        replyTimeoutRef.current = null;
      }
    };
  }, []);

  const messages = state.vendorChats.filter((m) => m.vendorId === vendor.id);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, typing]);

  const send = (text: string) => {
    if (!text.trim()) return;
    actions.sendVendorMessage(vendor.id, text, true);
    setInput("");
    setTyping(true);
    if (replyTimeoutRef.current !== null) {
      window.clearTimeout(replyTimeoutRef.current);
    }
    replyTimeoutRef.current = window.setTimeout(() => {
      replyTimeoutRef.current = null;
      const reply = VENDOR_RESPONSES[Math.floor(Math.random() * VENDOR_RESPONSES.length)];
      actions.sendVendorMessage(vendor.id, reply, false);
      setTyping(false);
    }, 1200);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      position="center"
      maxWidth="640px"
      maxHeight="85dvh"
      ariaLabel={`שיחה עם ${vendor.name}`}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Custom header — vendor avatar + rating + phone + close button
            (rendered inline because we want richer than the standard Sheet
            title bar). */}
        <header
          className="px-4 py-3 flex items-center justify-between gap-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar name={vendor.name} id={vendor.id} size={44} className="rounded-2xl" />
            <div className="min-w-0">
              <div className="font-bold flex items-center gap-1.5">
                <span className="truncate">{vendor.name}</span>
                {vendor.inCatalog && <ShieldCheck size={14} className="text-[--accent] shrink-0" />}
              </div>
              <div className="text-xs flex items-center gap-2" style={{ color: "var(--foreground-muted)" }}>
                <span className="flex items-center gap-1">
                  <Star size={11} className="text-[--accent]" />{" "}
                  <span className="ltr-num">{vendor.rating}</span>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> מקוון
                </span>
              </div>
            </div>
          </div>
          <a
            href={`tel:${vendor.phone}`}
            className="w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-[var(--secondary-button-bg)] shrink-0"
            style={{ border: "1px solid var(--border)", color: "var(--foreground-soft)" }}
            aria-label={`התקשר ל${vendor.name}`}
          >
            <Phone size={14} />
          </a>
          {/* Close handled by Sheet — but Sheet's X is only when title
              prop is set. We provided ariaLabel instead (custom header),
              so add a discreet close button here. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-[var(--secondary-button-bg)] shrink-0"
            style={{ border: "1px solid var(--border)", color: "var(--foreground-soft)" }}
          >
            ✕
          </button>
        </header>

        {/* Messages — flex-1 + min-h-0 + overflow-y-auto so the row
            scrolls while the composer stays pinned to the bottom. */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3"
        >
          {messages.length === 0 && (
            <div className="text-center py-8 px-4" style={{ color: "var(--foreground-muted)" }}>
              <div className="text-sm mb-3">התחל שיחה עם {vendor.name}</div>
              <div className="text-xs">בחר תבנית מהירה למטה או כתוב הודעה משלך</div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.fromUser ? "justify-end" : "justify-start"} fade-up`}>
              <div
                className="rounded-2xl px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-line leading-relaxed"
                style={
                  m.fromUser
                    ? {
                        background:
                          "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                        color: "var(--gold-button-text)",
                      }
                    : {
                        background: "var(--input-bg)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }
                }
              >
                {m.text}
                <div className="text-[10px] mt-1.5 opacity-70 ltr-num">
                  {new Date(m.at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex items-center gap-2 px-3 py-2" style={{ color: "var(--foreground-muted)" }}>
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full sparkle" style={{ background: "var(--accent)" }} />
                <span className="w-2 h-2 rounded-full sparkle-2" style={{ background: "var(--accent)" }} />
                <span className="w-2 h-2 rounded-full sparkle-3" style={{ background: "var(--accent)" }} />
              </div>
              <span className="text-xs">{vendor.name} מקליד...</span>
            </div>
          )}
        </div>

        {/* Quick replies (shown only on empty thread) — between messages
            and the composer, also non-sticky. */}
        {messages.length === 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-xs rounded-full px-3 py-1.5 transition hover:bg-[var(--secondary-button-bg)]"
                style={{ border: "1px solid var(--border)", color: "var(--foreground-soft)" }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* R87 — composer: STICKY at the bottom of the sheet body. Even
            when the iOS keyboard rises and shortens the viewport, the
            send row stays visible because the sheet's `maxHeight: 85dvh`
            contracts together with the keyboard. `modal-safe-bottom`
            adds `env(safe-area-inset-bottom)` padding for the home
            indicator on iPhone X+. */}
        <form
          className="shrink-0 px-3 pt-3 pb-3 modal-safe-bottom flex items-center gap-2"
          style={{ borderTop: "1px solid var(--border)", background: "var(--surface-1)" }}
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="הקלד הודעה..."
            className="input flex-1 !py-2.5 text-sm"
            disabled={typing}
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            aria-label="שלח"
            className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 transition hover:scale-105 shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
              color: "var(--gold-button-text)",
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </Sheet>
  );
}
