"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  AlertCircle,
  Shield,
  ScrollText,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  UserPlus,
  Database,
} from "lucide-react";
import { Header } from "@/components/Header";
import { AdminGuard, useAdminToken } from "@/components/admin/AdminGuard";
import { FOUNDER_EMAIL } from "@/lib/constants";

/**
 * R86 (R68) — admin system settings.
 *
 * Three sections:
 *   1. אזור המייסד — shows the constant FOUNDER_EMAIL (no UI to change).
 *   2. יומן פעולות — audit log feed (delete vendor, restore vendor,
 *      approve, etc.). Pulled from /api/admin/audit which runs under
 *      service-role so the founder sees EVERY admin's actions.
 *   3. מידע מערכת — quick info / future settings (placeholder).
 *
 * Toggling "maintenance mode" / "freeze signups" would need a new
 * settings table + middleware integration; deferred for the same
 * reason announcements were deferred from this round.
 */

interface AuditEvent {
  id: string;
  admin_email: string;
  action: string;
  target_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function AdminSettingsPage() {
  return (
    <AdminGuard returnTo="/admin/settings">
      <Inner />
    </AdminGuard>
  );
}

function Inner() {
  const token = useAdminToken();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/admin/audit", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          setError(data.message ?? "טעינת היומן נכשלה.");
          return;
        }
        const data = (await res.json()) as { events: AuditEvent[] };
        setEvents(data.events);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("שגיאת רשת.");
      }
    })();
    return () => controller.abort();
  }, [token]);

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-10">
        <Link
          href="/admin"
          className="text-sm inline-flex items-center gap-1.5"
          style={{ color: "var(--foreground-muted)" }}
        >
          <ArrowRight size={14} /> חזרה ללוח הבקרה
        </Link>

        <h1 className="mt-4 text-3xl font-bold gradient-text">
          הגדרות מערכת
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--foreground-soft)" }}
        >
          ניהול גישת אדמין + יומן פעולות.
        </p>

        {/* Founder card */}
        <section className="mt-8">
          <SectionHeader icon={<Shield size={18} />} title="אדמין" />
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full inline-flex items-center justify-center text-xl"
                style={{
                  background:
                    "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                  color: "var(--background)",
                }}
                aria-hidden
              >
                👑
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{FOUNDER_EMAIL}</div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  Founder · admin-bypass קבוע בקוד (lib/constants.ts)
                </div>
              </div>
            </div>
            <div
              className="mt-3 pt-3 text-xs leading-relaxed"
              style={{
                borderTop: "1px solid var(--border)",
                color: "var(--foreground-muted)",
              }}
            >
              להוספת אדמין נוסף — הרץ ב-Supabase SQL Editor:
              <pre
                className="mt-2 px-3 py-2 rounded-lg text-xs overflow-x-auto"
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--border)",
                  color: "var(--accent)",
                  fontFamily: "ui-monospace, monospace",
                  direction: "ltr",
                  textAlign: "left",
                }}
              >
                INSERT INTO admin_emails (email) VALUES (&apos;new@admin.com&apos;);
              </pre>
              <span className="inline-flex items-center gap-1.5 mt-2">
                <UserPlus size={11} aria-hidden />
                אין UI כי הוספת אדמין נדיר ותחת תזכורת אבטחה.
              </span>
            </div>
          </div>
        </section>

        {/* Audit log */}
        <section className="mt-10">
          <SectionHeader
            icon={<ScrollText size={18} />}
            title="יומן פעולות"
            subtitle={
              events
                ? `${events.length} פעולות אחרונות`
                : "טוען…"
            }
          />

          {error && (
            <div
              className="card p-4 flex items-center gap-3"
              style={{ border: "1px solid rgba(239,68,68,0.25)" }}
            >
              <AlertCircle size={18} className="text-red-300 shrink-0" />
              <span style={{ color: "var(--foreground-soft)" }}>{error}</span>
            </div>
          )}

          {!events && !error && (
            <div className="flex justify-center py-12">
              <Loader2
                className="animate-spin"
                size={22}
                style={{ color: "var(--accent)" }}
              />
            </div>
          )}

          {events && events.length === 0 && (
            <div className="card p-8 text-center">
              <ScrollText
                size={28}
                className="mx-auto"
                style={{ color: "var(--foreground-muted)" }}
              />
              <p
                className="mt-3 text-sm"
                style={{ color: "var(--foreground-soft)" }}
              >
                עוד לא בוצעו פעולות. כשתאשר/תמחק/תשחזר ספק — זה יופיע כאן.
              </p>
            </div>
          )}

          {events && events.length > 0 && (
            <ol className="grid gap-1.5">
              {events.map((ev) => (
                <AuditEntry key={ev.id} event={ev} />
              ))}
            </ol>
          )}
        </section>

        {/* System info */}
        <section className="mt-10">
          <SectionHeader icon={<Database size={18} />} title="מערכת" />
          <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoRow label="סביבה" value={typeof window !== "undefined" ? window.location.hostname : "?"} />
            <InfoRow label="גרסת Next" value="16" />
            <InfoRow label="DB" value="Supabase / Postgres" />
            <InfoRow label="Hosting" value="Vercel" />
          </div>
        </section>
      </main>
    </>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-lg font-semibold inline-flex items-center gap-2">
        <span style={{ color: "var(--accent)" }}>{icon}</span>
        {title}
      </h2>
      {subtitle && (
        <span
          className="text-xs"
          style={{ color: "var(--foreground-muted)" }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--foreground-muted)" }}>{label}</span>
      <span
        className="font-mono text-xs ltr-num truncate"
        style={{ color: "var(--accent)" }}
      >
        {value}
      </span>
    </div>
  );
}

/** Per-event row. Icon + label derived from `action`. */
function AuditEntry({ event }: { event: AuditEvent }) {
  const action = ACTION_META[event.action] ?? {
    label: event.action,
    icon: <ScrollText size={13} aria-hidden />,
    color: "var(--foreground-muted)",
  };
  const businessName =
    typeof event.metadata?.business_name === "string"
      ? (event.metadata.business_name as string)
      : null;
  const when = new Date(event.created_at);
  return (
    <li
      className="card p-3 flex items-start gap-3 text-sm"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        className="w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: "color-mix(in srgb, var(--accent) 12%, transparent)",
          color: action.color,
        }}
      >
        {action.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-semibold">{action.label}</span>
          {businessName && (
            <span style={{ color: "var(--foreground-soft)" }}>
              · {businessName}
            </span>
          )}
        </div>
        <div
          className="text-[11px] mt-0.5 flex flex-wrap gap-x-3"
          style={{ color: "var(--foreground-muted)" }}
        >
          <span>{event.admin_email}</span>
          <span>
            {when.toLocaleDateString("he-IL", {
              day: "numeric",
              month: "short",
            })}{" "}
            {when.toLocaleTimeString("he-IL", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {event.target_id && (
            <span className="ltr-num truncate" title={event.target_id}>
              id: {event.target_id.slice(0, 8)}…
            </span>
          )}
        </div>
        {event.reason && (
          <div
            className="text-xs mt-1 italic"
            style={{ color: "var(--foreground-soft)" }}
          >
            “{event.reason}”
          </div>
        )}
      </div>
    </li>
  );
}

const ACTION_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  vendor_delete: {
    label: "ספק הוסר מהקטלוג",
    icon: <Trash2 size={13} aria-hidden />,
    color: "rgb(248,113,113)",
  },
  vendor_restore: {
    label: "ספק שוחזר לקטלוג",
    icon: <RotateCcw size={13} aria-hidden />,
    color: "rgb(110,231,183)",
  },
  vendor_approve: {
    label: "ספק אושר",
    icon: <CheckCircle2 size={13} aria-hidden />,
    color: "rgb(110,231,183)",
  },
  vendor_reject: {
    label: "ספק נדחה",
    icon: <XCircle size={13} aria-hidden />,
    color: "rgb(248,113,113)",
  },
};
