"use client";

/**
 * R80 — Sticky toolbar for the seating architect canvas.
 *
 * Sits above the canvas and provides the four most common actions:
 *   • Add table — opens the "כמה מקומות?" modal in the parent.
 *   • Reset positions — auto-arranges all tables in a grid.
 *   • Undo — pops the last position change off the parent's stack.
 *   • Zoom — −/+/% slider; clamped 50%–200%.
 *
 * Pure controlled component: no internal state, no store reads. The
 * parent owns the zoom value and undo stack; this layer just renders
 * the buttons and emits events. Keeps the canvas + toolbar testable
 * in isolation.
 */

import { Minus, Plus, RotateCcw, Undo2 } from "lucide-react";

interface Props {
  zoom: number;
  onZoomChange: (z: number) => void;
  onAddTable: () => void;
  onResetPositions: () => void;
  canUndo: boolean;
  onUndo: () => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;

export function CanvasToolbar({
  zoom,
  onZoomChange,
  onAddTable,
  onResetPositions,
  canUndo,
  onUndo,
}: Props) {
  return (
    <div
      className="canvas-toolbar flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2"
      style={{
        background: "rgba(20,14,8,0.78)",
        backdropFilter: "blur(14px)",
        border: "1px solid var(--border-gold)",
      }}
    >
      <ToolbarButton
        onClick={onAddTable}
        primary
        ariaLabel="הוסף שולחן חדש"
      >
        <Plus size={14} />
        <span>שולחן</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={onResetPositions}
        ariaLabel="אפס מיקום של כל השולחנות"
      >
        <RotateCcw size={14} />
        <span>איפוס מיקום</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={onUndo}
        disabled={!canUndo}
        ariaLabel="בטל פעולה אחרונה"
      >
        <Undo2 size={14} />
        <span>ביטול</span>
      </ToolbarButton>

      <div
        aria-hidden
        className="hidden sm:block w-px h-6"
        style={{ background: "var(--border)" }}
      />

      <div
        className="flex items-center gap-1.5 rounded-full px-2 py-1"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <button
          type="button"
          onClick={() =>
            onZoomChange(Math.max(ZOOM_MIN, Number((zoom - ZOOM_STEP).toFixed(2))))
          }
          aria-label="הקטן"
          className="p-1 rounded-full hover:bg-white/5"
          style={{ color: "var(--foreground-soft)" }}
        >
          <Minus size={12} />
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(1)}
          aria-label="100%"
          className="text-xs ltr-num font-semibold min-w-[44px] text-center"
          style={{ color: "var(--foreground)" }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() =>
            onZoomChange(Math.min(ZOOM_MAX, Number((zoom + ZOOM_STEP).toFixed(2))))
          }
          aria-label="הגדל"
          className="p-1 rounded-full hover:bg-white/5"
          style={{ color: "var(--foreground-soft)" }}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  primary,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40"
      style={
        primary
          ? {
              background:
                "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
              color: "var(--gold-button-text)",
            }
          : {
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--foreground-soft)",
            }
      }
    >
      {children}
    </button>
  );
}

export const ZOOM_LIMITS = { min: ZOOM_MIN, max: ZOOM_MAX, step: ZOOM_STEP };
