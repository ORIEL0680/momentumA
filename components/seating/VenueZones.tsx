"use client";

/**
 * R80 + R81 — Venue zones layer.
 *
 * Four reference points: dance floor (centerpiece, pulsing gold),
 * stage, bar, entrance. In R81 each zone is independently draggable
 * when the canvas is in edit mode — the host can plant the dance
 * floor where their real venue's dance floor lives, then drag the
 * tables around it.
 *
 * Drag implementation mirrors TableElement: pointer-events native,
 * SVG-unit deltas computed from canvasRef.getBoundingClientRect(),
 * 20-unit snap, edge-padded clamping. Each zone calls back through
 * `onLayoutChange` with the next full VenueLayout snapshot — the
 * parent commits it to event.venueLayout via the store.
 *
 * In view mode (the default) zones are decorative — they catch no
 * pointer events, so the table drag layer above them stays fluid.
 */

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import type { VenueLayout } from "@/lib/types";

const CANVAS_W = 1200;
const CANVAS_H = 800;
const SNAP = 20;
const EDGE_PAD = 20;

const DEFAULTS = {
  danceFloor: { x: 400, y: 250, w: 400, h: 300 },
  stage: { x: 500, y: 50, w: 200, h: 80 },
  bar: { x: 50, y: 650, w: 150, h: 80 },
  entrance: { x: 1050, y: 650, w: 120, h: 80 },
} as const;

interface Props {
  layout?: VenueLayout;
  editMode: boolean;
  onLayoutChange: (next: VenueLayout) => void;
  canvasRef: React.RefObject<SVGSVGElement | null>;
}

export function VenueZones({
  layout,
  editMode,
  onLayoutChange,
  canvasRef,
}: Props) {
  const dance = layout?.danceFloor ?? DEFAULTS.danceFloor;
  const stage = layout?.stage ?? DEFAULTS.stage;
  const bar = layout?.bar ?? DEFAULTS.bar;
  const ent = layout?.entrance ?? DEFAULTS.entrance;
  const entW = ent.w ?? DEFAULTS.entrance.w;
  const entH = ent.h ?? DEFAULTS.entrance.h;

  const fullLayout: VenueLayout = {
    width: layout?.width ?? CANVAS_W,
    height: layout?.height ?? CANVAS_H,
    danceFloor: dance,
    stage,
    bar,
    entrance: { x: ent.x, y: ent.y, w: entW, h: entH },
  };

  const updateZone = (
    key: "danceFloor" | "stage" | "bar" | "entrance",
    next: { x: number; y: number; w: number; h: number },
  ) => {
    onLayoutChange({ ...fullLayout, [key]: next });
  };

  return (
    <g aria-hidden>
      <DanceFloor
        rect={dance}
        editMode={editMode}
        canvasRef={canvasRef}
        onMove={(x, y) => updateZone("danceFloor", { ...dance, x, y })}
      />
      <Zone
        rect={stage}
        emoji="🎤"
        label="במה"
        editMode={editMode}
        canvasRef={canvasRef}
        onMove={(x, y) => updateZone("stage", { ...stage, x, y })}
      />
      <Zone
        rect={bar}
        emoji="🍷"
        label="בר"
        editMode={editMode}
        canvasRef={canvasRef}
        onMove={(x, y) => updateZone("bar", { ...bar, x, y })}
      />
      <Zone
        rect={{ ...ent, w: entW, h: entH }}
        emoji="🚪"
        label="כניסה"
        editMode={editMode}
        canvasRef={canvasRef}
        onMove={(x, y) =>
          updateZone("entrance", { ...ent, w: entW, h: entH, x, y })
        }
      />
    </g>
  );
}

// ───────────────────────────── Dance floor ─────────────────────────────

function DanceFloor({
  rect,
  editMode,
  canvasRef,
  onMove,
}: {
  rect: { x: number; y: number; w: number; h: number };
  editMode: boolean;
  canvasRef: React.RefObject<SVGSVGElement | null>;
  onMove: (x: number, y: number) => void;
}) {
  const { x, y, w, h } = rect;
  const drag = useSvgDrag({
    canvasRef,
    originX: x,
    originY: y,
    width: w,
    height: h,
    onMove,
    enabled: editMode,
  });
  const currentX = drag.position?.x ?? x;
  const currentY = drag.position?.y ?? y;

  return (
    <g transform={`translate(${currentX - x}, ${currentY - y})`}>
      <defs>
        <radialGradient
          id="danceFloorGradient"
          cx="50%"
          cy="50%"
          r="60%"
        >
          <stop offset="0%" stopColor="#F4DEA9" stopOpacity={0.42} />
          <stop offset="70%" stopColor="#D4B068" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#A8884A" stopOpacity={0.06} />
        </radialGradient>
      </defs>

      <motion.g
        animate={{ opacity: [0.88, 1, 0.88] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerUp}
        style={{
          cursor: editMode ? (drag.dragging ? "grabbing" : "grab") : "default",
          touchAction: editMode ? "none" : "auto",
        }}
      >
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={22}
          fill="url(#danceFloorGradient)"
          stroke="#D4B068"
          strokeWidth={editMode ? 2.5 : 1.8}
          strokeDasharray={editMode ? "6 4" : "4 4"}
          opacity={editMode && drag.dragging ? 0.9 : 1}
        />
        <text
          x={x + w / 2}
          y={y + h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={26}
          fontWeight={700}
          fill="#F4DEA9"
          opacity={0.75}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          ✨ רחבת ריקודים ✨
        </text>
        {editMode && <MoveHandle cx={x + w - 22} cy={y + 22} />}
      </motion.g>
    </g>
  );
}

// ───────────────────────────── Generic zone (stage / bar / entrance) ─

function Zone({
  rect,
  emoji,
  label,
  editMode,
  canvasRef,
  onMove,
}: {
  rect: { x: number; y: number; w: number; h: number };
  emoji: string;
  label: string;
  editMode: boolean;
  canvasRef: React.RefObject<SVGSVGElement | null>;
  onMove: (x: number, y: number) => void;
}) {
  const { x, y, w, h } = rect;
  const drag = useSvgDrag({
    canvasRef,
    originX: x,
    originY: y,
    width: w,
    height: h,
    onMove,
    enabled: editMode,
  });
  const currentX = drag.position?.x ?? x;
  const currentY = drag.position?.y ?? y;

  return (
    <g
      transform={`translate(${currentX - x}, ${currentY - y})`}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerUp}
      style={{
        cursor: editMode ? (drag.dragging ? "grabbing" : "grab") : "default",
        touchAction: editMode ? "none" : "auto",
      }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill="#0E0B07"
        stroke="#D4B068"
        strokeWidth={editMode ? 2 : 1.4}
        strokeDasharray={editMode ? "5 3" : undefined}
        opacity={drag.dragging ? 0.92 : 0.97}
      />
      <text
        x={x + w / 2}
        y={y + h / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={18}
        fontWeight={600}
        fill="#F4DEA9"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {emoji} {label}
      </text>
      {editMode && <MoveHandle cx={x + w - 16} cy={y + 16} />}
    </g>
  );
}

function MoveHandle({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle
        cx={cx}
        cy={cy}
        r={11}
        fill="#0A0A0F"
        stroke="#F4DEA9"
        strokeWidth={1.5}
      />
      {/* Four-arrow move glyph */}
      <path
        d={`M ${cx} ${cy - 6} l 0 12 M ${cx - 6} ${cy} l 12 0
            M ${cx - 4} ${cy - 4} l 0 -2 l -2 0
            M ${cx + 4} ${cy - 4} l 0 -2 l 2 0
            M ${cx - 4} ${cy + 4} l 0 2 l -2 0
            M ${cx + 4} ${cy + 4} l 0 2 l 2 0`}
        stroke="#F4DEA9"
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      />
    </g>
  );
}

// ───────────────────────────── Shared SVG drag hook ───────────────────

function useSvgDrag({
  canvasRef,
  originX,
  originY,
  width,
  height,
  onMove,
  enabled,
}: {
  canvasRef: React.RefObject<SVGSVGElement | null>;
  originX: number;
  originY: number;
  width: number;
  height: number;
  onMove: (x: number, y: number) => void;
  enabled: boolean;
}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  // Mirror the ref's `moved` flag in state so callers can read
  // `dragging` during render without violating react-hooks/refs.
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    originX: number;
    originY: number;
    scale: number;
    moved: boolean;
  } | null>(null);

  const computeScale = () => {
    const el = canvasRef.current;
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    return r.width > 0 ? r.width / CANVAS_W : 1;
  };

  const onPointerDown = (e: React.PointerEvent<SVGElement>) => {
    if (!enabled || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      originX,
      originY,
      scale: computeScale(),
      moved: false,
    };
    setPosition({ x: originX, y: originY });
  };

  const onPointerMove = (e: React.PointerEvent<SVGElement>) => {
    const s = startRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.clientX;
    const dy = e.clientY - s.clientY;
    if (!s.moved && Math.hypot(dx, dy) < 4) return;
    if (!s.moved) {
      s.moved = true;
      setDragging(true);
    }
    const svgDx = dx / s.scale;
    const svgDy = dy / s.scale;
    const newX = clamp(s.originX + svgDx, EDGE_PAD, CANVAS_W - width - EDGE_PAD);
    const newY = clamp(s.originY + svgDy, EDGE_PAD, CANVAS_H - height - EDGE_PAD);
    setPosition({ x: newX, y: newY });
  };

  const onPointerUp = (e: React.PointerEvent<SVGElement>) => {
    const s = startRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    startRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* runtime already released */
      }
    }
    const wasMoved = s.moved;
    setDragging(false);
    if (!wasMoved || !position) {
      setPosition(null);
      return;
    }
    const snapped = {
      x: Math.round(position.x / SNAP) * SNAP,
      y: Math.round(position.y / SNAP) * SNAP,
    };
    setPosition(null);
    if (snapped.x !== s.originX || snapped.y !== s.originY) {
      onMove(snapped.x, snapped.y);
    }
  };

  return {
    position,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
