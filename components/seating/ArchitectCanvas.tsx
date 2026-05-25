"use client";

/**
 * R80 — Seating Architect canvas.
 *
 * The big-bang 2D top-down floor plan: parquet wood floor, venue
 * zones (dance floor / stage / bar / entrance), draggable tables.
 * Designed to feel like Apple Pencil on iPad Pro — every interaction
 * is direct, smooth, and reversible.
 *
 * Architecture:
 *   • <svg> sized to the venue viewBox (1200×800 by default).
 *   • A CSS transform (`scale(zoom)`) wraps the viewport so the host
 *     can zoom 50–200%. Pan is automatic via overflow-x/y on the
 *     wrapper at zoom > 1.
 *   • TableElement handles its own drag (pointer events → SVG-unit
 *     deltas → snap → onMove callback). The canvas just stores the
 *     selected-table id and renders the details sheet.
 *   • Autosave: every position write is mirrored to the store
 *     immediately (so the UI is consistent), then a debounced
 *     500ms toast confirms the persistence.
 *   • Undo: a 20-deep stack of {tableId, prevX, prevY} entries. Cmd/
 *     Ctrl-Z pops the latest and replays it through `actions.updateTable`.
 *   • New tables are placed at the canvas center; the first drag
 *     stamps them into the host's preferred grid slot.
 *
 * The canvas is intentionally stateless about the store — it reads
 * tables + guests + assignments as props and writes mutations
 * through `actions.*`. That keeps it testable without a Provider and
 * lets the parent page render alternate "ghost" canvases (e.g. for
 * the smart-arrangement preview) without re-implementing the visuals.
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
  /** guestId → tableId. */
  seatAssignments: Record<string, string>;
  /** Optional venue layout override; falls back to canvas defaults. */
  layout?: VenueLayout;
  /** Opens the parent's "new table" modal. */
  onAddTable: () => void;
}

interface UndoEntry {
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
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Undo stack lives in state (not a ref) so the toolbar's `canUndo` flag
  // re-renders correctly. Mutations push/pop with the functional setter
  // form, so concurrent moves don't clobber each other.
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const toastTimerRef = useRef<number | null>(null);

  // ─── Auto-seed positions for tables created before R80 ───────────────
  // A table without positionX/Y would render at the canvas center on top
  // of every other unmigrated table. On first paint we lay them out via
  // the auto-arrange algorithm so the host sees a clean grid even if
  // they never click "איפוס מיקום".
  // We only do this for tables genuinely missing the field; tables the
  // host has already moved keep their positions.
  useEffect(() => {
    const missing = tables.filter(
      (t) => t.positionX === undefined || t.positionY === undefined,
    );
    if (missing.length === 0) return;
    // Build a "what the layout looks like after seeding" map. We pass
    // ALL tables (so the algorithm picks distinct slots), then only
    // commit the entries that were actually missing.
    const positions = autoArrangeTables(tables, layout);
    for (const t of missing) {
      const p = positions.get(t.id);
      if (p) {
        actions.updateTable(t.id, { positionX: p.x, positionY: p.y });
      }
    }
    // Intentionally not adding `tables` to deps — we want this to fire
    // ONLY when the list of "missing" tables changes; depending on the
    // full tables array would cause an update→re-effect loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.length, layout]);

  // ─── Live "seated count" per table (drives chair fill + full glow) ───
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

  // ─── Toast helper ──────────────────────────────────────────────────
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

  // ─── Move handler shared by drag + keyboard nudges ─────────────────
  const moveTable = useCallback(
    (table: SeatingTable, x: number, y: number) => {
      const prevX = table.positionX ?? CANVAS_W / 2;
      const prevY = table.positionY ?? CANVAS_H / 2;
      if (prevX === x && prevY === y) return;
      setUndoStack((s) => {
        const next = [...s, { tableId: table.id, prevX, prevY }];
        return next.length > UNDO_DEPTH ? next.slice(-UNDO_DEPTH) : next;
      });
      actions.updateTable(table.id, { positionX: x, positionY: y });
      flashToast("✓ נשמר");
    },
    [flashToast],
  );

  // ─── Undo (Cmd/Ctrl + Z) ───────────────────────────────────────────
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key === "Escape" && selectedTableId) {
        setSelectedTableId(null);
      } else if (e.key === "+" || e.key === "=") {
        // Zoom shortcuts (no modifier — common in design tools).
        if (e.target === document.body) {
          e.preventDefault();
          setZoom((z) =>
            Math.min(ZOOM_LIMITS.max, Number((z + ZOOM_LIMITS.step).toFixed(2))),
          );
        }
      } else if (e.key === "-" || e.key === "_") {
        if (e.target === document.body) {
          e.preventDefault();
          setZoom((z) =>
            Math.max(ZOOM_LIMITS.min, Number((z - ZOOM_LIMITS.step).toFixed(2))),
          );
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, selectedTableId]);

  // ─── Reset positions ───────────────────────────────────────────────
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
      newEntries.push({ tableId: t.id, prevX, prevY });
      actions.updateTable(t.id, { positionX: p.x, positionY: p.y });
    }
    setUndoStack((s) => {
      const next = [...s, ...newEntries];
      return next.length > UNDO_DEPTH ? next.slice(-UNDO_DEPTH) : next;
    });
    flashToast(`✓ סודרו ${tables.length} שולחנות`);
  }, [tables, layout, flashToast]);

  // ─── Canvas click → deselect ───────────────────────────────────────
  const onCanvasClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    // Only the wrapper background should clear the selection — not
    // clicks that bubbled from a table.
    if (e.target === e.currentTarget) {
      setSelectedTableId(null);
    }
  }, []);

  const selectedTable = useMemo(
    () =>
      selectedTableId ? tables.find((t) => t.id === selectedTableId) ?? null : null,
    [selectedTableId, tables],
  );
  const selectedDisplayNumber = useMemo(() => {
    if (!selectedTable) return 0;
    const i = tables.findIndex((t) => t.id === selectedTable.id);
    return selectedTable.number ?? i + 1;
  }, [selectedTable, tables]);

  return (
    <div className="architect-root">
      {/* Toolbar — sticky above the canvas */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <CanvasToolbar
          zoom={zoom}
          onZoomChange={setZoom}
          onAddTable={onAddTable}
          onResetPositions={resetPositions}
          canUndo={undoStack.length > 0}
          onUndo={undo}
        />
        <div
          className="text-xs"
          style={{ color: "var(--foreground-muted)" }}
        >
          💡 גרור שולחן · קליק לבחירה · Cmd/Ctrl+Z לביטול · חיצים להזזה עדינה
        </div>
      </div>

      <div
        ref={viewportRef}
        className="architect-viewport relative w-full rounded-3xl overflow-auto"
        style={{
          border: "1px solid var(--border-gold)",
          background: "#1A1108",
          maxHeight: "min(78vh, 720px)",
        }}
        onClick={onCanvasClick}
      >
        {/* The SVG canvas. CSS scale handles zoom; width/height respond
            to the viewport so the canvas fills available space at 100%. */}
        <div
          style={{
            width: `${CANVAS_W * zoom}px`,
            height: `${CANVAS_H * zoom}px`,
            maxWidth: zoom === 1 ? "100%" : undefined,
            margin: zoom === 1 ? "0 auto" : undefined,
            transition: "width 200ms ease, height 200ms ease",
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
          >
            <ParquetBackground width={CANVAS_W} height={CANVAS_H} />
            <VenueZones layout={layout} />

            {/* Tables — rendered last so they sit above the venue layer. */}
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

        {/* Empty hint when no tables yet */}
        {tables.length === 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ color: "var(--foreground-muted)" }}
          >
            <div className="text-center max-w-sm px-4">
              <div className="text-5xl mb-3" aria-hidden>
                🪑
              </div>
              <div className="text-sm font-semibold mb-1.5">
                האולם עוד ריק
              </div>
              <div className="text-xs">
                לחץ &quot;+ שולחן&quot; כדי להתחיל
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="absolute bottom-4 start-4 rounded-full px-4 py-2 text-xs font-semibold ltr-num"
              style={{
                background: "rgba(20,14,8,0.92)",
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

      {/* Details sheet — slides in from the side / bottom on mobile */}
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
