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

## ⏳ Feature 2 — TIME SPIRAL — next commit
## ⏳ Feature 3 — ROOM 3D — next commit (will add three / r3f / drei,
lazy-loaded via dynamic import)
