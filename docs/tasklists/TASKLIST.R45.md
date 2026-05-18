# TASKLIST · R45 — Cancel TIME SPIRAL + photoreal ROOM 3D

**Date:** 2026-05-18 · `tsc` ✅ · `lint` ✅ (0 err; 6 pre-existing) · `build` ✅ · `test` ✅ 9/9 · no migration / no new deps.

Owner request: drop R44 Feature 2 entirely, and make Feature 3 look
~100× better (photorealistic, high quality).

## 1 — TIME SPIRAL removed (R44 §2 reverted)

- Deleted `components/dashboard/TimeSpiral.tsx`.
- `app/dashboard/page.tsx` — import + render reverted to the linear
  **`JourneyPath`** (the component R44 §2 had displaced; it was kept in
  the repo, so this is a clean restore — `getJourneyForState` /
  `progress` were already in scope). No remaining `TimeSpiral`
  references anywhere.

## 2 — ROOM 3D, photoreal pass

`components/seating/Room3DScene.tsx` rewritten. Still **lazy** behind
`Room3D`'s `next/dynamic(ssr:false)` — three.js stays out of the main
bundle, only downloads on the "תלת-מימד" opt-in (build confirms).

Quality upgrades (no extra postprocessing dependency — all via drei +
PBR):

- **ACES-filmic tone mapping** + exposure 1.15 (cinematic response),
  proper color management (r3f v9 default).
- **Studio Environment** from `<Lightformer>` soft-boxes → realistic
  reflections + bounce, **computed once, no external HDRI fetch**.
- **Polished mirrored floor** (`MeshReflectorMaterial`, blurred
  reflection) — the single biggest realism jump.
- **Baked soft `ContactShadows`** (`frames={1}`) — grounded soft shadow
  at a fraction of realtime-shadow-map cost (kept `shadows={false}`).
- **PBR everything**: rounded clear-coat bar + polished countertop,
  glass bottles (`transmission`), draped **white tablecloths** with
  `sheen`, pedestal bases, glowing centerpieces (+ a tiny per-table
  point light), instanced **plates** and **rotated upholstered chairs**,
  soft emissive **pulsing dance floor**, fog for depth.
- Kept: instancing (chairs/plates/guest-orbs = one draw call each),
  dpr capped `[1,2]`, `OrbitControls`, and the headline **"תעמדו במקום
  של [שם]"** camera flight to a seat at eye height.

Heavier than the flat pass (the owner explicitly prioritized quality)
but lazy/opt-in, shadows baked once, dpr capped — built to still hold
on mid-range mobile.

### Deviations (unchanged from R44, still documented)

No stage (`cfg.hasStage` doesn't exist in eventConfig). Full
device-orientation WALK still deferred — the camera-flight "stand where
X sits" is the wow moment.

## Verification

- ✓ `tsc` clean · ✓ `lint` 0 errors · ✓ `build` compiled · ✓ `test` 9/9
- ✓ No new dependency (drei photoreal components were already in
  `@react-three/drei`); three.js remains a lazy chunk (not eager).
- ✓ `/dashboard` (JourneyPath restored) and `/seating` (photoreal
  Room3D) compile & run in-browser (auth-redirect, no crash; three not
  loaded on the default 2D map).
- ⏳ Owner-side per the agreed plan: on-device 60 fps in the photoreal
  scene + screen recording (real-device GPU is the only true measure of
  the reflector/Environment cost).
