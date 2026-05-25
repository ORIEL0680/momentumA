/**
 * R80 — Auto-arrange table positions on the seating architect canvas.
 *
 * Pure function. No store reads, no DOM. Given a list of tables, the
 * venue's outer bounds, and the dance floor's rectangle, return the
 * same tables with `positionX/positionY` updated so they sit in a
 * tidy grid that *surrounds* the dance floor without overlapping it
 * or the venue zones (bar/stage/entrance).
 *
 * Strategy (kept deliberately simple — the goal is "good default
 * layout", not "perfect optimization"):
 *
 *   1. Reserve a band around the dance floor where tables CAN sit:
 *        top band:    y ∈ [topPad,            danceFloor.y - margin]
 *        bottom band: y ∈ [danceFloor.bottom + margin, height - botPad]
 *        side bands:  x ∈ [sidePad, danceFloor.x - margin]
 *                     x ∈ [danceFloor.right + margin, width - sidePad]
 *   2. Place tables column-major into those bands, top → bottom,
 *      then right-side, then left-side, then bottom (so the order
 *      matches a host reading right-to-left, top-down).
 *   3. The VIP table (table #1 / lowest `number`) goes closest to
 *      the dance floor in the top-center band.
 *
 * Returns a Map<tableId, {positionX, positionY}> — the caller writes
 * the values through `actions.updateTable` (which the autosave hook
 * picks up automatically).
 */

import type { SeatingTable, VenueLayout } from "./types";

const DEFAULTS = {
  width: 1200,
  height: 800,
  danceFloor: { x: 400, y: 250, w: 400, h: 300 },
  // Margin between the dance floor and the nearest table center.
  margin: 110,
  // Outer padding from the venue edges.
  topPad: 70,
  bottomPad: 110,
  sidePad: 110,
  // Spacing between table centers in the grid.
  colGap: 150,
  rowGap: 150,
};

interface Pos {
  x: number;
  y: number;
}

export function autoArrangeTables(
  tables: SeatingTable[],
  layout?: VenueLayout,
): Map<string, Pos> {
  const W = layout?.width ?? DEFAULTS.width;
  const H = layout?.height ?? DEFAULTS.height;
  const dance = layout?.danceFloor ?? DEFAULTS.danceFloor;

  const slots = buildSlotList({ W, H, dance });
  const sorted = sortTablesForPlacement(tables);

  const out = new Map<string, Pos>();
  sorted.forEach((t, i) => {
    const slot = slots[i % slots.length];
    if (slot) {
      out.set(t.id, slot);
    }
  });
  return out;
}

/**
 * Sort tables so that the visually-prominent ones (VIP = lowest
 * `number`, then larger capacity) get the best slots. Tables without
 * a number fall to the end and pick whatever's left.
 */
function sortTablesForPlacement(tables: SeatingTable[]): SeatingTable[] {
  return [...tables].sort((a, b) => {
    const an = a.number ?? Number.POSITIVE_INFINITY;
    const bn = b.number ?? Number.POSITIVE_INFINITY;
    if (an !== bn) return an - bn;
    if (a.capacity !== b.capacity) return b.capacity - a.capacity;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Produce the ordered list of (x,y) slots around the dance floor.
 * Order: top band (center outward), right side (top to bottom),
 * left side (top to bottom), bottom band (center outward).
 */
function buildSlotList({
  W,
  H,
  dance,
}: {
  W: number;
  H: number;
  dance: { x: number; y: number; w: number; h: number };
}): Pos[] {
  const margin = DEFAULTS.margin;
  const colGap = DEFAULTS.colGap;
  const rowGap = DEFAULTS.rowGap;

  const danceLeft = dance.x;
  const danceRight = dance.x + dance.w;
  const danceTop = dance.y;
  const danceBottom = dance.y + dance.h;

  const slots: Pos[] = [];

  // ── Top band: row(s) above the dance floor, center-out so VIP
  //    (slot 0) sits dead-center above the dance floor. ──
  const topYTopmost = DEFAULTS.topPad;
  const topYBottommost = danceTop - margin;
  const topRows: number[] = [];
  for (let y = topYBottommost; y >= topYTopmost; y -= rowGap) {
    topRows.push(y);
  }
  // For each top row, snake from center outward (RTL — start right of center, then left of center, etc.).
  const topCols = pickCols({
    minX: DEFAULTS.sidePad,
    maxX: W - DEFAULTS.sidePad,
    gap: colGap,
  });
  const topColsCenterOut = centerOut(topCols, (danceLeft + danceRight) / 2);
  for (const y of topRows) {
    for (const x of topColsCenterOut) slots.push({ x, y });
  }

  // ── Right side band ──
  const sideYTop = DEFAULTS.topPad + rowGap / 2;
  const sideYBottom = H - DEFAULTS.bottomPad - rowGap / 2;
  const sideRows: number[] = [];
  for (let y = sideYTop; y <= sideYBottom; y += rowGap) sideRows.push(y);
  const rightCols: number[] = [];
  for (
    let x = danceRight + margin;
    x <= W - DEFAULTS.sidePad;
    x += colGap
  ) {
    rightCols.push(x);
  }
  for (const x of rightCols) {
    for (const y of sideRows) {
      // Skip slots that fall inside the dance band overlap zone.
      if (y >= danceTop - 10 && y <= danceBottom + 10) {
        // already covered by the dance floor area; allow only if outside the rect
        if (x >= danceLeft - 10 && x <= danceRight + 10) continue;
      }
      slots.push({ x, y });
    }
  }

  // ── Left side band ──
  const leftCols: number[] = [];
  for (
    let x = danceLeft - margin;
    x >= DEFAULTS.sidePad;
    x -= colGap
  ) {
    leftCols.push(x);
  }
  for (const x of leftCols) {
    for (const y of sideRows) {
      if (y >= danceTop - 10 && y <= danceBottom + 10) {
        if (x >= danceLeft - 10 && x <= danceRight + 10) continue;
      }
      slots.push({ x, y });
    }
  }

  // ── Bottom band: row(s) below the dance floor, center-out. ──
  const botYTopmost = danceBottom + margin;
  const botYBottommost = H - DEFAULTS.bottomPad;
  const botRows: number[] = [];
  for (let y = botYTopmost; y <= botYBottommost; y += rowGap) {
    botRows.push(y);
  }
  const botCols = pickCols({
    minX: DEFAULTS.sidePad,
    maxX: W - DEFAULTS.sidePad,
    gap: colGap,
  });
  const botColsCenterOut = centerOut(botCols, (danceLeft + danceRight) / 2);
  for (const y of botRows) {
    for (const x of botColsCenterOut) slots.push({ x, y });
  }

  return slots;
}

function pickCols({
  minX,
  maxX,
  gap,
}: {
  minX: number;
  maxX: number;
  gap: number;
}): number[] {
  const cols: number[] = [];
  for (let x = minX; x <= maxX; x += gap) cols.push(x);
  return cols;
}

/**
 * Reorder an array of numbers so the entries closest to `target` come
 * first. Used to make the top + bottom rows fan out from the center.
 */
function centerOut(arr: number[], target: number): number[] {
  return [...arr].sort(
    (a, b) => Math.abs(a - target) - Math.abs(b - target),
  );
}
