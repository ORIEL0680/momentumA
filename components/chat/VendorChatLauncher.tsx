"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { ChatWindow } from "@/components/chat/ChatWindow";

/**
 * R43 — couple-side chat entry on /vendor/[slug]. Shows a floating
 * "💬 צ'אט" button ONLY when the signed-in couple already has an
 * active lead with this vendor (status != 'lost'). No lead / not
 * signed in → renders nothing (no clutter). Fully fail-soft.
 */
export function VendorChatLauncher({ slug }: { slug: string }) {
  const [leadId, setLeadId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) return;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
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
        if (id && !cancelled) setLeadId(id);
      } catch {
        /* no lead / signed out → no chat button */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!leadId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-[70] inline-flex items-center gap-2 rounded-full px-5 py-3 font-bold shadow-lg"
        style={{
          background:
            "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
          color: "var(--gold-button-text)",
        }}
      >
        <MessageCircle size={18} /> צ׳אט עם הספק
      </button>

      {open && (
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
