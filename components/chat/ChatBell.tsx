"use client";

import { MessageCircle } from "lucide-react";
import { useChatUnread } from "@/lib/useChatUnread";

/**
 * R43 F2 — header unread indicator. Self-contained (own hook) so the
 * Header doesn't grow another hook. Renders nothing when there's
 * nothing unread (and fail-soft → 0 when signed out / no Supabase),
 * so it's invisible on public pages. Pure indicator — no link, since
 * couples have no central inbox route (they chat from the vendor page;
 * vendors act from the dashboard card / inbox).
 */
export function ChatBell() {
  const unread = useChatUnread();
  if (unread <= 0) return null;
  return (
    <span
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-full"
      style={{ background: "var(--secondary-button-bg)" }}
      title={`${unread} הודעות שלא נקראו`}
      aria-label={`${unread} הודעות שלא נקראו`}
    >
      <MessageCircle size={17} className="text-[--accent]" aria-hidden />
      <span
        className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ltr-num"
        style={{
          background:
            "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
          color: "var(--gold-button-text)",
        }}
      >
        {unread > 99 ? "99+" : unread}
      </span>
    </span>
  );
}
