"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { useAppState } from "@/lib/store";
import { AISuggestionBanner } from "@/components/calendar/AISuggestionBanner";
import { CalendarMonth } from "@/components/calendar/CalendarMonth";
import { AppointmentSheet } from "@/components/calendar/AppointmentSheet";
import { SuggestionPopover } from "@/components/calendar/SuggestionPopover";
import { BrainOnboarding } from "@/components/calendar/BrainOnboarding";
import {
  listAppointments,
  type Appointment,
} from "@/lib/calendar/appointments";

/**
 * R67 (R56) — Calendar orchestrator.
 *
 * Responsibilities:
 *   - Fetch appointments once on mount (RLS-guarded list).
 *   - Hold sheet/popover/onboarding modal state.
 *   - Pass appointments + eventDate down to CalendarMonth.
 *   - Refetch (or merge) on save / accept / dismiss.
 *
 * R65's heatmap + AISuggestionBanner stay intact. The new layer is
 * the appointments + Brain.
 */

export function CalendarClient() {
  const { state, hydrated } = useAppState();

  // Plain computations — React Compiler auto-memoizes; manual useMemo
  // here tripped `react-hooks/preserve-manual-memoization` on the
  // optional-chain dep.
  const eventDateRaw = state.event?.date;
  let eventDate: Date | null = null;
  if (hydrated && eventDateRaw) {
    const d = new Date(eventDateRaw);
    if (!Number.isNaN(d.getTime())) eventDate = d;
  }

  let weddingTitle = "";
  if (state.event) {
    weddingTitle = state.event.partnerName
      ? `${state.event.hostName} & ${state.event.partnerName}`
      : (state.event.hostName ?? "");
  }

  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetEditing, setSheetEditing] = useState<Appointment | null>(null);
  const [sheetInitialDate, setSheetInitialDate] = useState<Date | undefined>(
    undefined,
  );
  const [popoverSuggestion, setPopoverSuggestion] =
    useState<Appointment | null>(null);

  // Imperative refetch handed to child callbacks (e.g. BrainOnboarding
  // onSeeded). setState in a .then() callback is async, so it doesn't
  // trip react-hooks/set-state-in-effect.
  const refetch = useCallback(() => {
    listAppointments().then(setAppointments);
  }, []);

  // Initial load. Same async-callback pattern; the `active` ref
  // prevents an updating-an-unmounted-component warning if the user
  // navigates away mid-fetch.
  useEffect(() => {
    let active = true;
    listAppointments().then((rows) => {
      if (active) setAppointments(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleAddClick = (date?: Date) => {
    setSheetEditing(null);
    setSheetInitialDate(date);
    setSheetOpen(true);
  };

  const handleAppointmentClick = (a: Appointment) => {
    setSheetEditing(a);
    setSheetInitialDate(undefined);
    setSheetOpen(true);
  };

  const handleSuggestionClick = (a: Appointment) => {
    setPopoverSuggestion(a);
  };

  const handleSaved = (saved: Appointment) => {
    setAppointments((prev) => {
      if (!prev) return [saved];
      const i = prev.findIndex((p) => p.id === saved.id);
      if (i === -1) return [...prev, saved];
      const copy = [...prev];
      copy[i] = saved;
      return copy;
    });
  };

  const handleDeleted = (id: string) => {
    setAppointments((prev) => (prev ?? []).filter((p) => p.id !== id));
  };

  const handleSuggestionAccepted = (saved: Appointment) => {
    handleSaved(saved);
    setPopoverSuggestion(null);
  };

  const handleSuggestionDismissed = (id: string) => {
    // Mark dismissed locally — easier than refetching.
    setAppointments((prev) =>
      (prev ?? []).map((a) =>
        a.id === id ? { ...a, ai_status: "dismissed" as const } : a,
      ),
    );
    setPopoverSuggestion(null);
  };

  // Edit-from-popover: close popover, open sheet pre-loaded with the
  // suggestion's current values (which are stored as a normal row).
  const handleEditFromPopover = (a: Appointment) => {
    setPopoverSuggestion(null);
    setSheetEditing(a);
    setSheetInitialDate(undefined);
    setSheetOpen(true);
  };

  // Filter out dismissed suggestions for display. Plain expression —
  // React Compiler auto-memoizes; useMemo here was redundant.
  const visibleAppointments = (appointments ?? []).filter(
    (a) => a.ai_status !== "dismissed",
  );

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
              ניהול זמן + חיסכון תאריכים
            </h1>
            <p
              className="mt-2 text-base leading-relaxed"
              style={{ color: "var(--foreground-soft)" }}
            >
              ה-heatmap מסמן ימים זולים וימי פיק. ✨ הם הצעות AI לפגישות
              לאורך 18 החודשים שלפני האירוע — אפשר לאשר, לערוך, או לדלג.
            </p>
          </div>

          <AISuggestionBanner />

          {appointments === null ? (
            <div className="flex justify-center py-20">
              <Loader2
                className="animate-spin"
                size={26}
                style={{ color: "var(--accent)" }}
                aria-label="טוען לוח שנה"
              />
            </div>
          ) : (
            <CalendarMonth
              appointments={visibleAppointments}
              eventDate={eventDate}
              weddingTitle={weddingTitle}
              onAddClick={handleAddClick}
              onAppointmentClick={handleAppointmentClick}
              onSuggestionClick={handleSuggestionClick}
            />
          )}
        </div>

        {/* First-visit Wedding Brain onboarding — only when the user has
            an event date (so we know how to anchor the timeline). */}
        {eventDate && <BrainOnboarding eventDate={eventDate} onSeeded={refetch} />}

        {sheetOpen && (
          <AppointmentSheet
            editing={sheetEditing}
            initialDate={sheetInitialDate}
            onClose={() => setSheetOpen(false)}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        )}

        {popoverSuggestion && (
          <SuggestionPopover
            suggestion={popoverSuggestion}
            onClose={() => setPopoverSuggestion(null)}
            onAccepted={handleSuggestionAccepted}
            onDismissed={handleSuggestionDismissed}
            onEdit={handleEditFromPopover}
          />
        )}
      </main>
    </>
  );
}
