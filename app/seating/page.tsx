"use client";

/**
 * R80 — Seating page rewritten on top of the new Seating Architect
 * canvas. The page itself is now a thin shell:
 *   • Header (title + stats + smart-arrange + PDF export).
 *   • ArchitectCanvas (the 2D top-down floor plan).
 *   • TableModal (still the "add table" flow — opened from the
 *     canvas toolbar OR the header).
 *   • Smart-arrangement modal (preserved from R71; still drives the
 *     seat assignments, doesn't touch positions).
 *
 * What this page does NOT do anymore:
 *   • The grid-rendered Table3D cards. The canvas replaces them
 *     entirely.
 *   • The "unassigned guests" side panel. It's now folded into the
 *     TableDetailsSheet inside the canvas (each selected table
 *     surfaces the unassigned list under "הוסף אורח קיים").
 *
 * Smart-arrange + accept-proposal flow is preserved verbatim because
 * it doesn't conflict with the canvas — it writes to seatAssignments,
 * which the canvas reads through props.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { EmptyEventState } from "@/components/EmptyEventState";
import { PrintButton } from "@/components/PrintButton";
import { SeatingSkeleton } from "@/components/skeletons/PageSkeletons";
import { ArchitectCanvas } from "@/components/seating/ArchitectCanvas";
import { useAppState, actions } from "@/lib/store";
import { useUser } from "@/lib/user";
import { useVendorRedirect } from "@/lib/useVendorRedirect";
import type { Guest, SeatingTable } from "@/lib/types";
import { smartArrangement, type TableExplanation } from "@/lib/seatingAlgorithm";
import {
  Plus,
  Users,
  ArrowRight,
  X,
  CheckCircle2,
  Sparkles,
  Crown,
  RefreshCw,
} from "lucide-react";

export default function SeatingPage() {
  const router = useRouter();
  const { state, hydrated } = useAppState();
  const { user, hydrated: userHydrated } = useUser();
  useVendorRedirect();

  const [showAddTable, setShowAddTable] = useState(false);

  useEffect(() => {
    if (userHydrated && !user) {
      router.replace("/signup");
    }
  }, [userHydrated, user, router]);

  const eligibleGuests = useMemo(
    () => state.guests.filter((g) => g.status !== "declined"),
    [state.guests],
  );

  const totals = useMemo(() => {
    let assigned = 0;
    let total = 0;
    for (const g of eligibleGuests) {
      const heads = g.attendingCount ?? 1;
      total += heads;
      if (state.seatAssignments[g.id]) assigned += heads;
    }
    return { assigned, total };
  }, [eligibleGuests, state.seatAssignments]);

  const pct = totals.total > 0 ? Math.round((totals.assigned / totals.total) * 100) : 0;

  // ─── Smart-arrange flow (preserved from R71) ─────────────────────
  const [thinking, setThinking] = useState(false);
  const [proposal, setProposal] = useState<{
    seed: number;
    assignments: Record<string, string>;
    explanations: TableExplanation[];
    unseated: Guest[];
  } | null>(null);
  const smartTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (smartTimeoutRef.current !== null) {
        window.clearTimeout(smartTimeoutRef.current);
      }
    };
  }, []);

  const runSmartArrangement = useCallback(
    (seed?: number) => {
      if (state.tables.length === 0) return;
      if (smartTimeoutRef.current !== null) {
        window.clearTimeout(smartTimeoutRef.current);
      }
      setProposal(null);
      setThinking(true);
      const usedSeed = seed ?? Date.now();
      const result = smartArrangement({
        guests: eligibleGuests,
        tables: state.tables,
        seed: usedSeed,
      });
      smartTimeoutRef.current = window.setTimeout(() => {
        smartTimeoutRef.current = null;
        setProposal({ seed: usedSeed, ...result });
        setThinking(false);
      }, 800);
    },
    [state.tables, eligibleGuests],
  );

  const acceptProposal = () => {
    if (!proposal) return;
    Object.keys(state.seatAssignments).forEach((gid) =>
      actions.assignSeat(gid, null),
    );
    for (const [gid, tid] of Object.entries(proposal.assignments)) {
      actions.assignSeat(gid, tid);
    }
    setProposal(null);
  };

  if (!hydrated) {
    return (
      <>
        <Header />
        <SeatingSkeleton />
      </>
    );
  }
  if (!state.event) return <EmptyEventState toolName="סידורי ההושבה" />;

  return (
    <>
      <Header />
      <main className="flex-1 pb-32 relative overflow-hidden">
        <div
          aria-hidden
          className="glow-orb glow-orb-gold w-[700px] h-[700px] -top-40 right-0 opacity-25"
        />

        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 relative z-10">
          <Link
            href="/dashboard"
            className="text-sm hover:text-white inline-flex items-center gap-1.5"
            style={{ color: "var(--foreground-muted)" }}
          >
            <ArrowRight size={14} /> חזרה למסע
          </Link>

          {/* Header row */}
          <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">סידורי הושבה</span>
              <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight gradient-text">
                סידור הושבה
              </h1>
              <p
                className="mt-2"
                style={{ color: "var(--foreground-soft)" }}
              >
                גרור שולחנות לפי תצוגה אמיתית של האולם — רחבת ריקודים, בר,
                במה. כל שולחן בגודל פרופורציוני למספר האורחים.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => runSmartArrangement()}
                disabled={
                  state.tables.length === 0 ||
                  eligibleGuests.length === 0 ||
                  thinking
                }
                className="btn-gold text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-40"
              >
                {thinking ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                {thinking ? "חושב..." : "✨ סדר אוטומטית"}
              </motion.button>
              <PrintButton label="ייצא ל-PDF" />
            </div>
          </div>

          {/* Stats — clean top strip */}
          <section
            className="card-gold mt-6 p-5 flex flex-wrap items-center justify-between gap-3"
            aria-label="סיכום סידורי הושבה"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                  color: "var(--gold-button-text)",
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <div
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  אורחים משובצים
                </div>
                <div className="text-xl font-bold ltr-num mt-0.5">
                  <span className="gradient-gold">{totals.assigned}</span>
                  <span style={{ color: "var(--foreground-muted)" }}>
                    {" / "}
                    {totals.total}
                  </span>
                  <span
                    className="text-xs ms-2 font-semibold"
                    style={{ color: "var(--foreground-soft)" }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
            </div>
            <div
              className="text-sm flex-1 max-w-md"
              style={{ color: "var(--foreground-soft)" }}
            >
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "var(--input-bg)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, var(--gold-100), var(--gold-500))",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <div className="mt-1.5 text-xs ltr-num text-end">
                <span className="font-semibold">{state.tables.length}</span>{" "}
                שולחנות
              </div>
            </div>
          </section>

          {/* Empty states */}
          {state.guests.length === 0 ? (
            <div
              className="card p-10 mt-8 text-center"
              style={{ color: "var(--foreground-muted)" }}
            >
              <p>
                עדיין אין מוזמנים.{" "}
                <Link
                  href="/guests"
                  className="text-[--accent] hover:underline"
                >
                  הוסף מוזמנים
                </Link>{" "}
                כדי להתחיל לסדר.
              </p>
            </div>
          ) : (
            <div className="mt-8">
              <ArchitectCanvas
                tables={state.tables}
                guests={state.guests}
                seatAssignments={state.seatAssignments}
                layout={state.event?.venueLayout}
                onAddTable={() => setShowAddTable(true)}
              />
            </div>
          )}
        </div>

        {showAddTable && (
          <TableModal onClose={() => setShowAddTable(false)} />
        )}
        <AnimatePresence>
          {thinking && <ThinkingOverlay key="thinking" />}
        </AnimatePresence>
        {proposal && (
          <ArrangementProposalModal
            proposal={proposal}
            tables={state.tables}
            guests={state.guests}
            onAccept={acceptProposal}
            onReroll={() => runSmartArrangement()}
            onClose={() => setProposal(null)}
          />
        )}
      </main>
    </>
  );
}

// ─────────────────────────────── Thinking overlay ───────────────────────────────

const THINKING_STAGES = [
  "מחפש זוגות שצריכים לשבת יחד...",
  "מאזן שולחנות לפי גודל...",
  "בודק התנגשויות בין קבוצות...",
  "מסיים סידור...",
] as const;

function ThinkingOverlay() {
  const [stageIdx, setStageIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setStageIdx((i) => (i < THINKING_STAGES.length - 1 ? i + 1 : i));
    }, 220);
    return () => window.clearInterval(id);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.94 }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      className="fixed bottom-6 right-6 z-50 max-w-xs pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className="card-gold p-4 pointer-events-auto"
        style={{
          background: "var(--surface-1)",
          boxShadow: "0 16px 40px -12px rgba(0,0,0,0.6)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="inline-flex w-10 h-10 rounded-full items-center justify-center shrink-0"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid var(--border-gold)",
            }}
          >
            <Sparkles
              size={18}
              className="text-[--accent] animate-pulse"
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold gradient-gold">
              מסדר את האורחים...
            </div>
            <div
              className="text-xs mt-0.5 truncate"
              style={{ color: "var(--foreground-soft)" }}
            >
              {THINKING_STAGES[stageIdx]}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────── Proposal modal ───────────────────────────────

function ArrangementProposalModal({
  proposal,
  tables,
  guests,
  onAccept,
  onReroll,
  onClose,
}: {
  proposal: {
    assignments: Record<string, string>;
    explanations: TableExplanation[];
    unseated: Guest[];
  };
  tables: SeatingTable[];
  guests: Guest[];
  onAccept: () => void;
  onReroll: () => void;
  onClose: () => void;
}) {
  const tableById = useMemo(
    () => new Map(tables.map((t) => [t.id, t])),
    [tables],
  );
  const guestById = useMemo(
    () => new Map(guests.map((g) => [g.id, g])),
    [guests],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const guestsByTable = useMemo(() => {
    const map = new Map<string, Guest[]>();
    Object.entries(proposal.assignments).forEach(([gid, tid]) => {
      const g = guestById.get(gid);
      if (!g) return;
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid)!.push(g);
    });
    return map;
  }, [proposal.assignments, guestById]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-labelledby="arrangement-title"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl scale-in"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-gold)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="p-6 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="pill pill-gold">
                <Sparkles size={11} /> סידור חכם
              </span>
              <h2
                id="arrangement-title"
                className="mt-2 text-2xl font-extrabold tracking-tight gradient-gold"
              >
                ההצעה שלי לסידור
              </h2>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--foreground-soft)" }}
              >
                לפי קבוצות, גילאים, ובקשות להושיב יחד.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="סגור"
              className="rounded-full w-9 h-9 flex items-center justify-center hover:bg-[var(--secondary-button-bg)]"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto p-6 space-y-3">
          {proposal.explanations.map((exp) => {
            const table = tableById.get(exp.tableId);
            if (!table) return null;
            const seatedGuests = guestsByTable.get(exp.tableId) ?? [];
            return (
              <div
                key={exp.tableId}
                className="rounded-2xl p-4"
                style={{
                  background: exp.isMainTable
                    ? "rgba(212,176,104,0.08)"
                    : "var(--input-bg)",
                  border: `1px solid ${exp.isMainTable ? "var(--border-gold)" : "var(--border)"}`,
                }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    {exp.isMainTable && (
                      <Crown
                        size={16}
                        className="text-[--accent]"
                        aria-hidden
                      />
                    )}
                    <h3 className="font-bold">
                      {table.label || table.name}
                      {exp.isMainTable && (
                        <span
                          className="text-xs font-normal ms-2"
                          style={{ color: "var(--accent)" }}
                        >
                          (שולחן ראשי)
                        </span>
                      )}
                    </h3>
                  </div>
                  <span
                    className="text-xs ltr-num"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    {exp.capacityUsed} / {exp.capacityTotal} מקומות
                  </span>
                </div>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  {exp.summary}
                </p>
                {seatedGuests.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {seatedGuests.map((g) => (
                      <span
                        key={g.id}
                        className="text-[11px] rounded-full px-2 py-0.5"
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          color: "var(--foreground-soft)",
                        }}
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {proposal.unseated.length > 0 && (
            <div
              className="rounded-2xl p-4"
              style={{
                background: "rgba(248,113,113,0.06)",
                border: "1px solid rgba(248,113,113,0.3)",
              }}
            >
              <h3
                className="font-bold text-sm"
                style={{ color: "rgb(252,165,165)" }}
              >
                ⚠️ לא הצלחתי להושיב {proposal.unseated.length} אורחים
              </h3>
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--foreground-soft)" }}
              >
                התנגשויות, חוסר מקום, או דרישות &quot;חייבים יחד&quot; שלא
                מסתדרות. אפשר להוסיף שולחן או לערוך ידנית.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {proposal.unseated.map((g) => (
                  <span
                    key={g.id}
                    className="text-[11px] rounded-full px-2 py-0.5"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer
          className="p-6 border-t flex flex-col sm:flex-row gap-3"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onAccept}
            className="flex-1 btn-gold py-3 inline-flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={16} />
            אהבתי — החל סידור
          </button>
          <button
            onClick={onReroll}
            className="flex-1 btn-secondary py-3 inline-flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} />
            נסה הצעה אחרת
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────── Add-table modal ───────────────────────────────
// Trimmed-down version of the R71 modal: name + capacity + circle.
// Position is auto-assigned at the canvas center for new tables
// (TableElement renders new ones in the middle; the host drags from
// there).

function TableModal({ onClose }: { onClose: () => void }) {
  const { state } = useAppState();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("10");
  const [circle, setCircle] = useState("");
  const suggestedNumber =
    state.tables.reduce((max, t) => Math.max(max, t.number ?? 0), 0) + 1;
  const [numberInput, setNumberInput] = useState(String(suggestedNumber));
  const parsedNumber = Number.parseInt(numberInput, 10);
  const numberValid =
    numberInput.trim() === "" ||
    (!Number.isNaN(parsedNumber) && parsedNumber > 0);
  const duplicateNumber = useMemo(
    () =>
      numberValid &&
      numberInput.trim() !== "" &&
      state.tables.some((t) => t.number === parsedNumber),
    [numberValid, numberInput, parsedNumber, state.tables],
  );
  const isValid =
    name.trim().length > 0 &&
    Number(capacity) > 0 &&
    numberValid &&
    !duplicateNumber;

  const circleSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const g of state.guests) {
      if (g.circle?.trim()) set.add(g.circle.trim());
    }
    for (const t of state.tables) {
      if (t.circle?.trim()) set.add(t.circle.trim());
    }
    return Array.from(set).sort();
  }, [state.guests, state.tables]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    if (!isValid) return;
    const numberForSave =
      numberInput.trim() === "" ? undefined : parsedNumber;
    const newTable = actions.addTable(
      name.trim(),
      Number(capacity),
      numberForSave,
    );
    if (circle.trim()) {
      actions.updateTable(newTable.id, { circle: circle.trim() });
    }
    // Drop the new table near the canvas center so it sits visibly above
    // the dance floor — the host drags it to its real slot.
    actions.updateTable(newTable.id, {
      positionX: 600 + Math.round((Math.random() - 0.5) * 80),
      positionY: 130 + Math.round((Math.random() - 0.5) * 40),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card glass-strong p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Plus size={20} className="text-[--accent]" />
          <h3 className="text-xl font-bold">שולחן חדש</h3>
        </div>
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <div>
              <label
                className="block text-sm mb-1.5"
                style={{ color: "var(--foreground-soft)" }}
              >
                מספר
              </label>
              <input
                className="input text-center text-xl font-extrabold ltr-num"
                inputMode="numeric"
                type="number"
                min={1}
                value={numberInput}
                onChange={(e) =>
                  setNumberInput(e.target.value.replace(/[^\d]/g, ""))
                }
                aria-invalid={duplicateNumber || !numberValid}
              />
            </div>
            <div>
              <label
                className="block text-sm mb-1.5"
                style={{ color: "var(--foreground-soft)" }}
              >
                שם השולחן
              </label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: משפחת כלה, חברי כיתה..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isValid) save();
                }}
              />
            </div>
          </div>
          {duplicateNumber && (
            <div
              className="text-xs rounded-xl p-2"
              style={{
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "rgb(252,165,165)",
              }}
            >
              כבר קיים שולחן עם המספר הזה. בחר מספר אחר.
            </div>
          )}
          <div>
            <label
              htmlFor="table-capacity"
              className="block text-sm mb-1.5"
              style={{ color: "var(--foreground-soft)" }}
            >
              מקומות (כמה אנשים יושבים)
            </label>
            <input
              id="table-capacity"
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div>
            <label
              className="block text-sm mb-1.5"
              style={{ color: "var(--foreground-soft)" }}
            >
              חוג חברתי{" "}
              <span
                className="text-xs"
                style={{ color: "var(--foreground-muted)" }}
              >
                (אופציונלי)
              </span>
            </label>
            <input
              className="input"
              list="table-circle-suggestions"
              value={circle}
              onChange={(e) => setCircle(e.target.value)}
              placeholder="חברים מהצבא / משפחה רחוקה / חברי כיתה י׳"
              maxLength={60}
            />
            {circleSuggestions.length > 0 && (
              <datalist id="table-circle-suggestions">
                {circleSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            ביטול
          </button>
          <button
            onClick={save}
            disabled={!isValid}
            className="btn-gold disabled:opacity-40"
          >
            הוסף
          </button>
        </div>
      </div>
    </div>
  );
}
