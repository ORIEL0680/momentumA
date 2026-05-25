"use client";

/**
 * R80 — Side/bottom sheet shown when the host selects a table on the
 * architect canvas.
 *
 * Desktop (≥md): floats on the right side of the canvas.
 * Mobile (<md): slides up from the bottom as a true bottom sheet.
 *
 * Surfaces:
 *   • Label + capacity (+/− steppers)
 *   • Five accent-color swatches (gold, sky, emerald, rose, violet)
 *   • Shape toggle (round ⇄ rect)
 *   • Seated guests list (with quick "remove from table" buttons)
 *   • Add guest from the unassigned pool
 *   • Delete table (confirm guard)
 *
 * Pure controlled UI: all data flows in via props; mutations go back
 * through `actions.updateTable` / `actions.assignSeat` / `actions.removeTable`.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Minus,
  Plus,
  Square,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { actions } from "@/lib/store";
import type { Guest, SeatingTable } from "@/lib/types";

const COLOR_SWATCHES: Array<{ value: string; label: string }> = [
  { value: "#D4B068", label: "זהב" },
  { value: "#60A5FA", label: "תכלת" },
  { value: "#34D399", label: "אמרלד" },
  { value: "#F472B6", label: "ורד" },
  { value: "#C084FC", label: "סגול" },
];

interface Props {
  table: SeatingTable;
  seated: Guest[];
  unassigned: Guest[];
  displayNumber: number;
  onClose: () => void;
}

export function TableDetailsSheet({
  table,
  seated,
  unassigned,
  displayNumber,
  onClose,
}: Props) {
  // Local edits for the text inputs — store writes happen on blur
  // / explicit save so each keystroke doesn't trigger an autosave RPC.
  const [labelDraft, setLabelDraft] = useState(table.label ?? table.name ?? "");

  const filled = seated.reduce((s, g) => s + (g.attendingCount ?? 1), 0);

  const commitLabel = () => {
    const next = labelDraft.trim();
    if (next === (table.label ?? "")) return;
    actions.updateTable(table.id, { label: next || undefined });
  };

  const bumpCapacity = (delta: number) => {
    actions.updateTable(table.id, {
      capacity: Math.max(1, table.capacity + delta),
    });
  };

  const setColor = (c: string) => {
    actions.updateTable(table.id, { color: c });
  };

  const setShape = (shape: "round" | "rect") => {
    actions.updateTable(table.id, { shape });
  };

  const deleteTable = () => {
    if (
      confirm(
        seated.length > 0
          ? `למחוק את "${table.label || table.name}"? ${seated.length} אורחים יחזרו לרשימת הממתינים.`
          : `למחוק את "${table.label || table.name}"?`,
      )
    ) {
      actions.removeTable(table.id);
      onClose();
    }
  };

  return (
    <motion.aside
      key={table.id}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="card-gold relative p-5 w-full"
      style={{
        background: "var(--surface-1)",
        boxShadow: "0 24px 48px -16px rgba(0,0,0,0.55)",
      }}
      role="dialog"
      aria-labelledby={`table-sheet-title-${table.id}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[10px] uppercase tracking-wider ltr-num"
            style={{ color: "var(--foreground-muted)" }}
          >
            שולחן #{displayNumber}
          </div>
          <h3
            id={`table-sheet-title-${table.id}`}
            className="mt-0.5 font-bold text-xl truncate"
          >
            {table.label || table.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="סגור"
          className="p-1.5 rounded-full hover:bg-white/5"
          style={{ color: "var(--foreground-soft)" }}
        >
          <X size={16} />
        </button>
      </header>

      <div className="mt-4 space-y-4">
        {/* Label */}
        <label className="block">
          <span
            className="text-xs"
            style={{ color: "var(--foreground-soft)" }}
          >
            שם השולחן
          </span>
          <input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="input mt-1.5 w-full"
            placeholder="שולחן ההורים / חברי כיתה י׳..."
            maxLength={60}
          />
        </label>

        {/* Capacity stepper */}
        <div>
          <span
            className="text-xs"
            style={{ color: "var(--foreground-soft)" }}
          >
            מקומות
          </span>
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => bumpCapacity(-1)}
              disabled={table.capacity <= 1}
              aria-label="הפחת מקום"
              className="rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-40"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <Minus size={14} />
            </button>
            <span
              className="text-xl font-extrabold ltr-num min-w-[2ch] text-center"
              style={{ color: "var(--accent)" }}
            >
              {table.capacity}
            </span>
            <button
              type="button"
              onClick={() => bumpCapacity(+1)}
              aria-label="הוסף מקום"
              className="rounded-full w-9 h-9 flex items-center justify-center"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <Plus size={14} />
            </button>
            <span
              className="text-xs ltr-num ms-auto"
              style={{ color: "var(--foreground-muted)" }}
            >
              {filled}/{table.capacity}
            </span>
          </div>
        </div>

        {/* Color swatches */}
        <div>
          <span
            className="text-xs"
            style={{ color: "var(--foreground-soft)" }}
          >
            צבע
          </span>
          <div className="mt-1.5 flex items-center gap-2">
            {COLOR_SWATCHES.map((s) => {
              const active = (table.color || "#D4B068") === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setColor(s.value)}
                  aria-label={s.label}
                  aria-pressed={active}
                  className="w-8 h-8 rounded-full transition relative"
                  style={{
                    background: s.value,
                    boxShadow: active
                      ? `0 0 0 2px var(--surface-1), 0 0 0 4px ${s.value}`
                      : "none",
                  }}
                >
                  {active && (
                    <Check
                      size={14}
                      className="absolute inset-0 m-auto text-black"
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Shape toggle */}
        <div>
          <span
            className="text-xs"
            style={{ color: "var(--foreground-soft)" }}
          >
            צורה
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <ShapeButton
              active={(table.shape ?? "round") === "round"}
              onClick={() => setShape("round")}
              icon={<RoundIcon />}
              label="עגול"
            />
            <ShapeButton
              active={table.shape === "rect"}
              onClick={() => setShape("rect")}
              icon={<Square size={16} />}
              label="מלבני"
            />
          </div>
        </div>

        {/* Seated guests */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-xs"
              style={{ color: "var(--foreground-soft)" }}
            >
              אורחים יושבים ({seated.length})
            </span>
          </div>
          {seated.length === 0 ? (
            <div
              className="text-xs text-center py-3 rounded-xl"
              style={{
                background: "var(--input-bg)",
                color: "var(--foreground-muted)",
              }}
            >
              עדיין אף אחד לא משובץ לשולחן הזה
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-[180px] overflow-y-auto pe-1">
              <AnimatePresence initial={false}>
                {seated.map((g) => (
                  <motion.li
                    key={g.id}
                    layout
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: "var(--input-bg)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <Check
                      size={14}
                      className="shrink-0"
                      style={{ color: "var(--accent)" }}
                    />
                    <span className="flex-1 truncate">{g.name}</span>
                    {(g.attendingCount ?? 1) > 1 && (
                      <span
                        className="text-[10px] ltr-num font-bold"
                        style={{ color: "var(--accent)" }}
                      >
                        +{(g.attendingCount ?? 1) - 1}
                      </span>
                    )}
                    <button
                      onClick={() => actions.assignSeat(g.id, null)}
                      aria-label={`הסר את ${g.name} מהשולחן`}
                      className="p-1 rounded-full hover:bg-white/5"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      <X size={12} />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* Add from unassigned */}
        {unassigned.length > 0 && (
          <details className="rounded-xl" style={{ background: "var(--input-bg)" }}>
            <summary
              className="cursor-pointer text-xs font-semibold px-3 py-2 flex items-center gap-1.5"
              style={{ color: "var(--accent)" }}
            >
              <UserPlus size={13} />
              הוסף אורח קיים ({unassigned.length} ממתינים)
            </summary>
            <ul className="px-2 pb-2 max-h-[160px] overflow-y-auto space-y-1">
              {unassigned.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => actions.assignSeat(g.id, table.id)}
                    className="w-full text-start flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-white/5"
                    style={{ color: "var(--foreground-soft)" }}
                  >
                    <Plus
                      size={12}
                      style={{ color: "var(--accent)" }}
                    />
                    <span className="flex-1 truncate">{g.name}</span>
                    {(g.attendingCount ?? 1) > 1 && (
                      <span
                        className="text-[10px] ltr-num"
                        style={{ color: "var(--accent)" }}
                      >
                        +{(g.attendingCount ?? 1) - 1}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Delete */}
        <button
          onClick={deleteTable}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition"
          style={{
            border: "1px solid rgba(248,113,113,0.3)",
            color: "rgb(252,165,165)",
            background: "rgba(248,113,113,0.04)",
          }}
        >
          <Trash2 size={13} />
          מחק שולחן
        </button>
      </div>
    </motion.aside>
  );
}

function ShapeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-xl py-2 px-3 flex items-center justify-center gap-2 text-sm transition"
      style={{
        background: active ? "rgba(212,176,104,0.14)" : "var(--input-bg)",
        border: `1px solid ${active ? "var(--border-gold)" : "var(--border)"}`,
        color: active ? "var(--accent)" : "var(--foreground-soft)",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function RoundIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      <circle
        cx={8}
        cy={8}
        r={6}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
      />
    </svg>
  );
}
