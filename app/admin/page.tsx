"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AdminGuard, useAdminToken } from "@/components/admin/AdminGuard";
import { StatCard } from "@/components/admin/StatCard";
import { MiniChart } from "@/components/admin/MiniChart";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import type { AdminStats } from "@/lib/admin/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import {
  Loader2,
  AlertCircle,
  Store,
  Bug,
  CalendarClock,
  ChevronLeft,
} from "lucide-react";

export default function AdminHomePage() {
  return (
    <AdminGuard returnTo="/admin">
      <AdminHomeInner />
    </AdminGuard>
  );
}

function AdminHomeInner() {
  const token = useAdminToken();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/admin/stats", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = (await res.json()) as AdminStats | { error: string };
        if (!res.ok) {
          setError("error" in data ? data.error : "שגיאה בטעינת נתונים");
          return;
        }
        setStats(data as AdminStats);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("שגיאה בטעינת נתונים. נסה לרענן.");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [token]);

  const today = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <span className="eyebrow">לוח בקרה</span>
            <h1 className="mt-2 text-4xl font-bold gradient-text">
              ברוך הבא, טל
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--foreground-soft)" }}
            >
              {today}
            </p>
          </div>
          {stats && <SystemHealthBadge errors={stats.errors_last_24h} />}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2
              className="animate-spin"
              size={28}
              style={{ color: "var(--accent)" }}
              aria-label="טוען"
            />
          </div>
        )}

        {error && !loading && (
          <div
            className="card p-6 flex items-center gap-3"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
            }}
          >
            <AlertCircle size={18} className="text-red-300 shrink-0" />
            <span style={{ color: "var(--foreground-soft)" }}>{error}</span>
          </div>
        )}

        {stats && !loading && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="זוגות פעילים"
                value={stats.users.total}
                delta={stats.deltas.users_7d}
                chart={stats.series.users_7d}
                href="/admin/users"
              />
              <StatCard
                label="ספקים מאושרים"
                value={stats.vendors.approved}
                href="/admin/vendors/applications"
              />
              <StatCard
                label="אירועים השבוע"
                value={stats.events.new_this_week}
                delta={stats.deltas.events_7d}
                chart={stats.series.events_7d}
                href="/admin/events"
              />
              <StatCard
                label="הכנסה החודש"
                value="₪0"
                isPlaceholder
              />
            </div>

            <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
              <div className="space-y-6">
                <UrgentActions
                  pendingVendors={stats.vendors.pending}
                  errors={stats.errors_last_24h}
                />
                <UpcomingEvents events={stats.upcoming_events} />
                <UsageChart series={stats.series.events_7d} />
                <MonitoringCard />
              </div>
              <ActivityFeed initial={stats.recent_activity} limit={20} />
            </div>
          </>
        )}
      </main>
    </>
  );
}

function SystemHealthBadge({ errors }: { errors: number }) {
  const level =
    errors === 0 ? "ok" : errors < 10 ? "warn" : "bad";
  const map = {
    ok: { c: "rgb(110,200,150)", t: "המערכת תקינה" },
    warn: { c: "rgb(220,170,90)", t: `${errors} שגיאות ב-24ש׳` },
    bad: { c: "rgb(239,120,120)", t: `${errors} שגיאות ב-24ש׳` },
  } as const;
  const { c, t } = map[level];
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
      style={{ border: "1px solid var(--border)", color: c }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ background: c }}
        aria-hidden
      />
      {t}
    </div>
  );
}

function UrgentActions({
  pendingVendors,
  errors,
}: {
  pendingVendors: number;
  errors: number;
}) {
  const actions = [
    pendingVendors > 0 && {
      icon: Store,
      label: `${pendingVendors} בקשות ספק ממתינות לאישור`,
      href: "/admin/vendors/applications",
    },
    errors > 0 && {
      icon: Bug,
      label: `${errors} שגיאות ב-24 השעות האחרונות`,
      href: "/admin/errors",
    },
  ].filter(Boolean) as Array<{
    icon: typeof Store;
    label: string;
    href: string;
  }>;

  if (actions.length === 0) return null;

  return (
    <div className="card p-5 md:p-6">
      <h2 className="font-bold mb-4">פעולות דחופות</h2>
      <div className="space-y-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-3 rounded-xl px-4 py-3 transition hover:-translate-y-0.5"
            style={{
              background: "color-mix(in srgb, var(--gold-100) 8%, transparent)",
              border: "1px solid var(--border-gold)",
            }}
          >
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{
                background:
                  "color-mix(in srgb, var(--gold-100) 16%, transparent)",
                color: "var(--accent)",
              }}
              aria-hidden
            >
              <a.icon size={15} />
            </span>
            <span className="flex-1 text-sm font-medium">{a.label}</span>
            <ChevronLeft
              size={16}
              style={{ color: "var(--foreground-muted)" }}
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

function eventTypeLabel(type: string): string {
  const map = EVENT_TYPE_LABELS as Record<string, string>;
  return map[type] ?? "אירוע";
}

function UpcomingEvents({
  events,
}: {
  events: AdminStats["upcoming_events"];
}) {
  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock
          size={16}
          style={{ color: "var(--accent)" }}
          aria-hidden
        />
        <h2 className="font-bold">אירועים קרובים</h2>
      </div>
      {events.length === 0 ? (
        <p
          className="text-sm py-6 text-center"
          style={{ color: "var(--foreground-muted)" }}
        >
          אין אירועים עתידיים מסונכרנים כרגע.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {events.map((e) => (
            <li
              key={`${e.userId}-${e.date}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: "var(--input-bg)" }}
            >
              <span className="flex-1 min-w-0">
                <span className="text-sm font-semibold truncate block">
                  {e.title}
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  {eventTypeLabel(e.type)} · {e.guests} מוזמנים
                </span>
              </span>
              <span
                className="text-xs ltr-num shrink-0"
                style={{ color: "var(--foreground-soft)" }}
              >
                {new Date(e.date).toLocaleDateString("he-IL", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UsageChart({ series }: { series: number[] }) {
  const total = series.reduce((s, n) => s + n, 0);
  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">פעילות 7 ימים</h2>
        <span
          className="text-xs ltr-num"
          style={{ color: "var(--foreground-muted)" }}
        >
          {total} סנכרונים
        </span>
      </div>
      <MiniChart data={series} height={64} />
    </div>
  );
}

/**
 * R63 (R53) — quick links to the three external monitoring tools +
 * the in-app error log (R59). External links open in new tabs.
 */
function MonitoringCard() {
  const items: Array<{
    label: string;
    emoji: string;
    href: string;
    external: boolean;
  }> = [
    {
      label: "Analytics",
      emoji: "📊",
      href: "https://plausible.io/moomentum.events",
      external: true,
    },
    {
      label: "Errors",
      emoji: "🐛",
      href: "/admin/errors",
      external: false,
    },
    {
      label: "Uptime",
      emoji: "🟢",
      href: "https://uptimerobot.com/dashboard",
      external: true,
    },
  ];
  return (
    <div className="card p-5 md:p-6">
      <h2 className="font-bold mb-3">ניטור</h2>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <a
            key={it.label}
            href={it.href}
            target={it.external ? "_blank" : undefined}
            rel={it.external ? "noopener noreferrer" : undefined}
            className="rounded-xl p-3 text-center transition hover:-translate-y-0.5"
            style={{
              background:
                "color-mix(in srgb, var(--gold-100) 8%, transparent)",
              border: "1px solid var(--border-gold)",
              color: "var(--accent)",
            }}
          >
            <div className="text-2xl" aria-hidden>
              {it.emoji}
            </div>
            <div className="text-xs font-semibold mt-1">{it.label}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
