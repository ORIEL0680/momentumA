"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AdminGuard, useAdminToken } from "@/components/admin/AdminGuard";
import type { AdminUserRow } from "@/lib/admin/types";
import { Loader2, AlertCircle, Search, ArrowRight, ChevronLeft } from "lucide-react";

export default function AdminUsersPage() {
  return (
    <AdminGuard returnTo="/admin/users">
      <Inner />
    </AdminGuard>
  );
}

function Inner() {
  const token = useAdminToken();
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
          signal: c.signal,
        });
        const data = (await res.json()) as
          | { users: AdminUserRow[] }
          | { error: string };
        if (!res.ok) {
          setError("error" in data ? data.error : "שגיאה בטעינה");
          return;
        }
        setRows((data as { users: AdminUserRow[] }).users);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("שגיאה בטעינה");
      }
    })();
    return () => c.abort();
  }, [token]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.email ?? "").toLowerCase().includes(s) ||
        (r.event_title ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

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
        <h1 className="mt-4 text-3xl font-bold gradient-text">משתמשים</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground-soft)" }}>
          {rows ? `${rows.length} משתמשים רשומים` : "טוען…"}
        </p>

        <div className="relative mt-6 mb-4 max-w-md">
          <Search
            size={16}
            className="absolute end-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--foreground-muted)" }}
          />
          <input
            className="input pe-10 !py-2.5 text-sm w-full"
            placeholder="חיפוש לפי מייל או שם אירוע…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {error && (
          <div
            className="card p-5 flex items-center gap-3"
            style={{ border: "1px solid rgba(239,68,68,0.25)" }}
          >
            <AlertCircle size={18} className="text-red-300 shrink-0" />
            <span style={{ color: "var(--foreground-soft)" }}>{error}</span>
          </div>
        )}

        {!rows && !error && (
          <div className="flex justify-center py-20">
            <Loader2
              className="animate-spin"
              size={26}
              style={{ color: "var(--accent)" }}
            />
          </div>
        )}

        {rows && (
          <div className="space-y-2">
            {filtered.map((r) => (
              <Link
                key={r.id}
                href={`/admin/users/${r.id}`}
                className="card p-4 flex items-center gap-3 transition hover:-translate-y-0.5"
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center font-semibold shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                    color: "var(--gold-button-text)",
                  }}
                  aria-hidden
                >
                  {(r.email ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate ltr-num">
                    {r.email ?? "—"}
                  </span>
                  <span
                    className="block text-xs truncate"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    {r.event_title ?? "אין אירוע מסונכרן"}
                    {r.created_at
                      ? ` · נרשם ${new Date(r.created_at).toLocaleDateString("he-IL", { day: "2-digit", month: "short", year: "2-digit" })}`
                      : ""}
                  </span>
                </span>
                <ChevronLeft
                  size={16}
                  style={{ color: "var(--foreground-muted)" }}
                  aria-hidden
                />
              </Link>
            ))}
            {filtered.length === 0 && (
              <div
                className="card p-8 text-center text-sm"
                style={{ color: "var(--foreground-muted)" }}
              >
                לא נמצאו משתמשים תואמים.
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
