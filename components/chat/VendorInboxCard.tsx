"use client";

import Link from "next/link";
import { Inbox, ArrowLeft } from "lucide-react";
import { useChatUnread } from "@/lib/useChatUnread";

/** R43 D3 — prominent "open inbox" card on the vendor dashboard. */
export function VendorInboxCard() {
  const unread = useChatUnread();
  return (
    <Link
      href="/vendors/dashboard/inbox"
      className="card-gold p-5 flex items-center gap-4 transition hover:translate-y-[-2px]"
      style={{ border: "1px solid var(--border-gold)" }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-[--accent]"
        style={{
          background: "rgba(212,176,104,0.15)",
          border: "1px solid var(--border-gold)",
        }}
      >
        <Inbox size={22} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold">
          {unread > 0 ? (
            <>
              <span className="ltr-num">{unread}</span> הודעות חדשות
            </>
          ) : (
            "תיבת ההודעות שלך"
          )}
        </div>
        <div
          className="text-sm mt-0.5"
          style={{ color: "var(--foreground-soft)" }}
        >
          שיחות עם זוגות שמתעניינים — עם הצעות תשובה חכמות
        </div>
      </div>
      <ArrowLeft
        size={18}
        className="text-[--accent] shrink-0"
        aria-hidden
      />
    </Link>
  );
}
