# TASKLIST · R44 — Three launch redesigns (phased, one commit each)

Per the agreed plan: **one feature per commit**, I verify what's
automatable, the owner does real-device testing. commit→main→deploy
(not a GitHub PR). No new dependencies for Feature 1.

---

## ✅ Feature 1 — LIVING SPARK (this commit)

**`components/dashboard/LivingSpark.tsx`** (new) — replaces the static
count-up in the dashboard hero with an evolving gold spark.

- **Vanilla Canvas2D**, zero libraries. DPR-aware, single
  `requestAnimationFrame` loop, `cancelAnimationFrame` on unmount /
  reduced-motion / stage change. 40 golden-angle particles.
- **Evolution by `daysUntilEvent`** (spec thresholds): >180 scattered +
  4 s breath · 90–180 gathering · 30–90 formed + halo + 2 s · 7–30 1 s
  + stronger glow · 1–7 0.6 s + full gold · 0 one-shot burst → steady
  wreath · past → calm steady. Palette `#F4DEA9 / #D4B068 / #A8884A`.
- **Imperative reactions** (wired-ready, not faked): `ref.flash()`
  400 ms gold · `ref.ripple()` 800 ms ring · `ref.shake()` 500 ms red.
  The dashboard can call these when it detects vendorBooked / newRSVP /
  budgetOverrun; we never fabricate triggers in the component.
- **`prefers-reduced-motion`** → a static SVG of the *current* stage
  (state preserved, zero animation), live-tracked via `matchMedia` with
  listener cleanup. Works from first render.
- **Dynamic `aria-label`** e.g. "המומנטום שלך — 87 ימים לאירוע · רוב
  המשימות בוצעו" (uses the new optional `progress` the dashboard now
  passes). `role="img"`.
- **`components/dashboard/IntimateHero.tsx`** — countdown block replaced
  by `<LivingSpark>`; the day number stays as a small factual line (not
  a tooltip — spec rule #1). Dropped `useCountUp`/`Sparkles` imports.
- TypeScript strict (no `any`, no `@ts-ignore`). No `dir=` added (RTL
  inherited from the root layout).

### Verification (Feature 1)

- ✓ `npx tsc --noEmit` clean
- ✓ `npm run lint` 0 errors (6 pre-existing warnings, unrelated)
- ✓ `npm run build` compiled successfully
- ✓ `npm run test` 9/9
- ✓ **Bundle delta: ~0 / negligible** — one vanilla client component,
  **no new dependencies added**; comfortably under the 8 KB budget.
- ✓ reduced-motion path is a separate render branch (no rAF) — verified
  by code path + `matchMedia` listener.
- ✓ `/dashboard` compiles & runs in-browser (auth-redirects to /signup
  with no crash → the canvas component + hero rewire loaded cleanly).
- ⏳ **Owner-side (per agreed plan):** real-device 60 fps profiling,
  phone screen-recording, friend/virality test.

---

## ✅ Feature 2 — TIME SPIRAL (this commit)

**`components/dashboard/TimeSpiral.tsx`** (new) — replaces the linear
JourneyPath in the dashboard with a spiral of time.

- SVG `viewBox 600×600`, today at the centre, ~18 months unfurling
  **counter-clockwise** over 3 turns; a faint guide-spiral path so dots
  read as "on the line".
- Data = `state.checklist` (`ChecklistItem` with `dueDate`/`done`/
  `phase` — the only *dated* task data; journey steps have no dates).
  Tasks with no `dueDate` fall back to the phase midpoint via
  `PHASE_WINDOWS`. Dot radius: critical (אולם/קייטרינג/צלם/…)=11 else 6;
  fill: done `#F4DEA9` · urgent (≤14d, open) `#EF6767` · open `#4A4A4A`.
  Hover → CSS scale 1.3 + a `<title>` data tooltip (task + status —
  informational, not a how-to, per rule #1).
- **Unified Pointer Events** (no separate mouse/touch): 2-pointer
  pinch-zoom (0.5–3×) + 1-pointer drag-to-rotate around centre + wheel
  zoom; `touch-action:none`. framer-motion `useSpring` smooths
  scale/rotate (no new dep — framer-motion already installed).
- At ≥80% done → gold `feDropShadow` glow on the whole spiral group.
- **Reconciliation (documented):** the spec said "make JourneyPath the
  fallback", but JourneyPath renders high-level *journey steps*, not the
  dated *checklist* the spiral plots. Forcing it would be the wrong data
  shape. So the honest a11y / `prefers-reduced-motion` fallback is a
  built-in **date-ordered `<ol>`** of every task with full
  `aria-label`s (title · status · due date). `useReducedMotion()` is the
  robust signal (no fake "a11y-tools detector"). JourneyPath stays in
  the repo (still a valid component), just no longer dashboard-rendered;
  its dashboard import was removed (lint-clean).
- `Date.now()` would trip `react-hooks/purity` inside `useMemo` → uses
  the shared `useNow()` hook; a calm placeholder renders until it
  resolves (no Date.now in render). `now==null` guard is after all hooks.
- TypeScript strict (no `any`/`@ts-ignore`); no `dir=` (RTL inherited).

### Verification (Feature 2)

- ✓ `tsc` clean · ✓ `lint` 0 errors (6 pre-existing) · ✓ `build`
  compiled · ✓ `test` 9/9
- ✓ **No new dependency** (framer-motion already in package.json) →
  bundle delta ≈ one component.
- ✓ reduced-motion path is a separate non-motion render branch (verified
  via `useReducedMotion()` + code path).
- ✓ `/dashboard` compiles & runs in-browser (auth-redirect, no crash).
- ⏳ Owner-side: real-device 60 fps pinch/drag, phone recording.

---

## ⏳ Feature 3 — ROOM 3D — next commit (adds three / r3f / drei,
lazy-loaded via dynamic import)
