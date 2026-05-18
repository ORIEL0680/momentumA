# TASKLIST · R47 (R44.5) — ROOM 3D "Apple-Maps-Flyover" pass

**Date:** 2026-05-18 · `tsc` ✅ · `lint` ✅ (0 err; 6 pre-existing) · `build` ✅ · `test` ✅ 9/9 · no migration. New dep `@react-three/postprocessing@3` — **lazy only** (imported solely by the ssr:false dynamic Room3DScene; main bundle unaffected, build confirms `/seating` chunked).

Owner: take ROOM from "home-CAD" to flyover-grade. "Improve what
exists, don't add features." Done — the **visual soul** layers:

## Shipped — Layers 1, 2, 3, 4, 7

- **L1 lighting (the 80%):** removed flat ambient/directional → drei
  `Environment preset="sunset" background={false}` (real HDR) + two
  volumetric `spotLight`s (dance floor 8 / bar 3) + `SoftShadows
  size=25 samples=16` (PCSS) + ACES tone mapping, exposure 1.1,
  `outputColorSpace: SRGB` + atmospheric `fog #0A0A0F 15→35`.
- **L2 materials:** parquet `meshPhysicalMaterial` floor
  (clearcoat 0.8); sheened white tablecloth (`sheen`/`sheenColor`/
  `sheenRoughness`) on a thin leg; glass bottles
  (`transmission 0.9`, `ior 1.45`); upholstered seat + backrest;
  emissive pulsing dance floor; gold centerpieces `toneMapped=false`.
- **L3 post:** `<EffectComposer>` — Bloom (mipmapBlur) + Vignette +
  ChromaticAberration + ACES `ToneMapping`. **Perf-gated**: only on
  `devicePixelRatio ≥ 2` AND while `PerformanceMonitor` hasn't
  declined (auto-off on weak GPUs).
- **L4 cinematic intro:** one `CameraControls` (`makeDefault`) runs a
  0–6 s move — top (13 m) → slow rotate → descend to the dance floor
  → settle three-quarter hero angle. **One tap anywhere skips** and
  hands control to the user; "stand where X" reuses the same rig.
- **L7 perf:** every chair (seat/backrest) / plate / guest-orb is one
  `<Instances>` draw call; `dpr [1,2]`; `PerformanceMonitor` drops the
  post chain if it can't hold; three.js/pp stay lazy.

## Deferred (honest) — Layers 5 & 6, next focused pass

5 (full segmented-pill UI replacing all buttons + drag-to-edit + WALK
device-orientation mode + long-press seat sheet) and 6 (assignment
ripple + hover-scale spring) are **substantial new interactions**, not
"improve what exists". Half-baking them would fail the owner's own
"4/4 or don't ship" bar. The current functional control (guest select
+ "back to overview" in `Room3D.tsx`) is kept so nothing regresses;
L5/L6 are queued as the next dedicated round.

## Documented deviations

- **frameloop stays continuous, not `demand`** (spec L7). `demand`
  freezes rendering when idle → would kill the breathing dance-floor
  pulse and the intro, and directly fails acceptance Q3 ("does it
  breathe when idle?"). Cost is held instead via instancing + dpr cap
  + perf-gated effects.
- **Chairs are instanced boxes, not chamfered `RoundedBox`** (spec L2
  vs L7). L7 makes `<Instances>` a hard requirement; `RoundedBox`
  geometry can't be instanced. Instancing wins; the "not plastic" look
  now comes from lighting + materials + post (where it actually lives).

## Verification

- ✓ tsc clean (CameraControls/setLookAt/rotate, pp components,
  ToneMappingMode, PerformanceMonitor, instanced castShadow all
  typecheck) · ✓ lint 0 errors · ✓ build compiled · ✓ test 9/9
- ✓ `@react-three/postprocessing` is lazy (only in the dynamic chunk).
- ✓ `/seating` compiles & runs in-browser (auth-redirect, no crash;
  3D stack not loaded on the default 2D map).
- ⏳ The Apple test (15 s on-device video → ask a non-tech friend
  "what is this?") and on-device 60 fps are **owner-side** per the
  agreed plan — real-GPU look + the HDRI/post cost can only be judged
  on a physical device, which I can't run headless.
