"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AdminGuard, useAdminToken } from "@/components/admin/AdminGuard";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";

interface UserDetail {
  user: {
    id: string;
    email: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
  };
  event: {
    title: string | null;
    type: string | null;
    date: string | null;
    guests: number;
    last_sync: string | null;
  };
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AdminGuard returnTo={`/admin/users/${id}`}>
      <Inner id={id} />
    </AdminGuard>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Inner({ id }: { id: string }) {
  const token = useAdminToken();
  const [data, setData] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/users?id=${encodeURIComponent(id)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: c.signal,
          },
        );
        const json = (await res.json()) as UserDetail | { error: string };
        if (!res.ok) {
          setError("error" in json ? json.error : "שגיאה בטעינה");
          return;
        }
        setData(json as UserDetail);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("שגיאה בטעינה");
      }
    })();
    return () => c.abort();
  }, [id, token]);

  const typeLabel = data?.event.type
    ? ((EVENT_TYPE_LABELS as Record<string, string>)[data.event.type] ??
      "אירוע")
    : "—";

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10">
        <Link
          href="/admin/users"
          className="text-sm inline-flex items-center gap-1.5"
          style={{ color: "var(--foreground-muted)" }}
        >
          <ArrowRight size={14} /> חזרה לרשימת המשתמשים
        </Link>

        {error && (
          <div
            className="mt-6 card p-5 flex items-center gap-3"
            style={{ border: "1px solid rgba(239,68,68,0.25)" }}
          >
            <AlertCircle size={18} className="text-red-300 shrink-0" />
            <span style={{ color: "var(--foreground-soft)" }}>{error}</span>
          </div>
        )}

        {!data && !error && (
          <div className="flex justify-center py-20">
            <Loader2
              className="animate-spin"
              size={26}
              style={{ color: "var(--accent)" }}
            />
          </div>
        )}

        {data && (
          <>
            <h1 className="mt-5 text-3xl font-bold gradient-text ltr-num">
              {data.user.email ?? "—"}
            </h1>
            <p
              className="mt-1 text-xs ltr-num"
              style={{ color: "var(--foreground-muted)" }}
            >
              {data.user.id}
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mt-7">
              <Field label="נרשם" value={fmt(data.user.created_at)} />
              <Field
                label="כניסה אחרונה"
                value={fmt(data.user.last_sign_in_at)}
              />
            </div>

            <div className="card-gold p-6 mt-6">
              <h2 className="font-bold mb-4">האירוע של המשתמש</h2>
              {data.event.title ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="שם" value={data.event.title} />
                  <Field label="סוג" value={typeLabel} />
                  <Field
                    label="תאריך"
                    value={
                      data.event.date
                        ? new Date(data.event.date).toLocaleDateString(
                            "he-IL",
                            { day: "2-digit", month: "long", year: "numeric" },
                          )
                        : "—"
                    }
                  />
                  <Field
                    label="מוזמנים"
                    value={String(data.event.guests)}
                  />
                  <Field
                    label="סנכרון אחרון"
                    value={fmt(data.event.last_sync)}
                  />
                </div>
              ) : (
                <p
                  className="text-sm"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  למשתמש זה אין אירוע מסונכרן בענן (עובד מקומית בלבד או טרם
                  יצר אירוע).
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
        {label}
      </div>
      <div className="mt-1 font-semibold ltr-num">{value}</div>
    </div>
  );
}
