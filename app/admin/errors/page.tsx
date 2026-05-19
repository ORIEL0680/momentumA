"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AdminGuard, useAdminToken } from "@/components/admin/AdminGuard";
import type { AdminErrorRow } from "@/lib/admin/types";
import {
  Loader2,
  AlertCircle,
  ArrowRight,
  Search,
  ChevronDown,
} from "lucide-react";

const FILTERS = ["all", "auth", "db", "api", "unknown"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = {
  all: "הכל",
  auth: "auth",
  db: "db",
  api: "api",
  unknown: "unknown",
};

export default function AdminErrorsPage() {
  return (
    <AdminGuard returnTo="/admin/errors">
      <Inner />
    </AdminGuard>
  );
}

function Inner() {
  const token = useAdminToken();
  const [rows, setRows] = useState<AdminErrorRow[] | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        const url =
          filter === "all"
            ? "/api/admin/errors"
            : `/api/admin/errors?type=${filter}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: c.signal,
        });
        const data = (await res.json()) as
          | { errors: AdminErrorRow[]; table_missing: boolean }
          | { error: string };
        if (!res.ok) {
          setError("error" in data ? data.error : "שגיאה בטעינה");
          return;
        }
        const ok = data as { errors: AdminErrorRow[]; table_missing: boolean };
        setTableMissing(ok.table_missing);
        setRows(ok.errors);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("שגיאה בטעינה");
      }
    })();
    return () => c.abort();
  }, [token, filter]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.message.toLowerCase().includes(s));
  }, [rows, q]);

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
        <h1 className="mt-4 text-3xl font-bold gradient-text">שגיאות</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground-soft)" }}>
          100 השגיאות האחרונות
        </p>

        <div className="flex flex-wrap gap-2 mt-6 mb-3">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs rounded-full px-3.5 py-1.5 transition"
              style={{
                border:
                  filter === f
                    ? "1px solid var(--border-gold)"
                    : "1px solid var(--border)",
                background:
                  filter === f
                    ? "color-mix(in srgb, var(--gold-100) 14%, transparent)"
                    : "transparent",
                color:
                  filter === f ? "var(--accent)" : "var(--foreground-soft)",
              }}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>

        <div className="relative mb-4 max-w-md">
          <Search
            size={16}
            className="absolute end-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--foreground-muted)" }}
          />
          <input
            className="input pe-10 !py-2.5 text-sm w-full"
            placeholder="חיפוש בהודעת השגיאה…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {tableMissing && (
          <div
            className="card p-4 mb-4 text-sm"
            style={{ border: "1px solid var(--border-gold)" }}
          >
            טבלת <code className="ltr-num">error_logs</code> עדיין לא נוצרה.
            הריצו את המיגרציה{" "}
            <code className="ltr-num">
              supabase/migrations/2026-05-19-error-logs.sql
            </code>{" "}
            ב-Supabase כדי להתחיל לתעד שגיאות.
          </div>
        )}

        {error && (
          <div
            className="card p-4 flex items-center gap-3"
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

        {rows && !tableMissing && filtered.length === 0 && (
          <div
            className="card p-10 text-center text-sm"
            style={{ color: "var(--foreground-muted)" }}
          >
            אין שגיאות 🎉
          </div>
        )}

        {rows && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((r) => {
              const isOpen = open === r.id;
              return (
                <div key={r.id} className="card p-0 overflow-hidden">
                  <button
                    onClick={() => setOpen(isOpen ? null : r.id)}
                    className="w-full text-start p-4 flex items-center gap-3"
                  >
                    <span
                      className="text-[10px] uppercase rounded-md px-2 py-1 shrink-0 ltr-num"
                      style={{
                        background:
                          "color-mix(in srgb, var(--gold-100) 14%, transparent)",
                        color: "var(--accent)",
                      }}
                    >
                      {r.type}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">
                        {r.message}
                      </span>
                      <span
                        className="block text-xs ltr-num"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        {new Date(r.created_at).toLocaleString("he-IL", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {r.frequency > 1 ? ` · ×${r.frequency}` : ""}
                        {r.url ? ` · ${r.url}` : ""}
                      </span>
                    </span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      style={{ color: "var(--foreground-muted)" }}
                      aria-hidden
                    />
                  </button>
                  {isOpen && (
                    <div
                      className="px-4 pb-4 text-xs space-y-2"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <div className="pt-3">
                        <span style={{ color: "var(--foreground-muted)" }}>
                          הודעה מלאה:
                        </span>
                        <div className="mt-1 break-words">{r.message}</div>
                      </div>
                      {r.user_id && (
                        <Link
                          href={`/admin/users/${r.user_id}`}
                          className="inline-block ltr-num"
                          style={{ color: "var(--accent)" }}
                        >
                          משתמש: {r.user_id}
                        </Link>
                      )}
                      {r.stack && (
                        <pre
                          className="mt-1 p-3 rounded-lg overflow-x-auto ltr-num text-[11px] whitespace-pre-wrap"
                          style={{ background: "var(--input-bg)" }}
                        >
                          {r.stack}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
