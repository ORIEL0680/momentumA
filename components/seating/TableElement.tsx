"use client";

/**
 * R80 — Interactive table element on the seating architect canvas.
 *
 * Each table is an SVG <g> that the host can:
 *   • drag to reposition (pointer events, snap-to-20px grid)
 *   • click to select (opens TableDetailsSheet)
 *
 * Size is proportional to capacity (a 6-seat table is visibly smaller
 * than a 12-seat one). Chairs are rendered as small circles arranged
 * around the table perimeter — occupied chairs share the table's
 * accent color, empty ones are pale.
 *
 * State visuals:
 *   • full (filled === capacity) → gold ring + glow filter + green
 *     checkmark badge.
 *   • empty (filled === 0) → dashed border, dimmed.
 *   • selected → dashed gold halo ring.
 *
 * Drag is implemented with native pointer events (not framer-motion's
 * drag) because SVG transform attributes don't play well with frame's
 * pixel-offset deltas — we want to translate the *SVG* by *SVG units*
 * (1:1 with the viewBox), not by screen pixels. The math is simple:
 * delta-in-pixels × (viewBox-width / canvas-rendered-width) = delta-
 * in-SVG-units. A "snap" pass rounds to the nearest 20-unit grid step
 * so tables align without manual fiddling.
 *
 * Accessibility: each table is keyboard-focusable. Arrow keys nudge
 * the table by 20 units (one grid step); space/enter opens the
 * details sheet. role="button" + aria-label keeps screen readers
 * oriented.
 */

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SeatingTable } from "@/lib/types";

const CANVAS_W = 1200;
const CANVAS_H = 800;
const SNAP = 20;
/** Minimum gap from canvas edge so chairs + labels don't clip. */
const EDGE_PAD = 80;

interface Props {
  table: SeatingTable;
  filledCount: number;
  /** Number printed inside the table (falls back to `table.number` or "?"). */
  displayNumber: number;
  selected: boolean;
  onSelect: () => void;
  /** Called with the snapped SVG-unit position after the host releases
   *  the pointer. Caller is responsible for writing it through the
   *  store + autosave debounce. */
  onMove: (positionX: number, positionY: number) => void;
  /** SVG element ref of the canvas root — used to convert client pixels
   *  to SVG units during drag. Passed down so we don't re-query the DOM
   *  on every pointer move. */
  canvasRef: React.RefObject<SVGSVGElement | null>;
}

export function TableElement({
  table,
  filledCount,
  displayNumber,
  selected,
  onSelect,
  onMove,
  canvasRef,
}: Props) {
  // Anchor: where the table sits BEFORE the current drag started. We
  // keep this stable through the drag so the math is "anchor + delta"
  // (jitter-free) instead of "previous frame + tiny delta" (drifts).
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const dragStartRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    originX: number;
    originY: number;
    scale: number;
  } | null>(null);

  const baseX = table.positionX ?? CANVAS_W / 2;
  const baseY = table.positionY ?? CANVAS_H / 2;
  const currentX = dragPos?.x ?? baseX;
  const currentY = dragPos?.y ?? baseY;

  const capacity = Math.max(1, table.capacity);
  // Radius grows with capacity. 6→r:51, 8→r:58, 10→r:65, 12→r:72.
  const radius = useMemo(() => 30 + capacity * 3.5, [capacity]);
  // Rect tables: width grows with capacity (chairs split between two long sides).
  const rectW = useMemo(() => 80 + capacity * 8, [capacity]);
  const rectH = 60;
  const isRect = table.shape === "rect";

  const isFull = filledCount >= capacity;
  const isEmpty = filledCount === 0;
  const filledRatio = Math.min(1, filledCount / capacity);
  const tableColor = table.color || "#D4B068";
  const ring = isFull ? "#F4DEA9" : isEmpty ? "#6A5F4A" : tableColor;
  const dashed = isEmpty ? "4 4" : undefined;

  // Chairs around the perimeter. For round tables we distribute evenly
  // around the circle; for rect tables we split between the long
  // (top + bottom) sides.
  const chairs = useMemo(() => {
    if (isRect) {
      const perSide = Math.ceil(capacity / 2);
      const top = Array.from({ length: perSide }, (_, i) => {
        const cx = -rectW / 2 + ((i + 0.5) / perSide) * rectW;
        return { x: cx, y: -rectH / 2 - 10 };
      });
      const bottom = Array.from(
        { length: capacity - perSide },
        (_, i) => {
          const slots = capacity - perSide;
          const cx = -rectW / 2 + ((i + 0.5) / slots) * rectW;
          return { x: cx, y: rectH / 2 + 10 };
        },
      );
      return [...top, ...bottom];
    }
    return Array.from({ length: capacity }, (_, i) => {
      const angle = (i / capacity) * 2 * Math.PI - Math.PI / 2;
      return {
        x: Math.cos(angle) * (radius + 10),
        y: Math.sin(angle) * (radius + 10),
      };
    });
  }, [capacity, radius, isRect, rectW, rectH]);

  const label = table.label || table.name || `שולחן ${displayNumber}`;
  const labelOffsetY = isRect ? -rectH / 2 - 22 : -radius - 18;

  /** Convert a pointer-pixel delta into SVG-unit delta using the
   *  rendered scale of the canvas. */
  const pixelsToSvgUnits = (dx: number, dy: number, scale: number) => ({
    x: dx / scale,
    y: dy / scale,
  });

  const computeScale = () => {
    const el = canvasRef.current;
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    // 1 svg unit = rect.width / viewBoxWidth screen pixels.
    return rect.width > 0 ? rect.width / CANVAS_W : 1;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>) => {
    // Ignore right-clicks and middle-clicks — only primary drag.
    if (e.button !== 0) return;
    e.stopPropagation();
    // Capture the pointer so we keep receiving move events even when
    // the cursor wanders outside the <g> element (e.g. over chairs of
    // another table).
    (e.target as Element).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      originX: baseX,
      originY: baseY,
      scale: computeScale(),
    };
    setDragPos({ x: baseX, y: baseY });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    const dx = e.clientX - start.clientX;
    const dy = e.clientY - start.clientY;
    const { x: svgDx, y: svgDy } = pixelsToSvgUnits(dx, dy, start.scale);
    const newX = clamp(
      start.originX + svgDx,
      EDGE_PAD,
      CANVAS_W - EDGE_PAD,
    );
    const newY = clamp(
      start.originY + svgDy,
      EDGE_PAD,
      CANVAS_H - EDGE_PAD,
    );
    setDragPos({ x: newX, y: newY });
  };

  const finishDrag = (e: React.PointerEvent<SVGGElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    dragStartRef.current = null;
    if (dragPos) {
      const snapped = {
        x: Math.round(dragPos.x / SNAP) * SNAP,
        y: Math.round(dragPos.y / SNAP) * SNAP,
      };
      setDragPos(null);
      // No-op when the drop equals the original — saves a wasted store
      // write + autosave call when the host taps the table without moving it.
      if (snapped.x !== start.originX || snapped.y !== start.originY) {
        onMove(snapped.x, snapped.y);
      } else {
        // Tap (no movement) → treat as a select.
        onSelect();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -SNAP;
    else if (e.key === "ArrowRight") dx = SNAP;
    else if (e.key === "ArrowUp") dy = -SNAP;
    else if (e.key === "ArrowDown") dy = SNAP;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
      return;
    } else return;
    e.preventDefault();
    onMove(
      clamp(baseX + dx, EDGE_PAD, CANVAS_W - EDGE_PAD),
      clamp(baseY + dy, EDGE_PAD, CANVAS_H - EDGE_PAD),
    );
  };

  const isDragging = dragPos !== null;

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${label} — ${filledCount} מתוך ${capacity} מקומות. גרור להזזה, אנטר לפרטים.`}
      transform={`translate(${currentX}, ${currentY})`}
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        outline: "none",
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onKeyDown={handleKeyDown}
      whileHover={{ scale: 1.04 }}
      animate={{ scale: isDragging ? 1.08 : 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
    >
      {/* Shadow ellipse under the table — darker while dragging. */}
      <ellipse
        cx={0}
        cy={(isRect ? rectH / 2 : radius) + 4}
        rx={(isRect ? rectW / 2 : radius) * 0.9}
        ry={6}
        fill="black"
        opacity={isDragging ? 0.32 : 0.18}
      />

      {/* The table top */}
      {isRect ? (
        <rect
          x={-rectW / 2}
          y={-rectH / 2}
          width={rectW}
          height={rectH}
          rx={10}
          fill="#F8F4ED"
          stroke={ring}
          strokeWidth={isFull ? 3 : 2}
          strokeDasharray={dashed}
          filter={isFull ? "url(#goldGlow)" : undefined}
          opacity={isEmpty ? 0.7 : 1}
        />
      ) : (
        <circle
          cx={0}
          cy={0}
          r={radius}
          fill="#F8F4ED"
          stroke={ring}
          strokeWidth={isFull ? 3 : 2}
          strokeDasharray={dashed}
          filter={isFull ? "url(#goldGlow)" : undefined}
          opacity={isEmpty ? 0.7 : 1}
        />
      )}

      {/* Chairs around the perimeter */}
      {chairs.map((c, i) => {
        const occupied = i < filledCount;
        return (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={6}
            fill={occupied ? tableColor : "#FFFEFB"}
            stroke="#2A1F15"
            strokeWidth={1}
          />
        );
      })}

      {/* Pulsing candle at center */}
      <motion.circle
        cx={0}
        cy={0}
        r={4}
        fill="#FF8C42"
        animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.15, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Display label above the table */}
      <text
        x={0}
        y={labelOffsetY}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        fill="#1A1410"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {label}
      </text>

      {/* Big number under the candle */}
      <text
        x={0}
        y={(isRect ? 4 : 18)}
        textAnchor="middle"
        fontSize={isRect ? 18 : 22}
        fontWeight={800}
        fill={isFull ? "#A8884A" : "#80745A"}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {filledCount}/{capacity}
      </text>

      {/* Big table number above the count (small, ltr) */}
      <text
        x={0}
        y={(isRect ? -8 : 0)}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="#80745A"
        opacity={0.85}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          letterSpacing: "0.1em",
        }}
      >
        #{displayNumber}
      </text>

      {/* "Full" badge — small green check at the top-right */}
      {isFull && (
        <motion.g
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
        >
          <circle
            cx={(isRect ? rectW / 2 : radius) - 6}
            cy={-(isRect ? rectH / 2 : radius) + 6}
            r={10}
            fill="#4ade80"
          />
          <path
            d={`M ${(isRect ? rectW / 2 : radius) - 10} ${-(isRect ? rectH / 2 : radius) + 6} l 3 3 l 7 -6`}
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </motion.g>
      )}

      {/* Selection ring (dashed) */}
      {selected && (
        isRect ? (
          <rect
            x={-rectW / 2 - 12}
            y={-rectH / 2 - 12}
            width={rectW + 24}
            height={rectH + 24}
            rx={16}
            fill="none"
            stroke="#F4DEA9"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        ) : (
          <circle
            cx={0}
            cy={0}
            r={radius + 12}
            fill="none"
            stroke="#F4DEA9"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )
      )}

      {/* Coverage strip (only for partial fills) */}
      {!isFull && !isEmpty && (
        <rect
          x={isRect ? -rectW / 2 + 8 : -radius * 0.6}
          y={isRect ? rectH / 2 - 6 : radius - 8}
          width={(isRect ? rectW - 16 : radius * 1.2) * filledRatio}
          height={3}
          rx={1.5}
          fill={tableColor}
          opacity={0.7}
        />
      )}
    </motion.g>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
