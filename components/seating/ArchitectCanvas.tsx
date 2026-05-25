"use client";

/**
 * R80 + R81 — Seating Architect canvas.
 *
 * 2D top-down floor plan with draggable tables AND draggable venue
 * zones (dance floor / stage / bar / entrance) in edit mode. R81
 * fixes the R80 drag bugs (pointer capture on the wrong element +
 * transform collision with framer's animate), repaints the canvas
 * in pure gold/black, and adds the "ערוך אולם" toggle.
 *
 * Architecture (unchanged from R80):
 *   • <svg> sized to a 1200×800 viewBox.
 *   • CSS-scaled wrapper for zoom (50–200%).
 *   • TableElement / VenueZones each handle their own pointer-event
 *     drag. The canvas just collects positions + autosaves.
 *   • Autosave: every move is committed immediately to the store; a
 *     1.2s toast confirms.
 *   • Undo stack: 20-deep state-driven, Cmd/Ctrl-Z replays.
 */

import {
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Check } from "lucide-react";
import { actions } from "@/lib/store";
import type { Guest, SeatingTable, VenueLayout } from "@/lib/types";
import { ParquetBackground } from "./ParquetBackground";
import { VenueZones } from "./VenueZones";
import { TableElement } from "./TableElement";
import { CanvasToolbar, ZOOM_LIMITS } from "./CanvasToolbar";
import { TableDetailsSheet } from "./TableDetailsSheet";
import { autoArrangeTables } from "@/lib/seating-auto-arrange";

const CANVAS_W = 1200;
const CANVAS_H = 800;
const AUTOSAVE_TOAST_MS = 1200;
const UNDO_DEPTH = 20;

interface Props {
  tables: SeatingTable[];
  guests: Guest[];
  seatAssignments: Record<string, string>;
  layout?: VenueLayout;
  onAddTable: () => void;
}

interface UndoEntry {
  kind: "table";
  tableId: string;
  prevX: number;
  prevY: number;
}

export function ArchitectCanvas({
  tables,
  guests,
  seatAssignments,
  layout,
  onAddTable,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const toastTimerRef = useRef<number | null>(null);

  // ─── Auto-seed positions for tables created before R80 ───────────
  // Tables without positionX/Y would all render at the canvas center
  // and stack on top of each other. Auto-arrange seeds them once on
  // first paint; tables the host has already moved keep their slot.
  useEffect(() => {
    const missing = tables.filter(
      (t) => t.positionX === undefined || t.positionY === undefined,
    );
    if (missing.length === 0) return;
    const positions = autoArrangeTables(tables, layout);
    for (const t of missing) {
      const p = positions.get(t.id);
      if (p) {
        actions.updateTable(t.id, { positionX: p.x, positionY: p.y });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.length, layout]);

  // ─── Live "seated count" per table ───────────────────────────────
  const seatedByTable = useMemo(() => {
    const map = new Map<string, Guest[]>();
    for (const g of guests) {
      const tid = seatAssignments[g.id];
      if (!tid) continue;
      const arr = map.get(tid) ?? [];
      arr.push(g);
      map.set(tid, arr);
    }
    return map;
  }, [guests, seatAssignments]);

  const headsAt = useCallback(
    (tableId: string) => {
      const list = seatedByTable.get(tableId) ?? [];
      return list.reduce((s, g) => s + (g.attendingCount ?? 1), 0);
    },
    [seatedByTable],
  );

  const unassigned = useMemo(
    () =>
      guests.filter(
        (g) => g.status !== "declined" && !seatAssignments[g.id],
      ),
    [guests, seatAssignments],
  );

  // ─── Toast ────────────────────────────────────────────────────────
  const flashToast = useCallback((msg: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(msg);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, AUTOSAVE_TOAST_MS);
  }, []);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // ─── Table move + undo ───────────────────────────────────────────
  const moveTable = useCallback(
    (table: SeatingTable, x: number, y: number) => {
      const prevX = table.positionX ?? CANVAS_W / 2;
      const prevY = table.positionY ?? CANVAS_H / 2;
      if (prevX === x && prevY === y) return;
      setUndoStack((s) => {
        const next: UndoEntry[] = [
          ...s,
          { kind: "table", tableId: table.id, prevX, prevY },
        ];
        return next.length > UNDO_DEPTH ? next.slice(-UNDO_DEPTH) : next;
      });
      actions.updateTable(table.id, { positionX: x, positionY: y });
      flashToast("✓ נשמר");
    },
    [flashToast],
  );

  const undo = useCallback(() => {
    setUndoStack((s) => {
      if (s.length === 0) return s;
      const entry = s[s.length - 1];
      actions.updateTable(entry.tableId, {
        positionX: entry.prevX,
        positionY: entry.prevY,
      });
      flashToast("↶ בוטל");
      return s.slice(0, -1);
    });
  }, [flashToast]);

  // ─── Layout change (zone drag) ───────────────────────────────────
  const handleLayoutChange = useCallback(
    (next: VenueLayout) => {
      actions.patchEvent({ venueLayout: next });
      flashToast("✓ נשמר");
    },
    [flashToast],
  );

  // ─── Reset positions ─────────────────────────────────────────────
  const resetPositions = useCallback(() => {
    if (tables.length === 0) return;
    if (
      !confirm(
        `לארגן מחדש את ${tables.length} השולחנות לפי גריד אוטומטי? המיקומים הנוכחיים יישמרו ב-Undo.`,
      )
    ) {
      return;
    }
    const positions = autoArrangeTables(tables, layout);
    const newEntries: UndoEntry[] = [];
    for (const t of tables) {
      const p = positions.get(t.id);
      if (!p) continue;
      const prevX = t.positionX ?? CANVAS_W / 2;
      const prevY = t.positionY ?? CANVAS_H / 2;
      newEntries.push({
        kind: "table",
        tableId: t.id,
        prevX,
        prevY,
      });
      actions.updateTable(t.id, { positionX: p.x, positionY: p.y });
    }
    setUndoStack((s) => {
      const next = [...s, ...newEntries];
      return next.length > UNDO_DEPTH ? next.slice(-UNDO_DEPTH) : next;
    });
    flashToast(`✓ סודרו ${tables.length} שולחנות`);
  }, [tables, layout, flashToast]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isInput) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key === "Escape" && selectedTableId) {
        setSelectedTableId(null);
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) =>
          Math.min(
            ZOOM_LIMITS.max,
            Number((z + ZOOM_LIMITS.step).toFixed(2)),
          ),
        );
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) =>
          Math.max(
            ZOOM_LIMITS.min,
            Number((z - ZOOM_LIMITS.step).toFixed(2)),
          ),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, selectedTableId]);

  // ─── Canvas background click → deselect ──────────────────────────
  const onCanvasClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setSelectedTableId(null);
    }
  }, []);

  const selectedTable = useMemo(
    () =>
      selectedTableId
        ? tables.find((t) => t.id === selectedTableId) ?? null
        : null,
    [selectedTableId, tables],
  );
  const selectedDisplayNumber = useMemo(() => {
    if (!selectedTable) return 0;
    const i = tables.findIndex((t) => t.id === selectedTable.id);
    return selectedTable.number ?? i + 1;
  }, [selectedTable, tables]);

  return (
    <div className="architect-root">
      {/* Toolbar row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <CanvasToolbar
          zoom={zoom}
          onZoomChange={setZoom}
          onAddTable={onAddTable}
          onResetPositions={resetPositions}
          canUndo={undoStack.length > 0}
          onUndo={undo}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <motion.button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            aria-pressed={editMode}
            whileTap={{ scale: 0.96 }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition"
            style={
              editMode
                ? {
                    background:
                      "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                    color: "var(--gold-button-text)",
                  }
                : {
                    background: "rgba(20,14,8,0.6)",
                    border: "1px solid var(--border-gold)",
                    color: "var(--accent)",
                  }
            }
          >
            {editMode ? <Check size={13} /> : <Pencil size={13} />}
            {editMode ? "סיים עריכה" : "ערוך אולם"}
          </motion.button>
          <span
            className="hidden lg:block text-xs"
            style={{ color: "var(--foreground-muted)" }}
          >
            {editMode
              ? "💎 גרור את הרחבה / בר / במה / כניסה לפי האולם האמיתי"
              : "💡 גרור שולחן · לחץ לבחירה · Cmd/Ctrl+Z לביטול"}
          </span>
        </div>
      </div>

      <div
        className="architect-viewport relative w-full rounded-3xl overflow-auto"
        style={{
          border: "1px solid var(--border-gold)",
          background: "#08070A",
          boxShadow:
            "0 24px 48px -20px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(212,176,104,0.08)",
          maxHeight: "min(78vh, 720px)",
        }}
        onClick={onCanvasClick}
      >
        <div
          style={{
            width: `${CANVAS_W * zoom}px`,
            height: `${CANVAS_H * zoom}px`,
            maxWidth: zoom === 1 ? "100%" : undefined,
            margin: zoom === 1 ? "0 auto" : undefined,
            transition: "width 220ms ease, height 220ms ease",
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            preserveAspectRatio="xMidYMid meet"
            width="100%"
            height="100%"
            role="application"
            aria-label="תכנון רחבת האירוע"
            style={{ display: "block" }}
          >
            <ParquetBackground width={CANVAS_W} height={CANVAS_H} />
            <VenueZones
              layout={layout}
              editMode={editMode}
              canvasRef={svgRef}
              onLayoutChange={handleLayoutChange}
            />

            {tables.map((t, idx) => (
              <TableElement
                key={t.id}
                table={t}
                filledCount={headsAt(t.id)}
                displayNumber={t.number ?? idx + 1}
                selected={selectedTableId === t.id}
                onSelect={() => setSelectedTableId(t.id)}
                onMove={(x, y) => moveTable(t, x, y)}
                canvasRef={svgRef}
              />
            ))}
          </svg>
        </div>

        {tables.length === 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ color: "var(--foreground-soft)" }}
          >
            <div className="text-center max-w-sm px-4">
              <div className="text-5xl mb-3" aria-hidden>
                🪑
              </div>
              <div className="text-sm font-bold mb-1.5">
                האולם עוד ריק
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--foreground-muted)" }}
              >
                לחץ &quot;+ שולחן&quot; בסרגל למעלה כדי להתחיל
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="absolute bottom-4 start-4 rounded-full px-4 py-2 text-xs font-semibold"
              style={{
                background: "rgba(8,7,10,0.92)",
                color: "var(--accent)",
                border: "1px solid var(--border-gold)",
                backdropFilter: "blur(8px)",
              }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedTable && (
          <div
            className="fixed inset-x-0 bottom-0 md:inset-y-0 md:end-0 md:start-auto md:bottom-auto md:top-20 z-40 p-4 md:p-6 pointer-events-none"
            aria-live="polite"
          >
            <div className="md:max-w-sm md:ms-auto pointer-events-auto">
              <TableDetailsSheet
                key={selectedTable.id}
                table={selectedTable}
                seated={seatedByTable.get(selectedTable.id) ?? []}
                unassigned={unassigned}
                displayNumber={selectedDisplayNumber}
                onClose={() => setSelectedTableId(null)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
