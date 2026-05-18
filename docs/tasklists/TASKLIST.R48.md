# TASKLIST · R48 — 3D fault scan + hardening

**Date:** 2026-05-18 · `tsc` ✅ · `lint` ✅ (0 err; 6 pre-existing) · `build` ✅ · `test` ✅ 9/9 · no new deps / no migration. three/drei/pp/camera-controls stay lazy (dynamic ssr:false).

Owner: "the 3D shows a fault — do a comprehensive scan and handle it."
The 3D only mounts behind auth + an event + the 3D opt-in, so it can't
be reproduced headless; I scanned the R47 pipeline and hardened the
high-probability faults + added a blanket safety net.

## Root-cause scan (R47 → what could throw)

1. **`Environment preset="sunset"`** — drei fetches an HDRI from a CDN
   at runtime and **suspends** on it. A network failure / blocked CDN /
   slow link throws inside Suspense with **no fallback** → the whole
   Canvas faults. This is the clearest regression vs the working
   R45/R46 (which used an in-scene Lightformer rig, zero network).
   **#1 suspect.**
2. **Intro `c.rotate(Math.PI*0.5, 0, …)` from a top-down pose** —
   camera-controls gimbals/NaNs the azimuth at the exact pole.
3. **`ChromaticAberration offset={[…]}`** — pp v3's effect wants a real
   `THREE.Vector2`; a bare tuple can break the underlying pass at
   runtime even though the React-wrapper types accept it.
4. **No error boundary** — *any* three/drei/pp/camera-controls runtime
   error (shader compile, lost WebGL context, …) broke the whole view.

## Fixes

- **`Room3D.tsx`** — the dynamic `<Room3DScene>` is now wrapped in the
  app's `<ErrorBoundary>` with a clean Hebrew fallback ("3D hit a
  problem — switch back to map"). Any 3D runtime fault now degrades
  gracefully; the page's 2D toggle stays fully usable. **The real
  "handle it" — robust regardless of root cause.**
- **`Room3DScene.tsx`**
  - Removed `Environment preset="sunset"` → back to the deterministic
    in-scene **Lightformer** studio rig (warm key / cool rim / gold
    fill / soft top / glint ring). Same warm-HDR feel, **zero network /
    no Suspense-on-CDN**. Keeps spotlights + SoftShadows + post + the
    cinematic intro.
  - Intro is now **all deterministic `setLookAt`** (top → high
    orbit-in → descend → three-quarter); the gimbal-risky `.rotate()`
    from the pole is gone.
  - `ChromaticAberration offset` is now a real `new THREE.Vector2(...)`.

## Verification

- ✓ tsc clean (Lightformer, Vector2 offset, setLookAt all typecheck)
- ✓ lint 0 errors · ✓ build compiled · ✓ test 9/9
- ✓ three/drei/postprocessing remain lazy (only in the dynamic chunk).
- ✓ `/seating` compiles & runs in-browser (auth-redirect, no crash).
- ⏳ On-device confirmation that the fault is gone is owner-side (the
  3D needs auth + event + the opt-in to actually mount; the
  ErrorBoundary guarantees that even if something *else* fails on a
  specific GPU, the app no longer breaks — worst case is the graceful
  notice + the working 2D map).

> If a specific console error/stack is visible on your device, send it
> and I'll target that exact line — but the ErrorBoundary already means
> it can no longer take the page down.
