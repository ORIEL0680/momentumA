"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import type { ChecklistItem } from "@/lib/types";
import { PHASE_WINDOWS } from "@/lib/checklists";
import { useNow } from "@/lib/useNow";

/**
 * R44 · Feature 2 — TIME SPIRAL.
 *
 * The linear journey path becomes a spiral of time: today at the
 * center, ~18 months unfurling counter-clockwise over 3 turns. Each
 * checklist task is a dot — radius by criticality, colour by state
 * (open / done / urgent). Pinch-zoom + drag-to-rotate via unified
 * Pointer Events; framer-motion springs smooth the transform. At ≥80%
 * done the whole spiral gets a gold glow.
 *
 * Accessibility / reduced-motion: a static, date-ordered list of every
 * task with full aria-labels (the spec said "make JourneyPath the
 * fallback", but JourneyPath renders high-level *journey steps*, not
 * the dated *checklist* the spiral plots — so the honest a11y fallback
 * is this date-ordered task list, not a wrong-shaped component).
 */

const VIEW = 600;
const CX = VIEW / 2;
const CY = VIEW / 2;
const TURNS = 3;
const WINDOW_DAYS = 18 * 30; // ~18 months
const R_MIN = 46;
const R_MAX = 278;

const CRITICAL_RE =
  /אולם|גן\s*איר|קייטרינג|צל[םמ]|וידא|תקליטן|להק|רב\b|מוהל|חופ/;

interface Plotted {
  item: ChecklistItem;
  x: number;
  y: number;
  r: number;
  fill: string;
  offsetDays: number;
  due: number; // ms epoch (for sorting the a11y list)
}

function dueMsFor(it: ChecklistItem, eventDate: string): number {
  if (it.dueDate) {
    const t = new Date(it.dueDate).getTime();
    if (!Number.isNaN(t)) return t;
  }
  // No explicit dueDate → phase midpoint relative to the event.
  const ev = new Date(eventDate).getTime();
  if (Number.isNaN(ev)) return Date.now();
  const w = PHASE_WINDOWS[it.phase];
  const mid = w ? w.midDays : 30;
  return ev - mid * 86_400_000;
}

export function TimeSpiral({
  checklist,
  eventDate,
}: {
  checklist: ChecklistItem[];
  eventDate: string;
}) {
  const reduce = useReducedMotion();
  // `now` via the shared hook — calling Date.now() in a useMemo trips
  // react-hooks/purity. null on SSR/first paint → calm placeholder.
  const now = useNow(null);

  const { dots, spiralPath, doneRatio, ordered } = useMemo(() => {
    const nowMs = now ?? 0;
    const items = checklist ?? [];
    const enriched = items.map((it) => {
      const due = dueMsFor(it, eventDate);
      const offsetDays = Math.max(0, (due - nowMs) / 86_400_000);
      const f = Math.min(1, offsetDays / WINDOW_DAYS);
      const radius = R_MIN + f * (R_MAX - R_MIN);
      // Counter-clockwise: subtract the angle as time grows.
      const theta = -f * TURNS * Math.PI * 2 - Math.PI / 2;
      const critical = CRITICAL_RE.test(it.title);
      const urgent = !it.done && offsetDays <= 14;
      const dot: Plotted = {
        item: it,
        x: CX + Math.cos(theta) * radius,
        y: CY + Math.sin(theta) * radius,
        r: critical ? 11 : 6,
        fill: it.done ? "#F4DEA9" : urgent ? "#EF6767" : "#4A4A4A",
        offsetDays,
        due,
      };
      return dot;
    });

    // A faint guide spiral so the dots read as "on a path".
    let d = "";
    for (let i = 0; i <= 240; i++) {
      const f = i / 240;
      const radius = R_MIN + f * (R_MAX - R_MIN);
      const theta = -f * TURNS * Math.PI * 2 - Math.PI / 2;
      const x = CX + Math.cos(theta) * radius;
      const y = CY + Math.sin(theta) * radius;
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
    }

    const done = enriched.filter((e) => e.item.done).length;
    return {
      dots: enriched,
      spiralPath: d,
      doneRatio: enriched.length ? done / enriched.length : 0,
      ordered: [...enriched].sort((a, b) => a.due - b.due),
    };
  }, [checklist, eventDate, now]);

  // ── Gesture state (pointer events only) ──
  const scale = useSpring(useMotionValue(1), { stiffness: 200, damping: 26 });
  const rotate = useSpring(useMotionValue(0), { stiffness: 200, damping: 26 });
  const gest = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    startDist: number;
    startScale: number;
    lastAngle: number | null;
  }>({ pointers: new Map(), startDist: 0, startScale: 1, lastAngle: null });

  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));
  const angleTo = (x: number, y: number, rect: DOMRect) =>
    Math.atan2(
      y - (rect.top + rect.height / 2),
      x - (rect.left + rect.width / 2),
    );

  if (now == null) {
    return (
      <section
        className="mt-10 rounded-3xl"
        aria-hidden
        style={{
          height: 240,
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(212,176,104,0.06), transparent 70%), var(--input-bg)",
          border: "1px solid var(--border)",
        }}
      />
    );
  }

  if (checklist.length === 0) {
    return (
      <section className="mt-10 text-center">
        <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
          עוד אין משימות במסע.{" "}
          <Link href="/checklist" className="text-[--accent] font-semibold">
            צרו צ׳קליסט →
          </Link>
        </p>
      </section>
    );
  }

  // Accessible / reduced-motion fallback: a date-ordered task list.
  if (reduce) {
    return (
      <section className="mt-10" aria-label="ציר הזמן של המשימות">
        <h2 className="text-2xl font-bold gradient-text mb-4">המסע שלכם</h2>
        <ol className="space-y-2">
          {ordered.map((d) => {
            const status = d.item.done
              ? "הושלם"
              : d.offsetDays <= 14
                ? "דחוף"
                : "פתוח";
            const dateStr = new Date(d.due).toLocaleDateString("he-IL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            return (
              <li
                key={d.item.id}
                className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--border)",
                }}
                aria-label={`${d.item.title} — ${status} — עד ${dateStr}`}
              >
                <span className="font-medium">{d.item.title}</span>
                <span
                  className="text-xs ltr-num shrink-0"
                  style={{
                    color: d.item.done
                      ? "#F4DEA9"
                      : d.offsetDays <= 14
                        ? "#EF6767"
                        : "var(--foreground-muted)",
                  }}
                >
                  {status} · {dateStr}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }

  const goldGlow = doneRatio >= 0.8;

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-2xl font-bold gradient-text">ספירת הזמן שלכם</h2>
        <span
          className="text-xs"
          style={{ color: "var(--foreground-muted)" }}
        >
          צביטה לזום · גרירה לסיבוב
        </span>
      </div>
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 50%, rgba(212,176,104,0.08), transparent 70%), var(--input-bg)",
          border: "1px solid var(--border)",
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="w-full h-auto block"
          style={{ touchAction: "none", maxHeight: "70vh" }}
          role="img"
          aria-label={`ספירלת זמן — ${dots.length} משימות, ${Math.round(
            doneRatio * 100,
          )}% הושלמו`}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            const g = gest.current;
            g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (g.pointers.size === 2) {
              const [a, b] = [...g.pointers.values()];
              g.startDist = Math.hypot(a.x - b.x, a.y - b.y);
              g.startScale = scale.get();
            } else {
              g.lastAngle = angleTo(
                e.clientX,
                e.clientY,
                e.currentTarget.getBoundingClientRect(),
              );
            }
          }}
          onPointerMove={(e) => {
            const g = gest.current;
            if (!g.pointers.has(e.pointerId)) return;
            g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (g.pointers.size === 2 && g.startDist > 0) {
              const [a, b] = [...g.pointers.values()];
              const dist = Math.hypot(a.x - b.x, a.y - b.y);
              scale.set(
                clamp((g.startScale * dist) / g.startDist, 0.5, 3),
              );
            } else if (g.pointers.size === 1 && g.lastAngle != null) {
              const rect = e.currentTarget.getBoundingClientRect();
              const ang = angleTo(e.clientX, e.clientY, rect);
              rotate.set(rotate.get() + (ang - g.lastAngle) * (180 / Math.PI));
              g.lastAngle = ang;
            }
          }}
          onPointerUp={(e) => {
            const g = gest.current;
            g.pointers.delete(e.pointerId);
            g.lastAngle = null;
            g.startDist = 0;
          }}
          onPointerCancel={(e) => {
            gest.current.pointers.delete(e.pointerId);
          }}
          onWheel={(e) => {
            scale.set(clamp(scale.get() - e.deltaY * 0.0015, 0.5, 3));
          }}
        >
          <defs>
            <filter id="ts-gold" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="6"
                floodColor="#D4B068"
                floodOpacity="0.7"
              />
            </filter>
          </defs>
          <motion.g
            style={{ scale, rotate, originX: "300px", originY: "300px" }}
            filter={goldGlow ? "url(#ts-gold)" : undefined}
          >
            <path
              d={spiralPath}
              fill="none"
              stroke="rgba(212,176,104,0.25)"
              strokeWidth={1.5}
            />
            <circle cx={CX} cy={CY} r={5} fill="#F4DEA9" />
            {dots.map((d) => (
              <g key={d.item.id} className="ts-dot">
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={d.r}
                  fill={d.fill}
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={0.5}
                >
                  <title>
                    {d.item.title} —{" "}
                    {d.item.done
                      ? "הושלם"
                      : d.offsetDays <= 14
                        ? "דחוף"
                        : "פתוח"}
                  </title>
                </circle>
              </g>
            ))}
          </motion.g>
        </svg>
      </div>
      <style>{`.ts-dot circle{transition:transform .15s ease;transform-box:fill-box;transform-origin:center}.ts-dot:hover circle{transform:scale(1.3)}`}</style>
    </section>
  );
}
