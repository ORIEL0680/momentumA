"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Modal } from "@/components/Modal";
import { AdminGuard, useAdminToken } from "@/components/admin/AdminGuard";
import { getSupabase } from "@/lib/supabase";
import {
  VENDOR_CATEGORIES,
  type VendorApplicationRecord,
} from "@/lib/vendorApplication";
import {
  Loader2,
  AlertCircle,
  ArrowRight,
  Eye,
  Check,
  X,
  ExternalLink,
} from "lucide-react";

export default function AdminVendorApplicationsPage() {
  return (
    <AdminGuard returnTo="/admin/vendors/applications">
      <Inner />
    </AdminGuard>
  );
}

function catLabel(id: string): string {
  return VENDOR_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

function Inner() {
  const token = useAdminToken();
  const [apps, setApps] = useState<VendorApplicationRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<VendorApplicationRecord | null>(null);
  const [rejecting, setRejecting] = useState<VendorApplicationRecord | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) {
          setError("Supabase לא מוגדר.");
          return;
        }
        const { data, error: qErr } = await supabase
          .from("vendor_applications")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (qErr) {
          setError("שגיאה בטעינת הבקשות.");
          return;
        }
        setApps((data as VendorApplicationRecord[]) ?? []);
      } catch {
        setError("שגיאה בטעינת הבקשות.");
      }
    })();
    return () => c.abort();
  }, []);

  const decide = async (
    id: string,
    decision: "approved" | "rejected",
    rejectionReason?: string,
  ) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/vendors/admin/decide", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ applicationId: id, decision, rejectionReason }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "הפעולה נכשלה.");
        return;
      }
      setApps((prev) => (prev ?? []).filter((a) => a.id !== id));
      setView(null);
      setRejecting(null);
      setReason("");
    } catch {
      setError("הפעולה נכשלה.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
        <Link
          href="/admin"
          className="text-sm inline-flex items-center gap-1.5"
          style={{ color: "var(--foreground-muted)" }}
        >
          <ArrowRight size={14} /> חזרה ללוח הבקרה
        </Link>
        <h1 className="mt-4 text-3xl font-bold gradient-text">
          בקשות ספקים
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground-soft)" }}>
          {apps ? `${apps.length} ממתינות לאישור` : "טוען…"}
        </p>

        {error && (
          <div
            className="mt-6 card p-4 flex items-center gap-3"
            style={{ border: "1px solid rgba(239,68,68,0.25)" }}
          >
            <AlertCircle size={18} className="text-red-300 shrink-0" />
            <span style={{ color: "var(--foreground-soft)" }}>{error}</span>
          </div>
        )}

        {!apps && !error && (
          <div className="flex justify-center py-20">
            <Loader2
              className="animate-spin"
              size={26}
              style={{ color: "var(--accent)" }}
            />
          </div>
        )}

        {apps && apps.length === 0 && (
          <div
            className="card p-10 mt-6 text-center text-sm"
            style={{ color: "var(--foreground-muted)" }}
          >
            אין בקשות ממתינות. הכול מטופל ✨
          </div>
        )}

        {apps && apps.length > 0 && (
          <div className="mt-6 space-y-2">
            {apps.map((a) => (
              <div key={a.id} className="card p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {a.business_name}
                  </div>
                  <div
                    className="text-xs truncate"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    {catLabel(a.category)} · {a.years_in_field} שנות ניסיון ·{" "}
                    <span className="ltr-num">{a.phone}</span>
                  </div>
                </div>
                <button
                  onClick={() => setView(a)}
                  aria-label="צפייה"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <Eye size={15} />
                </button>
                <button
                  onClick={() => decide(a.id, "approved")}
                  disabled={busyId === a.id}
                  aria-label="אישור"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition disabled:opacity-50"
                  style={{
                    border: "1px solid var(--border-gold)",
                    color: "rgb(110,200,150)",
                  }}
                >
                  {busyId === a.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Check size={15} />
                  )}
                </button>
                <button
                  onClick={() => {
                    setReason("");
                    setRejecting(a);
                  }}
                  aria-label="דחייה"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition"
                  style={{
                    border: "1px solid var(--border)",
                    color: "rgb(239,120,120)",
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {view && (
        <Modal onClose={() => setView(null)} title={view.business_name} maxWidthClass="max-w-lg">
          <div className="space-y-2 text-sm">
            <Detail k="תחום" v={catLabel(view.category)} />
            <Detail k="איש קשר" v={view.contact_name} />
            <Detail k="טלפון" v={view.phone} ltr />
            <Detail k="מייל" v={view.email} ltr />
            {view.city && <Detail k="עיר" v={view.city} />}
            <Detail k="ח.פ / ע.מ" v={view.business_id} ltr />
            <Detail k="ותק" v={`${view.years_in_field} שנים`} />
            {view.about && <Detail k="תיאור" v={view.about} />}
            {view.sample_work_url && (
              <a
                href={view.sample_work_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm mt-2"
                style={{ color: "var(--accent)" }}
              >
                <ExternalLink size={14} /> דוגמת עבודה
              </a>
            )}
          </div>
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => decide(view.id, "approved")}
              disabled={busyId === view.id}
              className="btn-gold flex-1 inline-flex items-center justify-center gap-2"
            >
              <Check size={16} /> אישור
            </button>
            <button
              onClick={() => {
                setReason("");
                setRejecting(view);
              }}
              className="btn-secondary flex-1"
            >
              דחייה
            </button>
          </div>
        </Modal>
      )}

      {rejecting && (
        <Modal
          onClose={() => setRejecting(null)}
          title="סיבת דחייה"
          maxWidthClass="max-w-md"
        >
          <p
            className="text-sm mb-3"
            style={{ color: "var(--foreground-soft)" }}
          >
            הסיבה תישלח לספק במייל. נסחו בכבוד וברור.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="input w-full text-sm"
            placeholder="לדוגמה: דוגמת העבודה לא נגישה / חסרים פרטי אימות…"
          />
          <button
            onClick={() => decide(rejecting.id, "rejected", reason.trim())}
            disabled={!reason.trim() || busyId === rejecting.id}
            className="btn-gold w-full mt-4 inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busyId === rejecting.id ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "שלח דחייה"
            )}
          </button>
        </Modal>
      )}
    </>
  );
}

function Detail({ k, v, ltr }: { k: string; v: string; ltr?: boolean }) {
  return (
    <div className="flex gap-3">
      <span
        className="shrink-0 w-24"
        style={{ color: "var(--foreground-muted)" }}
      >
        {k}
      </span>
      <span className={`flex-1 ${ltr ? "ltr-num" : ""}`}>{v}</span>
    </div>
  );
}
