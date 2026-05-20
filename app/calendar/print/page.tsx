"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Printer } from "lucide-react";
import { useAppState } from "@/lib/store";
import { useNow, daysUntil } from "@/lib/useNow";
import {
  listAppointments,
  type Appointment,
} from "@/lib/calendar/appointments";
import { formatHebrewDate } from "@/lib/calendar/hebrew-calendar";
import { APPOINTMENT_TEMPLATES } from "@/lib/calendar/appointment-templates";

/**
 * R68 (R57) — print-friendly calendar view.
 *
 * Plain table of all upcoming appointments + a header with the wedding
 * title and countdown. The `@media print` block hides everything that
 * isn't the table (the page chrome, the "back" link, the print button)
 * so `window.print()` lands on a clean A4 sheet.
 */

interface PrintRow {
  iso: string;
  date: Date;
  appt: Appointment;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function categoryIcon(cat: string): string {
  const tpl = APPOINTMENT_TEMPLATES.find((t) => t.category === cat);
  return tpl?.icon ?? "•";
}

export default function CalendarPrintPage() {
  const { state, hydrated } = useAppState();
  const nowMs = useNow();
  const [rows, setRows] = useState<PrintRow[] | null>(null);

  // Future rows only.
  useEffect(() => {
    let active = true;
    listAppointments().then((all) => {
      if (!active) return;
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const futureRows = all
        .filter((a) => a.ai_status !== "dismissed")
        .filter((a) => a.ai_status !== "pending")
        .map((a) => {
          const d = new Date(a.start_at);
          return { iso: isoDay(d), date: d, appt: a };
        })
        .filter((r) => r.date.getTime() >= now.getTime())
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      setRows(futureRows);
    });
    return () => {
      active = false;
    };
  }, []);

  const eventDate = state.event?.date ? new Date(state.event.date) : null;
  const days = eventDate ? daysUntil(state.event!.date, nowMs) : null;
  const title = state.event
    ? state.event.partnerName
      ? `${state.event.hostName} & ${state.event.partnerName}`
      : state.event.hostName
    : "";

  return (
    <main className="min-h-screen py-10 print-page">
      <style>{`
        @media print {
          body { background: white !important; color: #000 !important; }
          .print-hide { display: none !important; }
          .print-page { padding: 0 !important; }
          .print-card {
            background: white !important;
            color: #000 !important;
            border: 1px solid #999 !important;
            box-shadow: none !important;
          }
          .print-table th, .print-table td {
            border-bottom: 1px solid #ccc !important;
          }
          @page { size: A4 portrait; margin: 18mm 14mm; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <div className="print-hide">
          <Link
            href="/calendar"
            className="text-sm inline-flex items-center gap-1.5"
            style={{ color: "var(--foreground-muted)" }}
          >
            <ArrowRight size={14} aria-hidden /> חזרה ללוח
          </Link>
        </div>

        <header className="mt-6 mb-6">
          <div
            className="text-xs uppercase tracking-wider"
            style={{ color: "var(--foreground-muted)" }}
          >
            לוח החתונה
          </div>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold">
            {title || "האירוע שלך"}
          </h1>
          {hydrated && eventDate && (
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--foreground-soft)" }}
            >
              <span className="ltr-num">
                {eventDate.toLocaleDateString("he-IL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  weekday: "long",
                })}
              </span>
              {" · "}
              <span>{formatHebrewDate(eventDate)}</span>
              {days != null && days > 0 && (
                <>
                  {" · "}
                  <span className="ltr-num">{days}</span> ימים לאירוע
                </>
              )}
            </p>
          )}
        </header>

        <div className="print-hide mb-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-gold inline-flex items-center gap-2"
            style={{ padding: "0.5rem 1.1rem" }}
          >
            <Printer size={14} aria-hidden /> הדפס עכשיו
          </button>
        </div>

        <section className="print-card card-gold p-5 md:p-6">
          {rows === null ? (
            <p
              className="text-sm py-6 text-center"
              style={{ color: "var(--foreground-muted)" }}
            >
              טוען…
            </p>
          ) : rows.length === 0 ? (
            <p
              className="text-sm py-6 text-center"
              style={{ color: "var(--foreground-muted)" }}
            >
              אין פגישות עתידיות. הוסיפו פגישות בלוח השנה ואז הדפיסו.
            </p>
          ) : (
            <table
              className="print-table w-full text-sm"
              style={{ borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  <Th>תאריך</Th>
                  <Th>שעה</Th>
                  <Th>פגישה</Th>
                  <Th>מיקום</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.appt.id}>
                    <Td>
                      <div className="ltr-num">
                        {r.date.toLocaleDateString("he-IL", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          weekday: "short",
                        })}
                      </div>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        {formatHebrewDate(r.date)}
                      </div>
                    </Td>
                    <Td>
                      <span className="ltr-num">
                        {r.date.toLocaleTimeString("he-IL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </Td>
                    <Td>
                      <span aria-hidden className="me-1.5">
                        {categoryIcon(r.appt.category)}
                      </span>
                      {r.appt.title}
                    </Td>
                    <Td>{r.appt.location ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-start font-bold text-xs uppercase tracking-wider py-2 px-3"
      style={{
        color: "var(--foreground-muted)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      className="py-3 px-3 align-top"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {children}
    </td>
  );
}
