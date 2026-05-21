"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Inbox,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Header } from "@/components/Header";
import { AdminGuard, useAdminToken } from "@/components/admin/AdminGuard";

/**
 * R86 (R68) — global leads view. Reads from /api/admin/leads, which
 * uses service-role to cross every vendor's inbox. Useful for:
 *   • spotting categories that drive the most demand
 *   • finding vendors who aren't responding (the "stale" flag below
 *     marks pending/contacted leads older than 3 days)
 *   • debugging when a couple reports "I sent a message but no one
 *     answered" — admin can confirm the row exists.
 */

interface AdminLeadRow {
  id: string;
  vendor_id: string;
  vendor_name: string | null;
  vendor_category: string | null;
  couple_user_id: string;
  couple_name: string | null;
  couple_email: string | null;
  couple_phone: string | null;
  message: string | null;
  status: string;
  source: string | null;
  created_at: string;
  updated_at: string;
  stale: boolean;
}

export default function AdminLeadsPage() {
  return (
    <AdminGuard returnTo="/admin/leads">
      <Inner />
    </AdminGuard>
  );
}

function Inner() {
  const token = useAdminToken();
  const [leads, setLeads] = useState<AdminLeadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "stale" | "pending">(
    "all",
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/admin/leads", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          setError(data.message ?? "טעינת לידים נכשלה.");
          return;
        }
        const data = (await res.json()) as { leads: AdminLeadRow[] };
        setLeads(data.leads);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("שגיאת רשת.");
      }
    })();
    return () => controller.abort();
  }, [token]);

  const filtered = (leads ?? []).filter((l) => {
    if (statusFilter === "stale") return l.stale;
    if (statusFilter === "pending") return l.status === "pending";
    return true;
  });
  const staleCount = (leads ?? []).filter((l) => l.stale).length;

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

        <div className="mt-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold gradient-text">
              לידים גלובליים
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--foreground-soft)" }}
            >
              {leads
                ? `${leads.length} סה״כ${staleCount ? ` · ${staleCount} פתוחים מעל 3 ימים` : ""}`
                : "טוען…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FilterPill
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              הכל
            </FilterPill>
            <FilterPill
              active={statusFilter === "pending"}
              onClick={() => setStatusFilter("pending")}
            >
              ממתינים
            </FilterPill>
            <FilterPill
              active={statusFilter === "stale"}
              onClick={() => setStatusFilter("stale")}
              warning
            >
              ⚠ פתוחים מדי
            </FilterPill>
          </div>
        </div>

        {error && (
          <div
            className="mt-6 card p-4 flex items-center gap-3"
            style={{ border: "1px solid rgba(239,68,68,0.25)" }}
          >
            <AlertCircle size={18} className="text-red-300 shrink-0" />
            <span style={{ color: "var(--foreground-soft)" }}>{error}</span>
          </div>
        )}

        {!leads && !error && (
          <div className="flex justify-center py-20">
            <Loader2
              className="animate-spin"
              size={26}
              style={{ color: "var(--accent)" }}
            />
          </div>
        )}

        {leads && leads.length === 0 && (
          <div className="card-gold p-10 mt-8 text-center">
            <Inbox size={36} className="mx-auto text-[--accent]" />
            <h2 className="mt-4 text-lg font-bold">אין עדיין לידים</h2>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--foreground-soft)" }}
            >
              כאן יופיעו כל הפניות שהזוגות שולחים לספקים.
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mt-6 grid gap-2">
            {filtered.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function FilterPill({
  active,
  onClick,
  warning,
  children,
}: {
  active: boolean;
  onClick: () => void;
  warning?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs py-1.5 px-3 rounded-full transition"
      style={{
        border: active
          ? `1px solid ${warning ? "rgb(251,191,36)" : "var(--accent)"}`
          : "1px solid var(--border)",
        background: active
          ? warning
            ? "rgba(251,191,36,0.12)"
            : "color-mix(in srgb, var(--accent) 12%, transparent)"
          : "transparent",
        color: active
          ? warning
            ? "rgb(251,191,36)"
            : "var(--accent)"
          : "var(--foreground-soft)",
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}

function LeadRow({ lead }: { lead: AdminLeadRow }) {
  const created = new Date(lead.created_at);
  const relative = formatRelative(created);
  return (
    <div
      className="card p-4 flex items-start gap-3"
      style={{
        borderColor: lead.stale ? "rgba(251,191,36,0.4)" : "var(--border)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center flex-wrap gap-2">
          <span className="font-semibold text-sm truncate">
            {lead.couple_name ?? "אורח אנונימי"}
          </span>
          <span style={{ color: "var(--foreground-muted)" }}>→</span>
          {lead.vendor_name ? (
            <Link
              href={`/vendor/${encodeURIComponent(lead.vendor_id)}`}
              className="font-semibold text-sm truncate inline-flex items-center gap-1 hover:underline"
              style={{ color: "var(--accent)" }}
            >
              {lead.vendor_name}
              <ExternalLink size={11} aria-hidden />
            </Link>
          ) : (
            <span
              className="font-semibold text-sm truncate"
              style={{ color: "var(--foreground-muted)" }}
            >
              {lead.vendor_id}
            </span>
          )}
          <StatusPill status={lead.status} />
          {lead.stale && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{
                background: "rgba(251,191,36,0.12)",
                color: "rgb(251,191,36)",
                border: "1px solid rgba(251,191,36,0.35)",
              }}
            >
              <AlertTriangle size={10} aria-hidden /> פתוח מדי זמן
            </span>
          )}
        </div>
        {lead.message && (
          <div
            className="text-xs mt-1 line-clamp-2 leading-snug"
            style={{ color: "var(--foreground-soft)" }}
          >
            “{lead.message}”
          </div>
        )}
        <div
          className="text-[11px] mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5"
          style={{ color: "var(--foreground-muted)" }}
        >
          <span>{relative}</span>
          {lead.couple_phone && <span>📞 {lead.couple_phone}</span>}
          {lead.couple_email && <span>📧 {lead.couple_email}</span>}
          {lead.vendor_category && (
            <span>קטגוריה: {lead.vendor_category}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { label: string; bg: string; color: string }> = {
    pending: {
      label: "ממתין",
      bg: "rgba(251,191,36,0.12)",
      color: "rgb(251,191,36)",
    },
    contacted: {
      label: "נוצר קשר",
      bg: "rgba(96,165,250,0.12)",
      color: "rgb(96,165,250)",
    },
    quoted: {
      label: "הצעת מחיר",
      bg: "rgba(168,85,247,0.12)",
      color: "rgb(168,85,247)",
    },
    won: {
      label: "✓ נסגר",
      bg: "rgba(110,231,183,0.14)",
      color: "rgb(110,231,183)",
    },
    lost: {
      label: "אבוד",
      bg: "rgba(248,113,113,0.12)",
      color: "rgb(248,113,113)",
    },
  };
  const s = styles[status] ?? {
    label: status,
    bg: "var(--input-bg)",
    color: "var(--foreground-muted)",
  };
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-bold"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

/** "5 דקות / 2 שעות / 3 ימים" relative time formatter (he-IL). */
function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "עכשיו";
  if (min < 60) return `${min} דק׳ ${min > 1 ? "אחורה" : "אחורה"}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} שעות אחורה`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} ימים אחורה`;
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });
}
