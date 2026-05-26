"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Inbox as InboxIcon, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useVendorContext } from "@/lib/useVendorContext";
import { ChatWindow } from "@/components/chat/ChatWindow";

interface LeadRow {
  id: string;
  couple_name: string | null;
  status: string;
}
interface MsgRow {
  id: string;
  lead_id: string;
  sender_role: string;
  body: string;
  ai_summary: string | null;
  is_read: boolean;
  created_at: string;
}
interface InboxLead {
  id: string;
  name: string;
  lastText: string;
  lastAt: string | null;
  unread: number;
  urgency: "none" | "ok" | "waiting" | "urgent";
}

const HOUR = 3_600_000;

export default function VendorInboxPage() {
  const { vendorLanding, isLoading } = useVendorContext();
  const slug = vendorLanding?.slug ?? null;
  const [leads, setLeads] = useState<InboxLead[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // R124 — track which slug a load() call belongs to. If the slug
  // changes (or the component unmounts) while a load() is in-flight,
  // we must not setLeads with stale data — otherwise the inbox of
  // vendor A briefly shows vendor B's leads after a slug switch.
  const activeSlugRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !slug) return;
    const callSlug = slug;
    activeSlugRef.current = callSlug;
    try {
      const { data: leadRows } = await supabase
        .from("vendor_leads")
        .select("id, couple_name, status")
        .eq("vendor_id", slug);
      // Bail if a newer load() (or unmount) happened while we awaited.
      if (activeSlugRef.current !== callSlug) return;
      const ls = (leadRows ?? []) as LeadRow[];
      if (ls.length === 0) {
        setLeads([]);
        setLoaded(true);
        return;
      }
      const { data: msgRows } = await supabase
        .from("vendor_chat_messages")
        .select("id, lead_id, sender_role, body, ai_summary, is_read, created_at")
        .in(
          "lead_id",
          ls.map((l) => l.id),
        )
        .order("created_at", { ascending: false });
      if (activeSlugRef.current !== callSlug) return;
      const msgs = (msgRows ?? []) as MsgRow[];

      const byLead = new Map<string, MsgRow[]>();
      for (const m of msgs) {
        const arr = byLead.get(m.lead_id) ?? [];
        arr.push(m);
        byLead.set(m.lead_id, arr);
      }
      const now = Date.now();
      const built: InboxLead[] = ls
        .map((l) => {
          const lm = byLead.get(l.id) ?? [];
          const last = lm[0]; // desc → newest first
          const unread = lm.filter(
            (m) => m.sender_role === "couple" && !m.is_read,
          ).length;
          let urgency: InboxLead["urgency"] = "none";
          if (unread > 0 && last) {
            const ageH = (now - new Date(last.created_at).getTime()) / HOUR;
            urgency = ageH >= 48 ? "urgent" : ageH >= 24 ? "waiting" : "ok";
          }
          return {
            id: l.id,
            name: l.couple_name?.trim() || "זוג",
            lastText: last
              ? last.ai_summary?.trim() || last.body
              : "אין הודעות עדיין",
            lastAt: last?.created_at ?? null,
            unread,
            urgency,
          };
        })
        .sort((a, b) => {
          if (!a.lastAt && !b.lastAt) return 0;
          if (!a.lastAt) return 1;
          if (!b.lastAt) return -1;
          return b.lastAt.localeCompare(a.lastAt);
        });
      setLeads(built);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [slug]);

  useEffect(() => {
    // `load` is async — setState only runs after awaits, not
    // synchronously in this effect. Disable the conservative rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const supabase = getSupabase();
    if (!supabase || !slug) return;
    const channel = supabase
      .channel(`vendor-inbox-${slug}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "vendor_chat_messages",
        } as never,
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      // Clear the in-flight slug guard so any pending load() promises
      // resolving after unmount bail before touching React state.
      activeSlugRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [slug, load]);

  const totalUnread = useMemo(
    () => leads.reduce((s, l) => s + l.unread, 0),
    [leads],
  );

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[--accent]" size={28} />
      </main>
    );
  }
  if (!slug) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5">
        <div className="card p-8 text-center max-w-md">
          <p className="font-semibold">האזור הזה הוא לספקים בלבד</p>
          <Link href="/vendors/dashboard" className="btn-gold mt-4 inline-block">
            לדשבורד הספקים
          </Link>
        </div>
      </main>
    );
  }

  const urgencyDot = (u: InboxLead["urgency"]) =>
    u === "urgent" ? "🔴" : u === "waiting" ? "🟡" : u === "ok" ? "🟢" : "";

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--surface-0)" }}
    >
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b px-5 py-3 flex items-center justify-between"
        style={{ background: "rgba(20,16,12,0.92)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 font-bold">
          <InboxIcon size={18} className="text-[--accent]" />
          תיבת הודעות
          {totalUnread > 0 && (
            <span
              className="text-xs rounded-full px-2 py-0.5 ltr-num"
              style={{
                background:
                  "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                color: "var(--gold-button-text)",
              }}
            >
              {totalUnread}
            </span>
          )}
        </div>
        <Link
          href="/vendors/dashboard"
          className="text-sm inline-flex items-center gap-1"
          style={{ color: "var(--foreground-soft)" }}
        >
          לדשבורד <ArrowRight size={14} />
        </Link>
      </header>

      <div className="md:grid md:grid-cols-[330px_1fr] md:h-[calc(100vh-57px)]">
        {/* List */}
        <aside
          className={`${selected ? "hidden md:block" : "block"} md:border-e overflow-y-auto`}
          style={{ borderColor: "var(--border)" }}
        >
          {!loaded ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-[--accent]" size={24} />
            </div>
          ) : leads.length === 0 ? (
            <div
              className="p-8 text-center text-sm"
              style={{ color: "var(--foreground-muted)" }}
            >
              עדיין אין פניות. ברגע שזוג יתעניין — זה יופיע כאן.
            </div>
          ) : (
            leads.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelected(l.id)}
                className="w-full text-start px-4 py-3.5 flex items-start gap-3 transition"
                style={{
                  borderBottom: "1px solid var(--border)",
                  background:
                    selected === l.id ? "rgba(212,176,104,0.08)" : "transparent",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span aria-hidden>{urgencyDot(l.urgency)}</span>
                    <span className="font-bold truncate">{l.name}</span>
                  </div>
                  <div
                    className="text-xs mt-1 line-clamp-2"
                    style={{ color: "var(--foreground-soft)" }}
                  >
                    {l.lastText}
                  </div>
                </div>
                {l.unread > 0 && (
                  <span
                    className="shrink-0 text-[11px] rounded-full px-2 py-0.5 ltr-num"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                      color: "var(--gold-button-text)",
                    }}
                  >
                    {l.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </aside>

        {/* Chat */}
        <section
          className={`${selected ? "block" : "hidden md:block"} h-[calc(100vh-57px)] md:h-auto min-h-0`}
        >
          {selected ? (
            <div className="flex flex-col h-full min-h-0">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="md:hidden px-4 py-2 text-sm inline-flex items-center gap-1 shrink-0"
                style={{
                  color: "var(--foreground-soft)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <ArrowRight size={14} /> חזרה לרשימה
              </button>
              <div className="flex-1 min-h-0">
                <ChatWindow
                  key={selected}
                  leadId={selected}
                  myRole="vendor"
                  enableSmartReplies
                />
              </div>
            </div>
          ) : (
            <div
              className="hidden md:flex h-full items-center justify-center text-sm"
              style={{ color: "var(--foreground-muted)" }}
            >
              בחרו פנייה מהרשימה כדי להתחיל לשוחח
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
