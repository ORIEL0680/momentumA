"use client";

/**
 * R80 + R81 — Draggable table on the architect canvas.
 *
 * Why a custom pointer-events drag instead of framer-motion's drag?
 *   • Framer's `drag` prop manipulates the element's `transform` style
 *     with pixel offsets. On an SVG inside a CSS-scaled viewport that
 *     produces drift — we want SVG-unit deltas (1 viewBox unit =
 *     boundingRect.width / 1200 px), not pixel deltas.
 *   • We also want to apply translate AND scale at the same time. SVG
 *     `<g>` can have only ONE transform attribute, and framer's
 *     `animate={{ scale }}` rewrites it. R80 saw drift + jumping
 *     during drag because of this collision.
 *
 * R81 fix: nest two `<g>`s.
 *   • Outer `<g transform="translate(x,y)">` owns position (static
 *     attribute, framer doesn't touch it).
 *   • Inner `<motion.g animate={{ scale }}>` owns the scale lift.
 *   • Pointer events live on the inner motion.g; pointer capture
 *     uses `e.currentTarget` (stable across re-renders of children
 *     like the candle / chairs).
 *
 * Palette switched to pure gold + black:
 *   • Table top: deep black (#0E0B07), inner radial sheen, gold ring.
 *   • Chairs: gold-on-black, occupied chairs filled, empty hollow.
 *   • Labels: gold gradient text on table top.
 *   • Empty-table treatment: dashed gold border at 35% opacity.
 *   • Full-table treatment: bright gold ring + softGlow filter + 💚 badge.
 */

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SeatingTable } from "@/lib/types";

const CANVAS_W = 1200;
const CANVAS_H = 800;
const SNAP = 20;
const EDGE_PAD = 80;

interface Props {
  table: SeatingTable;
  filledCount: number;
  displayNumber: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (positionX: number, positionY: number) => void;
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
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  // `isDragging` mirrors the start ref's `moved` flag so render can read
  // it (refs aren't allowed in render under react-hooks/refs rule).
  const [isDragging, setIsDragging] = useState(false);
  const [isHover, setIsHover] = useState(false);
  const dragStartRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    originX: number;
    originY: number;
    scale: number;
    moved: boolean;
  } | null>(null);

  const baseX = table.positionX ?? CANVAS_W / 2;
  const baseY = table.positionY ?? CANVAS_H / 2;
  const currentX = dragPos?.x ?? baseX;
  const currentY = dragPos?.y ?? baseY;

  const capacity = Math.max(1, table.capacity);
  const radius = useMemo(() => 30 + capacity * 3.5, [capacity]);
  const rectW = useMemo(() => 80 + capacity * 8, [capacity]);
  const rectH = 60;
  const isRect = table.shape === "rect";

  const isFull = filledCount >= capacity;
  const isEmpty = filledCount === 0;
  const filledRatio = Math.min(1, filledCount / capacity);
  const tableColor = table.color || "#D4B068";
  const ring = isFull ? "#F4DEA9" : isEmpty ? "rgba(212,176,104,0.35)" : tableColor;

  const chairs = useMemo(() => {
    if (isRect) {
      const perSide = Math.ceil(capacity / 2);
      const top = Array.from({ length: perSide }, (_, i) => ({
        x: -rectW / 2 + ((i + 0.5) / perSide) * rectW,
        y: -rectH / 2 - 11,
      }));
      const bottomSlots = capacity - perSide;
      const bottom = Array.from({ length: bottomSlots }, (_, i) => ({
        x: -rectW / 2 + ((i + 0.5) / bottomSlots) * rectW,
        y: rectH / 2 + 11,
      }));
      return [...top, ...bottom];
    }
    return Array.from({ length: capacity }, (_, i) => {
      const angle = (i / capacity) * 2 * Math.PI - Math.PI / 2;
      return {
        x: Math.cos(angle) * (radius + 12),
        y: Math.sin(angle) * (radius + 12),
      };
    });
  }, [capacity, radius, isRect, rectW, rectH]);

  const label = table.label || table.name || `שולחן ${displayNumber}`;
  const labelOffsetY = isRect ? -rectH / 2 - 24 : -radius - 22;

  const computeScale = () => {
    const el = canvasRef.current;
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 ? rect.width / CANVAS_W : 1;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // R81 — capture on currentTarget (the motion.g root), not e.target.
    // e.target can be the inner candle/chair/etc, which mounts and unmounts
    // as framer re-renders during the drag — losing the capture mid-flight.
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      originX: baseX,
      originY: baseY,
      scale: computeScale(),
      moved: false,
    };
    setDragPos({ x: baseX, y: baseY });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    const dx = e.clientX - start.clientX;
    const dy = e.clientY - start.clientY;
    // 4px dead-zone before we count a drag — prevents a click from
    // triggering accidental nudges when the user just wanted to select.
    if (!start.moved && Math.hypot(dx, dy) < 4) return;
    if (!start.moved) {
      start.moved = true;
      setIsDragging(true);
    }
    const svgDx = dx / start.scale;
    const svgDy = dy / start.scale;
    const newX = clamp(start.originX + svgDx, EDGE_PAD, CANVAS_W - EDGE_PAD);
    const newY = clamp(start.originY + svgDy, EDGE_PAD, CANVAS_H - EDGE_PAD);
    setDragPos({ x: newX, y: newY });
  };

  const finishDrag = (e: React.PointerEvent<SVGGElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    dragStartRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released by the runtime */
      }
    }
    const wasMoved = start.moved;
    setIsDragging(false);
    if (!wasMoved) {
      setDragPos(null);
      onSelect();
      return;
    }
    if (dragPos) {
      const snapped = {
        x: Math.round(dragPos.x / SNAP) * SNAP,
        y: Math.round(dragPos.y / SNAP) * SNAP,
      };
      setDragPos(null);
      if (snapped.x !== start.originX || snapped.y !== start.originY) {
        onMove(snapped.x, snapped.y);
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

  // R81 — outer translate is a plain attribute (stable). Inner motion.g
  // only animates scale, so framer-motion's transform rewrite can't
  // wipe the position. See module-level comment.
  return (
    <g transform={`translate(${currentX}, ${currentY})`}>
      <motion.g
        role="button"
        tabIndex={0}
        aria-label={`${label} — ${filledCount} מתוך ${capacity} מקומות`}
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          outline: "none",
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onPointerEnter={() => setIsHover(true)}
        onPointerLeave={() => setIsHover(false)}
        onKeyDown={handleKeyDown}
        animate={{
          scale: isDragging ? 1.08 : isHover && !isDragging ? 1.04 : 1,
        }}
        transition={{ type: "spring", stiffness: 360, damping: 26 }}
      >
        {/* Shadow under the table — heavier during drag. */}
        <ellipse
          cx={0}
          cy={(isRect ? rectH / 2 : radius) + 6}
          rx={(isRect ? rectW / 2 : radius) * 0.9}
          ry={6}
          fill="black"
          opacity={isDragging ? 0.45 : 0.28}
        />

        {/* Table top */}
        {isRect ? (
          <rect
            x={-rectW / 2}
            y={-rectH / 2}
            width={rectW}
            height={rectH}
            rx={12}
            fill="#0E0B07"
            stroke={ring}
            strokeWidth={isFull ? 2.5 : isEmpty ? 1.5 : 2}
            strokeDasharray={isEmpty ? "5 4" : undefined}
            filter={isFull ? "url(#goldGlow)" : undefined}
          />
        ) : (
          <circle
            cx={0}
            cy={0}
            r={radius}
            fill="#0E0B07"
            stroke={ring}
            strokeWidth={isFull ? 2.5 : isEmpty ? 1.5 : 2}
            strokeDasharray={isEmpty ? "5 4" : undefined}
            filter={isFull ? "url(#goldGlow)" : undefined}
          />
        )}

        {/* Inner gold sheen for full tables — subtle radial glow inside. */}
        {isFull && !isRect && (
          <circle
            cx={0}
            cy={0}
            r={radius - 6}
            fill="url(#table-sheen)"
            opacity={0.4}
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Chairs */}
        {chairs.map((c, i) => {
          const occupied = i < filledCount;
          return (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={6}
              fill={occupied ? tableColor : "#0A0A0F"}
              stroke={occupied ? "#1A1410" : tableColor}
              strokeWidth={occupied ? 1 : 1.2}
              opacity={occupied ? 1 : 0.7}
            />
          );
        })}

        {/* Candle */}
        <motion.circle
          cx={0}
          cy={0}
          r={3.5}
          fill="#FFB169"
          animate={{ opacity: [0.65, 1, 0.65], scale: [1, 1.18, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ pointerEvents: "none" }}
        />

        {/* Label — gold gradient, above the table */}
        <text
          x={0}
          y={labelOffsetY}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          fill="url(#label-gold)"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {truncate(label, 22)}
        </text>

        {/* Capacity counter */}
        <text
          x={0}
          y={isRect ? 6 : 20}
          textAnchor="middle"
          fontSize={isRect ? 17 : 21}
          fontWeight={800}
          fill={isFull ? "#F4DEA9" : isEmpty ? "rgba(212,176,104,0.5)" : "#D4B068"}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {filledCount}/{capacity}
        </text>

        {/* Table number — small monospace-ish tag */}
        <text
          x={0}
          y={isRect ? -8 : -2}
          textAnchor="middle"
          fontSize={9.5}
          fontWeight={700}
          fill="#A8884A"
          opacity={0.95}
          style={{
            pointerEvents: "none",
            userSelect: "none",
            letterSpacing: "0.12em",
          }}
        >
          #{displayNumber}
        </text>

        {/* "Full" check badge */}
        {isFull && (
          <motion.g
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            style={{ pointerEvents: "none" }}
          >
            <circle
              cx={(isRect ? rectW / 2 : radius) - 6}
              cy={-(isRect ? rectH / 2 : radius) + 6}
              r={10}
              fill="#34D399"
              stroke="#0A0A0F"
              strokeWidth={1.5}
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

        {/* Selection halo */}
        {selected &&
          (isRect ? (
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
              filter="url(#softGlow)"
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
              filter="url(#softGlow)"
            />
          ))}

        {/* Coverage strip for partial fills */}
        {!isFull && !isEmpty && (
          <rect
            x={isRect ? -rectW / 2 + 8 : -radius * 0.55}
            y={isRect ? rectH / 2 - 5 : radius - 7}
            width={(isRect ? rectW - 16 : radius * 1.1) * filledRatio}
            height={3}
            rx={1.5}
            fill={tableColor}
            opacity={0.75}
          />
        )}
      </motion.g>

      {/* Shared gradients used by table fills — declared once per
          instance so each table can use #table-sheen + #label-gold via
          fill="url(...)". They're inert to interactions. */}
      <defs>
        <radialGradient id="table-sheen" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#F4DEA9" stopOpacity={0.6} />
          <stop offset="60%" stopColor="#A8884A" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#A8884A" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="label-gold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F4DEA9" />
          <stop offset="100%" stopColor="#D4B068" />
        </linearGradient>
      </defs>
    </g>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
