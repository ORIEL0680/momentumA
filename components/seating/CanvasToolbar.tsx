"use client";

/**
 * R80 + R81 — Canvas toolbar.
 *
 * Gold-on-black pill row above the architect canvas. Four actions
 * (Add table · Reset positions · Undo · Zoom −/+/100%) in a single
 * glass strip. R81 cleaned up the visual hierarchy — the primary
 * action (Add) is a gold gradient, the rest are bordered chips, and
 * the zoom cluster sits in its own inset pill so the eye can land
 * on it as a unit.
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
      className="canvas-toolbar inline-flex flex-wrap items-center gap-2 rounded-full px-2.5 py-1.5"
      style={{
        background: "rgba(8,7,10,0.85)",
        backdropFilter: "blur(14px)",
        border: "1px solid var(--border-gold)",
        boxShadow:
          "0 10px 30px -12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(244,222,169,0.08)",
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
        <RotateCcw size={13} />
        <span>איפוס</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={onUndo}
        disabled={!canUndo}
        ariaLabel="בטל פעולה אחרונה"
      >
        <Undo2 size={13} />
        <span>ביטול</span>
      </ToolbarButton>

      <div
        aria-hidden
        className="hidden sm:block w-px h-5"
        style={{ background: "rgba(212,176,104,0.25)" }}
      />

      <div
        className="flex items-center gap-1 rounded-full px-1.5 py-0.5"
        style={{
          background: "rgba(20,14,8,0.6)",
          border: "1px solid rgba(212,176,104,0.25)",
        }}
      >
        <button
          type="button"
          onClick={() =>
            onZoomChange(
              Math.max(
                ZOOM_MIN,
                Number((zoom - ZOOM_STEP).toFixed(2)),
              ),
            )
          }
          aria-label="הקטן"
          className="p-1 rounded-full transition hover:bg-white/5"
          style={{ color: "var(--foreground-soft)" }}
        >
          <Minus size={12} />
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(1)}
          aria-label="100%"
          className="text-[11px] ltr-num font-semibold min-w-[42px] text-center transition"
          style={{ color: "var(--accent)" }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() =>
            onZoomChange(
              Math.min(
                ZOOM_MAX,
                Number((zoom + ZOOM_STEP).toFixed(2)),
              ),
            )
          }
          aria-label="הגדל"
          className="p-1 rounded-full transition hover:bg-white/5"
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
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
      style={
        primary
          ? {
              background:
                "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
              color: "var(--gold-button-text)",
              boxShadow: "0 4px 14px -6px rgba(212,176,104,0.55)",
            }
          : {
              background: "transparent",
              border: "1px solid rgba(212,176,104,0.25)",
              color: "var(--foreground-soft)",
            }
      }
    >
      {children}
    </button>
  );
}

export const ZOOM_LIMITS = { min: ZOOM_MIN, max: ZOOM_MAX, step: ZOOM_STEP };
