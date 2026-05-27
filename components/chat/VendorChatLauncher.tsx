"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { ChatWindow } from "@/components/chat/ChatWindow";

/**
 * R43 / R148 — couple-side chat entry on /vendor/[slug].
 *
 * Pre-R148: the floating "💬 צ'אט" button only showed when the couple
 * already had an active vendor_leads row with this vendor. If they
 * hadn't filled the "send interest" form yet, there was no way to
 * start a conversation from the public landing — they had to scroll,
 * find the form, fill it, submit, wait for the lead row to materialize,
 * THEN see a chat button. Lots of friction.
 *
 * R148: ALWAYS show the button when the couple is signed in. First
 * click — if a lead already exists, opens straight into the chat; if
 * not, POSTs to /api/vendors/lead to create one (source="contact_button")
 * and then opens the chat. The vendor sees the same lead row the
 * "send interest" form would have created, so the existing pipeline
 * (notifications, leads dashboard, etc.) keeps working unchanged.
 */
export function VendorChatLauncher({ slug }: { slug: string }) {
  const [leadId, setLeadId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  // Track whether the user is signed in. Anonymous visitors see a
  // sign-in CTA instead of a chat button (you can't message a vendor
  // without an account to attach the lead to).
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  // Ref to the most recently-fetched lead id, so the create-on-click
  // path can short-circuit if the existing-lead fetch resolves after
  // the user already clicked.
  const leadIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) {
          if (!cancelled) setSignedIn(false);
          return;
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setSignedIn(false);
          return;
        }
        setSignedIn(true);
        const { data } = await supabase
          .from("vendor_leads")
          .select("id, status")
          .eq("vendor_id", slug)
          .eq("couple_user_id", user.id)
          .neq("status", "lost")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const id = (data as { id?: string } | null)?.id;
        if (id && !cancelled) {
          setLeadId(id);
          leadIdRef.current = id;
        }
      } catch {
        if (!cancelled) setSignedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Anonymous visitor: link to /signup with returnTo so they come
  // back here after auth and can start the chat. No chat button.
  if (signedIn === null) return null;
  if (signedIn === false) return null;

  const handleClick = async () => {
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
          // No `message` — the user will start typing in the chat.
        }),
      });
      if (!res.ok) {
        // Soft-fail. Let the user retry by clicking again.
        return;
      }
      const json = (await res.json()) as { id?: string };
      if (json.id) {
        leadIdRef.current = json.id;
        setLeadId(json.id);
        setOpen(true);
      }
    } catch {
      /* network/RLS issue — user can retry */
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={creating}
        className="fixed bottom-5 left-5 z-[70] inline-flex items-center gap-2 rounded-full px-5 py-3 font-bold shadow-lg disabled:opacity-70"
        style={{
          background:
            "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
          color: "var(--gold-button-text)",
        }}
        aria-label={leadId ? "פתח צ'אט עם הספק" : "התחל צ'אט עם הספק"}
      >
        {creating ? (
          <Loader2 size={18} className="animate-spin" aria-hidden />
        ) : (
          <MessageCircle size={18} aria-hidden />
        )}
        {leadId ? "צ׳אט עם הספק" : "שלח הודעה לספק"}
      </button>

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
              <h2 className="font-bold gradient-gold">צ׳אט עם הספק</h2>
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
