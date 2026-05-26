"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * R44 · Feature 1 — LIVING SPARK.
 *
 * A gold spark that *evolves* with the journey: scattered + slow when
 * the event is far, gathering and pulsing harder as it nears, a one-shot
 * burst on the day itself, then a steady wreath. Pure vanilla Canvas2D
 * (no libs), DPR-aware, single rAF loop @60fps, fully torn down on
 * unmount. `prefers-reduced-motion` → a static SVG of the *current*
 * stage (state preserved, zero animation), wired from the first render.
 *
 * Imperative reactions (wired-ready for vendorBooked / newRSVP /
 * budgetOverrun — the dashboard calls these when it detects a change;
 * we never fabricate fake triggers here):
 *   ref.current?.flash()  — 400ms gold flash
 *   ref.current?.ripple() — 800ms ring wave
 *   ref.current?.shake()  — 500ms red shake
 */

export interface LivingSparkHandle {
  flash: () => void;
  ripple: () => void;
  shake: () => void;
}

interface Props {
  /** Days until the event; null = unknown, negative = past. */
  daysUntilEvent: number | null;
  /** 0–100 journey progress — enriches the aria description only. */
  progress?: number;
  /** Rendered square size in CSS px (clamped 240–480). */
  size?: number;
}

type Stage = "far" | "gather" | "form" | "near" | "imminent" | "day" | "past";

const GOLD_LIGHT = [244, 222, 169] as const;
const GOLD = [212, 176, 104] as const;
const GOLD_DEEP = [168, 136, 74] as const;
const RED = [239, 103, 103] as const;

function stageFor(days: number | null): Stage {
  if (days == null) return "far";
  if (days < 0) return "past";
  if (days === 0) return "day";
  if (days <= 7) return "imminent";
  if (days <= 30) return "near";
  if (days <= 90) return "form";
  if (days <= 180) return "gather";
  return "far";
}

/** Per-stage tuning: how tight the cloud is + the breath/glow tempo. */
function stageParams(s: Stage): {
  tight: number; // 0 scattered … 1 collapsed to the core
  breathMs: number;
  glow: number; // 0–1 halo strength
} {
  switch (s) {
    case "far":
      return { tight: 0.05, breathMs: 4000, glow: 0.1 };
    case "gather":
      return { tight: 0.4, breathMs: 3200, glow: 0.22 };
    case "form":
      return { tight: 0.66, breathMs: 2000, glow: 0.38 };
    case "near":
      return { tight: 0.8, breathMs: 1000, glow: 0.6 };
    case "imminent":
      return { tight: 0.9, breathMs: 600, glow: 0.85 };
    case "day":
      return { tight: 0.78, breathMs: 1400, glow: 1 };
    case "past":
      return { tight: 0.72, breathMs: 2600, glow: 0.7 };
  }
}

function ariaFor(days: number | null, progress?: number): string {
  const p =
    progress != null
      ? progress >= 80
        ? " · רוב המשימות בוצעו"
        : progress >= 40
          ? " · באמצע הדרך"
          : " · בתחילת הדרך"
      : "";
  if (days == null) return "המומנטום שלך — סופרים את הימים" + p;
  if (days < 0) return "המומנטום שלך — האירוע מאחוריכם, תודה שתכננתם איתנו";
  if (days === 0) return "המומנטום שלך — היום הגדול הגיע!";
  return `המומנטום שלך — ${days} ימים לאירוע${p}`;
}

export const LivingSpark = forwardRef<LivingSparkHandle, Props>(
  function LivingSpark({ daysUntilEvent, progress, size = 320 }, ref) {
    // R139 — lowered the floor from 240 to 140 so the compacter
    // dashboard hero can render the spark at a more modest size
    // alongside the new save-the-date layout (was clamped up to 240).
    const px = Math.max(140, Math.min(480, size));
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [reduced, setReduced] = useState(false);

    const stage = useMemo(() => stageFor(daysUntilEvent), [daysUntilEvent]);
    const aria = useMemo(
      () => ariaFor(daysUntilEvent, progress),
      [daysUntilEvent, progress],
    );

    // One-shot reaction triggers, read by the rAF loop via a ref.
    const fx = useRef<{ flash: number; ripple: number; shake: number }>({
      flash: 0,
      ripple: 0,
      shake: 0,
    });
    useImperativeHandle(ref, () => ({
      flash: () => {
        fx.current.flash = performance.now();
      },
      ripple: () => {
        fx.current.ripple = performance.now();
      },
      shake: () => {
        fx.current.shake = performance.now();
      },
    }));

    // Track prefers-reduced-motion live.
    useEffect(() => {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const apply = () => setReduced(mq.matches);
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }, []);

    useEffect(() => {
      if (reduced) return; // static SVG path handles this
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = px * dpr;
      canvas.height = px * dpr;
      ctx.scale(dpr, dpr);

      const cx = px / 2;
      const cy = px / 2;
      const COUNT = 40;
      const baseR = px * 0.36;
      // Deterministic-ish layout (golden-angle) so it looks composed.
      const parts = Array.from({ length: COUNT }, (_, i) => {
        const a = i * 2.399963; // golden angle
        const rad = baseR * (0.35 + (i / COUNT) * 0.65);
        return {
          a,
          rad,
          // gentle per-particle phase so the cloud isn't synchronized
          phase: (i / COUNT) * Math.PI * 2,
          tone: i % 3,
          sz: 1.4 + (i % 5) * 0.5,
        };
      });

      let raf = 0;
      const start = performance.now();
      const burst = stage === "day" ? start : 0; // day → one-shot on mount

      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const rgba = (c: readonly number[], al: number) =>
        `rgba(${c[0]},${c[1]},${c[2]},${al})`;

      const draw = (now: number) => {
        const t = now - start;
        const sp = stageParams(stage);
        ctx.clearRect(0, 0, px, px);

        // shake offset (budgetOverrun)
        let ox = 0;
        let oy = 0;
        const shakeAge = now - fx.current.shake;
        if (fx.current.shake && shakeAge < 500) {
          const k = (1 - shakeAge / 500) * 6;
          ox = Math.sin(shakeAge / 18) * k;
          oy = Math.cos(shakeAge / 22) * k;
        }

        // breathing 0..1
        const breathe =
          0.5 + 0.5 * Math.sin((t / sp.breathMs) * Math.PI * 2);

        // halo
        const flashAge = now - fx.current.flash;
        const flashBoost =
          fx.current.flash && flashAge < 400 ? 1 - flashAge / 400 : 0;
        const haloR = baseR * (0.7 + breathe * 0.25);
        const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, haloR);
        const haloA = Math.min(1, sp.glow * (0.5 + breathe * 0.5) + flashBoost);
        g.addColorStop(0, rgba(GOLD_LIGHT, 0.22 * haloA + flashBoost * 0.3));
        g.addColorStop(0.5, rgba(GOLD, 0.12 * haloA));
        g.addColorStop(1, rgba(GOLD_DEEP, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, haloR, 0, Math.PI * 2);
        ctx.fill();

        // ripple (newRSVP) — an expanding ring
        const ripAge = now - fx.current.ripple;
        if (fx.current.ripple && ripAge < 800) {
          const rr = lerp(baseR * 0.3, baseR * 1.15, ripAge / 800);
          ctx.strokeStyle = rgba(GOLD_LIGHT, (1 - ripAge / 800) * 0.5);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx + ox, cy + oy, rr, 0, Math.PI * 2);
          ctx.stroke();
        }

        // one-shot burst on the day
        const burstT = burst ? (now - burst) / 900 : -1;

        for (const p of parts) {
          // collapse toward the core by stage tightness + slow drift
          const drift = Math.sin(t / 2600 + p.phase) * 0.06;
          let r = lerp(p.rad, baseR * 0.16, sp.tight) * (1 + drift);
          r *= 0.9 + breathe * 0.16;
          if (burstT >= 0 && burstT <= 1) {
            r += baseR * 0.9 * Math.sin(burstT * Math.PI) * (0.4 + p.tone * 0.2);
          }
          const ang = p.a + t / (sp.breathMs * 6);
          const x = cx + ox + Math.cos(ang) * r;
          const y = cy + oy + Math.sin(ang) * r;
          const tone =
            shakeAge < 500 && fx.current.shake
              ? RED
              : p.tone === 0
                ? GOLD_LIGHT
                : p.tone === 1
                  ? GOLD
                  : GOLD_DEEP;
          const al =
            (0.3 + 0.4 * breathe + sp.glow * 0.3 + flashBoost * 0.5) *
            (0.7 + 0.3 * Math.sin(t / 1000 + p.phase));
          ctx.fillStyle = rgba(tone, Math.min(1, al));
          ctx.beginPath();
          ctx.arc(x, y, p.sz * (0.8 + breathe * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }

        // bright core
        const coreA = 0.35 + sp.glow * 0.5 + breathe * 0.15 + flashBoost * 0.4;
        ctx.fillStyle = rgba(GOLD_LIGHT, Math.min(1, coreA));
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, 3 + sp.glow * 4 + breathe * 2, 0, Math.PI * 2);
        ctx.fill();

        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);

      return () => cancelAnimationFrame(raf);
    }, [reduced, px, stage]);

    // Static, animation-free SVG for reduced-motion: same palette, a
    // calm representation whose density reflects the current stage.
    if (reduced) {
      const sp = stageParams(stage);
      const ringR = px * (0.22 + sp.tight * 0.14);
      return (
        <div
          role="img"
          aria-label={aria}
          style={{ width: px, height: px }}
          className="relative"
        >
          <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`}>
            <defs>
              <radialGradient id="lsg">
                <stop offset="0%" stopColor="rgba(244,222,169,0.45)" />
                <stop offset="60%" stopColor="rgba(212,176,104,0.18)" />
                <stop offset="100%" stopColor="rgba(168,136,74,0)" />
              </radialGradient>
            </defs>
            <circle cx={px / 2} cy={px / 2} r={px * 0.42} fill="url(#lsg)" />
            {Array.from({ length: 24 }, (_, i) => {
              const a = i * 2.399963;
              const r = ringR * (0.5 + (i / 24) * 0.9);
              return (
                <circle
                  key={i}
                  cx={px / 2 + Math.cos(a) * r}
                  cy={px / 2 + Math.sin(a) * r}
                  r={2 + (i % 3)}
                  fill={
                    i % 3 === 0
                      ? "#F4DEA9"
                      : i % 3 === 1
                        ? "#D4B068"
                        : "#A8884A"
                  }
                  opacity={0.45 + sp.glow * 0.4}
                />
              );
            })}
            <circle
              cx={px / 2}
              cy={px / 2}
              r={4 + sp.glow * 4}
              fill="#F4DEA9"
            />
          </svg>
        </div>
      );
    }

    return (
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={aria}
        style={{ width: px, height: px }}
      />
    );
  },
);
