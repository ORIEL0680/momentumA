# TASKLIST · R50 — Fix "3D stuck on a long loading screen"

**Date:** 2026-05-19 · `tsc` ✅ · `lint` ✅ (0 err; 6 pre-existing) · `build` ✅ · `test` ✅ 9/9 · no new deps / no migration.

Owner: the 3D shows a long/endless loading screen.

## Root cause

The R48 `<ErrorBoundary>` catches **errors**, not **infinite
suspense**. Two things in the scene could leave it loading forever / for
a very long time:

1. **drei `<Environment>`** builds an env-map behind an *internal
   Suspense*. In this drei v10 / three 0.169 combo it could fail to
   resolve → the Canvas content stays suspended indefinitely (no error
   → ErrorBoundary never fires).
2. **R49 added troika `<Text>`**, which ballooned the lazy chunk
   (three + drei + postprocessing + camera-controls + troika-three-text)
   → on a real device the *module download* itself takes a long time =
   the long spinner, with nothing to bound it.

## Fixes

- **Removed `<Environment>` + `<Lightformer>`** → a non-suspending
  `hemisphereLight` + `ambientLight` (the spotlights + the R49
  rose/teal/gold accent point-lights still carry the look). Zero async,
  zero suspense, **and a smaller lazy chunk**. The stylized hall doesn't
  need a real env-map; reliability wins (the owner has hit 3D issues
  repeatedly).
- **`Room3D` watchdog** — the scene now calls `onReady()` on mount; if
  that hasn't happened within **15 s** the wrapper stops the endless
  spinner and shows a bounded notice ("3D is slow — use the map") with
  a one-tap **"נסו שוב"** that remounts the scene (`key={attempt}`).
  This makes an endless loading state structurally impossible (covers
  the slow-chunk case too, which an ErrorBoundary can't).
- Kept the R48 `ErrorBoundary` (errors) — now paired with the watchdog
  (hangs). Together: a 3D problem can only ever become a clean notice +
  the working 2D map, never a stuck screen.

## Verification

- ✓ tsc clean · ✓ lint 0 errors · ✓ build compiled · ✓ test 9/9
- ✓ three/drei/postprocessing/camera-controls/troika still lazy
  (dynamic ssr:false; main bundle unaffected).
- ⏳ On-device confirm the spinner is gone is owner-side (3D needs
  auth + event + opt-in). The watchdog now *guarantees* the spinner
  ends within 15 s regardless of cause — worst case is the graceful
  notice + 2D map + retry.

> If it still hangs on your device, the watchdog will now surface the
> 2D fallback within 15 s instead of spinning — and if there's a
> console error/stack, send it and I'll target that exact line.
