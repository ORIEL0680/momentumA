"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, Phone, X, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { ChatWindow } from "@/components/chat/ChatWindow";

/**
 * R85-0 — multichannel contact bar on /vendor/[slug].
 *
 * Two device-specific layouts:
 *   • **Mobile**: fixed bottom bar across the full viewport width.
 *     Big primary "💬 שלח הודעה ל-{name}" button + compact phone +
 *     WhatsApp icon buttons on either side. Always reachable, never
 *     scrolled off-screen.
 *   • **Desktop**: floating sidebar card top-right (md+). Premium
 *     gold-bordered card with three full-width CTAs — Chat /
 *     WhatsApp / Phone — labelled and stacked so the couple can pick
 *     the channel they prefer.
 *
 * The chat itself still flows through the SAME infra as before
 * (R43 / R148): `vendor_leads` row = the thread, `vendor_chat_messages`
 * for individual messages, `ChatWindow` for the UI, with
 * realtime via useVendorChat. No new tables created.
 *
 * Pre-R85 the chat launcher was a single floating bottom-left
 * circle from R148 — easy to miss next to other floating UI. R85
 * makes the chat invitation the dominant CTA on the page.
 *
 * Anonymous visitors see a SIGN-IN variant of the buttons (chat
 * disabled, WhatsApp + phone still tappable). First click on chat
 * by a signed-in couple lazily creates the vendor_leads row via
 * POST /api/vendors/lead.
 */

export interface VendorChatLauncherProps {
  /** vendor_landings.slug — used as vendor_leads.vendor_id. */
  slug: string;
  /** vendor_landings.name — for the CTA label. */
  vendorName: string;
  /** vendor_landings.phone — used for both tel: and wa.me. Null →
   *  the WhatsApp + phone buttons hide. */
  vendorPhone: string | null;
  /** vendor_landings.owner_user_id — used to hide the launcher
   *  when the vendor is viewing their own page. */
  ownerUserId: string;
}

export function VendorChatLauncher({
  slug,
  vendorName,
  vendorPhone,
  ownerUserId,
}: VendorChatLauncherProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState<boolean>(() => !getSupabase());
  const [leadId, setLeadId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const leadIdRef = useRef<string | null>(null);

  // Resolve auth + existing-lead lookup on mount.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        setUserId(user?.id ?? null);
        setAuthResolved(true);
        if (!user) return;
        const { data } = await supabase
          .from("vendor_leads")
          .select("id, status")
          .eq("vendor_id", slug)
          .eq("couple_user_id", user.id)
          .neq("status", "lost")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const id = (data as { id?: string } | null)?.id ?? null;
        if (id && !cancelled) {
          setLeadId(id);
          leadIdRef.current = id;
        }
      } catch {
        if (!cancelled) setAuthResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Vendor viewing own page → hide everything. Their own contact
  // info is at the top of their landing; this CTA is for couples.
  if (authResolved && userId === ownerUserId && userId !== null) return null;

  const phoneClean = vendorPhone ? vendorPhone.replace(/[^\d+]/g, "") : "";
  const telHref = phoneClean ? `tel:${phoneClean}` : null;
  // R85-0 — wa.me wants no leading "+" and digits only.
  const waDigits = phoneClean.replace(/\+/g, "");
  const waMessage = encodeURIComponent(
    `שלום! ראיתי את הדף שלכם ב-Momentum ואשמח לפרטים על האירוע שלי.`,
  );
  const whatsappHref = waDigits ? `https://wa.me/${waDigits}?text=${waMessage}` : null;

  const handleChatClick = async () => {
    if (!userId) return; // CTA goes to /signup directly via <Link>
    if (leadIdRef.current) {
      setOpen(true);
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/vendors/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vendor_slug: slug,
          source: "contact_button",
        }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { id?: string };
      if (json.id) {
        leadIdRef.current = json.id;
        setLeadId(json.id);
        setOpen(true);
      }
    } catch {
      /* retry-friendly soft fail */
    } finally {
      setCreating(false);
    }
  };

  const signinHref = `/signup?mode=signin&returnTo=${encodeURIComponent(
    `/vendor/${slug}`,
  )}`;

  return (
    <>
      {/* ─── Mobile: sticky bottom bar (full-width) ───────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          background:
            "linear-gradient(180deg, transparent, color-mix(in srgb, var(--background) 95%, transparent) 30%)",
        }}
      >
        <div
          className="mx-3 mb-3 p-2.5 flex items-center gap-2"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface-1)), var(--surface-1))",
            border: "1px solid var(--border-gold)",
            borderRadius: 18,
            boxShadow:
              "0 18px 40px -16px rgba(0,0,0,0.6), 0 0 0 1px var(--border-gold), inset 0 1px 0 rgba(244,222,169,0.18)",
          }}
        >
          {/* Phone button — compact icon */}
          {telHref && (
            <a
              href={telHref}
              className="shrink-0 w-11 h-11 rounded-2xl inline-flex items-center justify-center"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              aria-label={`התקשר ל-${vendorName}`}
            >
              <Phone size={18} aria-hidden />
            </a>
          )}

          {/* Primary chat CTA */}
          {userId ? (
            <button
              type="button"
              onClick={handleChatClick}
              disabled={creating}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold disabled:opacity-70"
              style={{
                minHeight: 44,
                background:
                  "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                color: "var(--gold-button-text)",
              }}
              aria-label={
                leadId ? `פתח צ׳אט עם ${vendorName}` : `התחל צ׳אט עם ${vendorName}`
              }
            >
              {creating ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : (
                <MessageCircle size={16} aria-hidden />
              )}
              {leadId ? "צ׳אט עם הספק" : `שלח הודעה ל-${vendorName}`}
            </button>
          ) : (
            <Link
              href={signinHref}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold"
              style={{
                minHeight: 44,
                background:
                  "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                color: "var(--gold-button-text)",
              }}
              aria-label="התחבר כדי לפתוח צ׳אט"
            >
              <MessageCircle size={16} aria-hidden />
              התחבר וכתוב לספק
            </Link>
          )}

          {/* WhatsApp button — compact glyph */}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 w-11 h-11 rounded-2xl inline-flex items-center justify-center text-white"
              style={{
                background: "#25D366",
              }}
              aria-label={`WhatsApp ל-${vendorName}`}
            >
              <WhatsappIcon size={18} />
            </a>
          )}
        </div>
      </div>

      {/* ─── Desktop: floating sidebar card (top-right) ──────────── */}
      <aside
        className="hidden md:flex fixed top-28 end-6 z-40 flex-col gap-2 w-64"
        aria-label={`יצירת קשר עם ${vendorName}`}
      >
        <div
          className="p-4 flex flex-col gap-2.5"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--surface-1)), var(--surface-1))",
            border: "1px solid var(--border-gold)",
            borderRadius: 20,
            boxShadow:
              "0 24px 60px -28px var(--accent-glow), 0 0 0 1px var(--border-gold), inset 0 1px 0 rgba(244,222,169,0.18)",
          }}
        >
          <div className="text-center">
            <div
              className="text-[10px] uppercase tracking-[0.18em] font-semibold"
              style={{ color: "var(--accent)" }}
            >
              צרו קשר
            </div>
            <div
              className="mt-1 font-bold text-sm gradient-gold truncate"
              style={{ fontFamily: "var(--font-display), Georgia, serif" }}
              title={vendorName}
            >
              {vendorName}
            </div>
          </div>

          {userId ? (
            <button
              type="button"
              onClick={handleChatClick}
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold disabled:opacity-70 transition hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                color: "var(--gold-button-text)",
              }}
            >
              {creating ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <MessageCircle size={14} aria-hidden />
              )}
              {leadId ? "פתח צ׳אט" : "שלח הודעה"}
            </button>
          ) : (
            <Link
              href={signinHref}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                color: "var(--gold-button-text)",
              }}
            >
              <MessageCircle size={14} aria-hidden />
              התחבר וכתוב לספק
            </Link>
          )}

          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:scale-[1.02]"
              style={{ background: "#25D366" }}
            >
              <WhatsappIcon size={14} />
              WhatsApp
            </a>
          )}

          {telHref && (
            <a
              href={telHref}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition hover:scale-[1.02]"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <Phone size={14} aria-hidden />
              שיחה
            </a>
          )}

          <div
            className="text-[10px] text-center mt-1"
            style={{ color: "var(--foreground-muted)" }}
          >
            בדרך כלל עונים תוך 4 שעות
          </div>
        </div>
      </aside>

      {/* ─── Chat modal ───────────────────────────────────────────── */}
      {open && leadId && (
        <div
          className="fixed inset-0 z-[90] flex items-end md:items-center justify-center md:p-6"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full md:max-w-lg h-[85vh] md:h-[70vh] flex flex-col rounded-t-3xl md:rounded-3xl overflow-hidden"
            style={{
              background: "var(--surface-0)",
              border: "1px solid var(--border-gold)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                  צ׳אט עם הספק
                </div>
                <div className="font-bold gradient-gold truncate">{vendorName}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגור"
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  background: "var(--input-bg)",
                  color: "var(--foreground-soft)",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ChatWindow leadId={leadId} myRole="couple" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Small inline WhatsApp glyph (no extra dep). */
function WhatsappIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.36-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.886 9.884z" />
    </svg>
  );
}
