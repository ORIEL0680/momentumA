"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  MessageCircle,
  ArrowLeft,
  Inbox as InboxIcon,
  ExternalLink,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useVendorRedirect } from "@/lib/useVendorRedirect";

/**
 * R148 — host-side chats hub.
 *
 * Lists every `vendor_leads` row where the signed-in host is the
 * couple, with the most recent message preview + unread count. A
 * click opens the conversation in a right-pane ChatWindow on
 * desktop, or a full-screen sheet on mobile.
 *
 * Pre-R148 hosts had no way to see all their conversations in one
 * place — chats lived inside each vendor's public page modal, and
 * coming back later required remembering which vendor you talked
 * to. This page is the inbox / hub the user explicitly asked for:
 * "תוסיף גם עמוד חדש בדף בעלי האירועים של צאטים עם הספקים".
 *
 * Vendors are bounced to their own vendor dashboard via the shared
 * useVendorRedirect — this page is host-only.
 */

interface ChatThread {
  leadId: string;
  vendorSlug: string;
  vendorName: string;
  vendorPhotoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: number;
}

interface LeadRow {
  id: string;
  vendor_id: string;
  status: string;
  created_at: string;
  vendor_landings:
    | {
        name: string | null;
        hero_photo_path: string | null;
      }
    | null;
}

interface MessageRow {
  id: string;
  lead_id: string;
  sender_role: "couple" | "vendor";
  body: string;
  is_read: boolean;
  created_at: string;
}

export default function HostChatsPage() {
  // R148 — vendor accounts have their own /vendors/dashboard/inbox
  // for the SAME data from the vendor side. If a vendor ends up here
  // by accident, bounce them.
  useVendorRedirect();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      setAuthed(true);

      // 1. Fetch every vendor_leads row this user owns.
      //    Embed the matching vendor_landings row by slug for the
      //    vendor's display name + photo. Leads with status='lost'
      //    are excluded — that's the vendor's "we're done" signal.
      const { data: leadsData, error: leadsErr } = await supabase
        .from("vendor_leads")
        .select(
          "id, vendor_id, status, created_at, vendor_landings:vendor_landings!vendor_leads_vendor_id_fkey(name, hero_photo_path)",
        )
        .eq("couple_user_id", user.id)
        .neq("status", "lost")
        .order("created_at", { ascending: false });
      if (leadsErr) {
        // The FK embed might fail on Supabase projects where the FK
        // doesn't exist with that exact name; fall back to a flat
        // fetch and resolve the names client-side.
        const { data: fallback } = await supabase
          .from("vendor_leads")
          .select("id, vendor_id, status, created_at")
          .eq("couple_user_id", user.id)
          .neq("status", "lost")
          .order("created_at", { ascending: false });
        const flat = (fallback ?? []) as Array<{
          id: string;
          vendor_id: string;
          status: string;
          created_at: string;
        }>;
        if (flat.length === 0) {
          setThreads([]);
          setLoading(false);
          return;
        }
        const slugs = Array.from(new Set(flat.map((l) => l.vendor_id)));
        const { data: landings } = await supabase
          .from("vendor_landings")
          .select("slug, name, hero_photo_path")
          .in("slug", slugs);
        const landingMap = new Map(
          ((landings ?? []) as Array<{
            slug: string;
            name: string | null;
            hero_photo_path: string | null;
          }>).map((l) => [l.slug, l]),
        );
        const composed: ChatThread[] = flat.map((l) => {
          const v = landingMap.get(l.vendor_id);
          return {
            leadId: l.id,
            vendorSlug: l.vendor_id,
            vendorName: v?.name ?? "ספק",
            vendorPhotoUrl: photoUrl(v?.hero_photo_path ?? null),
            lastMessage: null,
            lastMessageAt: null,
            unread: 0,
          };
        });
        await augmentWithMessages(supabase, composed);
        setThreads(composed);
        setLoading(false);
        return;
      }

      const leads = ((leadsData ?? []) as unknown as LeadRow[]).map(
        (l): ChatThread => ({
          leadId: l.id,
          vendorSlug: l.vendor_id,
          vendorName: l.vendor_landings?.name ?? "ספק",
          vendorPhotoUrl: photoUrl(l.vendor_landings?.hero_photo_path ?? null),
          lastMessage: null,
          lastMessageAt: null,
          unread: 0,
        }),
      );
      await augmentWithMessages(supabase, leads);
      setThreads(leads);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינת השיחות");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer to a microtask so the lint rule against synchronous
    // setState-in-effect is satisfied. The first state writes inside
    // `load` happen after at least one async hop (auth.getUser).
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  // Mobile-vs-desktop layout: on desktop, list + open-chat pane
  // side by side; on mobile, open the chat full-screen on click.
  const activeThread = useMemo(
    () => threads.find((t) => t.leadId === activeLeadId) ?? null,
    [threads, activeLeadId],
  );

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-[--accent]" size={28} aria-hidden />
        </main>
      </>
    );
  }

  if (authed === false) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center px-5">
          <div className="card p-8 text-center max-w-md">
            <MessageCircle
              size={32}
              className="mx-auto"
              style={{ color: "var(--foreground-muted)" }}
              aria-hidden
            />
            <h1 className="mt-4 text-xl font-bold">צ׳אטים עם ספקים</h1>
            <p
              className="mt-3 text-sm leading-relaxed"
              style={{ color: "var(--foreground-soft)" }}
            >
              התחבר כדי לראות את כל השיחות שלך עם הספקים.
            </p>
            <Link
              href="/signup?mode=signin&returnTo=/chats"
              className="btn-gold mt-5 inline-flex items-center gap-2"
            >
              כניסה לחשבון
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main
        className="min-h-screen pb-12"
        style={{ background: "var(--surface-0)" }}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-8">
          <Link
            href="/dashboard"
            className="text-xs inline-flex items-center gap-1.5 mb-3"
            style={{ color: "var(--foreground-muted)" }}
          >
            <ArrowLeft size={12} aria-hidden /> חזרה למסע
          </Link>
          <h1
            className="font-extrabold tracking-tight gradient-gold-shimmer leading-tight"
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(1.75rem, 4.4vw, 2.5rem)",
            }}
          >
            צ׳אטים עם ספקים
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--foreground-soft)" }}
          >
            <span className="ltr-num font-bold">{threads.length}</span>{" "}
            שיחות פעילות
          </p>

          {error && (
            <div
              className="mt-4 rounded-2xl p-3 text-sm"
              style={{
                background: "rgba(248,113,113,0.06)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "rgb(252 165 165)",
              }}
            >
              {error}
            </div>
          )}

          {threads.length === 0 ? (
            <EmptyChats />
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-[340px_1fr]">
              {/* List */}
              <aside className="space-y-2">
                {threads.map((t) => (
                  <ThreadRow
                    key={t.leadId}
                    thread={t}
                    active={activeLeadId === t.leadId}
                    onSelect={() => setActiveLeadId(t.leadId)}
                  />
                ))}
              </aside>

              {/* Chat pane */}
              <section
                className="rounded-3xl overflow-hidden flex flex-col min-h-[60vh] md:h-[calc(100vh-220px)]"
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                }}
              >
                {activeThread ? (
                  <>
                    <header
                      className="px-5 py-4 flex items-center gap-3"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      {activeThread.vendorPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={activeThread.vendorPhotoUrl}
                          alt={activeThread.vendorName}
                          className="w-10 h-10 rounded-full object-cover"
                          style={{ border: "1px solid var(--border-gold)" }}
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full inline-flex items-center justify-center"
                          style={{
                            background:
                              "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                            color: "var(--gold-button-text)",
                            fontWeight: 800,
                          }}
                        >
                          {(activeThread.vendorName.trim().charAt(0) || "M").toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{activeThread.vendorName}</div>
                        <Link
                          href={`/vendor/${activeThread.vendorSlug}`}
                          className="text-xs inline-flex items-center gap-1"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          <ExternalLink size={11} aria-hidden /> צפה בדף הספק
                        </Link>
                      </div>
                    </header>
                    <div className="flex-1 min-h-0">
                      <ChatWindow leadId={activeThread.leadId} myRole="couple" />
                    </div>
                  </>
                ) : (
                  <div
                    className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    <MessageCircle size={32} aria-hidden />
                    <div className="mt-3 text-sm">בחר שיחה משמאל כדי לקרוא ולהשיב</div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function ThreadRow({
  thread,
  active,
  onSelect,
}: {
  thread: ChatThread;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl p-3 flex items-center gap-3 text-start transition"
      style={{
        background: active
          ? "color-mix(in srgb, var(--accent) 10%, var(--surface-1))"
          : "var(--surface-1)",
        border: active
          ? "1px solid var(--border-gold)"
          : "1px solid var(--border)",
      }}
    >
      {thread.vendorPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thread.vendorPhotoUrl}
          alt={thread.vendorName}
          className="w-12 h-12 rounded-full object-cover shrink-0"
          style={{ border: "1px solid var(--border-gold)" }}
        />
      ) : (
        <div
          className="w-12 h-12 rounded-full inline-flex items-center justify-center shrink-0"
          style={{
            background:
              "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
            color: "var(--gold-button-text)",
            fontWeight: 800,
          }}
        >
          {(thread.vendorName.trim().charAt(0) || "M").toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm truncate">{thread.vendorName}</span>
          {thread.unread > 0 && (
            <span
              className="text-[10px] rounded-full px-2 py-0.5 ltr-num shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                color: "var(--gold-button-text)",
              }}
            >
              {thread.unread}
            </span>
          )}
        </div>
        <div
          className="text-xs mt-0.5 truncate"
          style={{ color: "var(--foreground-soft)" }}
        >
          {thread.lastMessage ?? "התחל שיחה — אין הודעות עדיין"}
        </div>
      </div>
    </button>
  );
}

function EmptyChats() {
  return (
    <div className="mt-10 card p-10 text-center max-w-xl mx-auto">
      <div
        className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4"
        style={{
          background: "color-mix(in srgb, var(--gold-100) 12%, transparent)",
          border: "1px solid var(--border-gold)",
          color: "var(--accent)",
        }}
      >
        <InboxIcon size={26} aria-hidden />
      </div>
      <h3 className="text-xl font-bold">עדיין אין שיחות עם ספקים</h3>
      <p
        className="mt-2 text-sm leading-relaxed max-w-md mx-auto"
        style={{ color: "var(--foreground-soft)" }}
      >
        כל ספק שתתחיל איתו שיחה דרך הקטלוג או דף הספק יופיע כאן עם
        ההיסטוריה המלאה.
      </p>
      <Link
        href="/vendors"
        className="btn-gold mt-6 inline-flex items-center gap-2"
      >
        עיון בקטלוג הספקים
      </Link>
    </div>
  );
}

// ─────────── helpers ───────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

function photoUrl(path: string | null): string | null {
  if (!path) return null;
  // Same logic as getVendorPhotoUrl — building it inline so the
  // chats page doesn't need to import the server-side helper.
  if (path.startsWith("http")) return path;
  return `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/vendor-studio/${path}`;
}

async function augmentWithMessages(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  threads: ChatThread[],
): Promise<void> {
  if (threads.length === 0) return;
  const leadIds = threads.map((t) => t.leadId);
  // Fetch the most recent ~200 messages across all leads in one shot.
  // For most hosts (small N leads, sparse chats) this is enough. We
  // then group client-side and pick the latest per lead + count
  // unread.
  const { data } = await supabase
    .from("vendor_chat_messages")
    .select("id, lead_id, sender_role, body, is_read, created_at")
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as MessageRow[];
  const byLead = new Map<string, { last: MessageRow; unread: number }>();
  for (const m of rows) {
    const slot = byLead.get(m.lead_id);
    if (!slot) {
      byLead.set(m.lead_id, {
        last: m,
        unread: m.sender_role === "vendor" && !m.is_read ? 1 : 0,
      });
    } else {
      if (m.sender_role === "vendor" && !m.is_read) slot.unread++;
    }
  }
  for (const t of threads) {
    const slot = byLead.get(t.leadId);
    if (slot) {
      const trimmed = (slot.last.body ?? "").trim();
      t.lastMessage =
        trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed || null;
      t.lastMessageAt = slot.last.created_at;
      t.unread = slot.unread;
    }
  }
}
