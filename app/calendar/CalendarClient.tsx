"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { AISuggestionBanner } from "@/components/calendar/AISuggestionBanner";
import { CalendarMonth } from "@/components/calendar/CalendarMonth";

/**
 * R65 (R55) — calendar MVP client shell.
 *
 * What this ships:
 *   - Month view with Israeli pricing heatmap (Shabbat/chag blocked,
 *     season + day-of-week + Hebrew-month multipliers).
 *   - Hover/select to see the per-day breakdown.
 *   - AI suggestion banner reading the user's event date from
 *     app_states.payload.event — proposes a cheaper nearby date.
 *
 * What is explicitly NOT in MVP (deferred to a follow-up round):
 *   - Appointment CRUD (DB table + AppointmentSheet).
 *   - Push notifications (service worker + VAPID + Vercel-Pro cron).
 *   - Vendor "schedule meeting" integration.
 *   - Day-view agenda.
 *   - Google Places autocomplete for meeting locations.
 *
 * See TASKLIST.R65.md for the scope rationale.
 */

export function CalendarClient() {
  return (
    <>
      <Header />
      <main className="flex-1 pb-28 relative">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 pt-6">
          <Link
            href="/dashboard"
            className="text-sm inline-flex items-center gap-1.5"
            style={{ color: "var(--foreground-muted)" }}
          >
            <ArrowRight size={14} aria-hidden /> חזרה למסע
          </Link>

          <div className="mt-5 mb-7">
            <span className="eyebrow">לוח שנה</span>
            <h1 className="mt-2 text-4xl font-bold gradient-text">
              חיסכון תאריכים
            </h1>
            <p
              className="mt-2 text-base leading-relaxed"
              style={{ color: "var(--foreground-soft)" }}
            >
              ה-heatmap מסמן ימים זולים וימי פיק לפי עונה, יום בשבוע,
              חגים, ושבת. בחרו תאריך כדי לראות פירוט.
            </p>
          </div>

          <AISuggestionBanner />
          <CalendarMonth />
        </div>
      </main>
    </>
  );
}
