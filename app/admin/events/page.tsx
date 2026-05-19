"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AdminGuard, useAdminToken } from "@/components/admin/AdminGuard";
import type { AdminStats } from "@/lib/admin/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";

export default function AdminEventsPage() {
  return (
    <AdminGuard returnTo="/admin/events">
      <Inner />
    </AdminGuard>
  );
}

function Inner() {
  const token = useAdminToken();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/admin/stats", {
          headers: { Authorization: `Bearer ${token}` },
          signal: c.signal,
        });
        const data = (await res.json()) as AdminStats | { error: string };
        if (!res.ok) {
          setError("error" in data ? data.error : "שגיאה בטעינה");
          return;
        }
        setStats(data as AdminStats);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("שגיאה בטעינה");
      }
    })();
    return () => c.abort();
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
        <h1 className="mt-4 text-3xl font-bold gradient-text">אירועים</h1>

        {error && (
          <div
            className="mt-6 card p-4 flex items-center gap-3"
            style={{ border: "1px solid rgba(239,68,68,0.25)" }}
          >
            <AlertCircle size={18} className="text-red-300 shrink-0" />
            <span style={{ color: "var(--foreground-soft)" }}>{error}</span>
          </div>
        )}

        {!stats && !error && (
          <div className="flex justify-center py-20">
            <Loader2
              className="animate-spin"
              size={26}
              style={{ color: "var(--accent)" }}
            />
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-3 gap-4 mt-7">
              <Box label="סה״כ מסונכרנים" value={stats.events.total} />
              <Box label="פעילים (30 ימים)" value={stats.events.active} />
              <Box label="חדשים השבוע" value={stats.events.new_this_week} />
            </div>

            <h2 className="mt-10 mb-4 font-bold text-lg">אירועים קרובים</h2>
            {stats.upcoming_events.length === 0 ? (
              <div
                className="card p-8 text-center text-sm"
                style={{ color: "var(--foreground-muted)" }}
              >
                אין אירועים עתידיים מסונכרנים כרגע.
              </div>
            ) : (
              <div className="space-y-2">
                {stats.upcoming_events.map((e) => (
                  <Link
                    key={`${e.userId}-${e.date}`}
                    href={`/admin/users/${e.userId}`}
                    className="card p-4 flex items-center gap-3 transition hover:-translate-y-0.5"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold truncate">
                        {e.title}
                      </span>
                      <span
                        className="block text-xs"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        {(EVENT_TYPE_LABELS as Record<string, string>)[
                          e.type
                        ] ?? "אירוע"}{" "}
                        · {e.guests} מוזמנים
                      </span>
                    </span>
                    <span
                      className="text-xs ltr-num shrink-0"
                      style={{ color: "var(--foreground-soft)" }}
                    >
                      {new Date(e.date).toLocaleDateString("he-IL", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function Box({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-gold p-5 text-center">
      <div className="text-3xl font-extrabold gradient-gold ltr-num">
        {value}
      </div>
      <div
        className="mt-1 text-xs"
        style={{ color: "var(--foreground-soft)" }}
      >
        {label}
      </div>
    </div>
  );
}
