# TASKLIST · R46 — ROOM 3D quality lift + bug fixes

**Date:** 2026-05-18 · `tsc` ✅ · `lint` ✅ (0 err; 6 pre-existing) · `build` ✅ · `test` ✅ 9/9 · no new deps / no migration. three.js still lazy (ssr:false dynamic chunk — not in the eager bundle).

Owner: "make the 3D much higher quality + do bug fixes."

## Quality lift (`components/seating/Room3DScene.tsx`)

- **Real chairs** — were featureless cubes (a rotated symmetric box
  shows nothing). Now an instanced **seat** + instanced **backrest**,
  each rotated to face the table → a real chair silhouette, still only
  2 draw calls for *all* chairs.
- **Cinematic Lightformer rig** — warm key / cool rim / gold side fill /
  soft top box / tight specular **glint ring**. Believable reflections
  and highlights, computed once, no external HDRI.
- **Cleaner polished floor** — the old pass mirrored a 70×70 plane with
  `blur:[320,110]`/`mixStrength:2.2` → muddy. Now a sane 40×40 indoor
  floor, `blur:[140,50]`, `mixStrength:1.1`, `mirror:0.32` → a crisp
  polished sheen, also cheaper.
- ACES-filmic tone mapping + exposure 1.18, `powerPreference:
  "high-performance"`, `toneMapped={false}` on the gold emissives so
  the centerpieces / dance-floor rim actually glow.
- Added a glowing **gold rim ring** around the pulsing dance floor.

## Bug fixes

- Removed dead `receiveShadow` on the dance floor — realtime shadow
  maps are off (`shadows={false}`); grounding is the baked
  `ContactShadows`, so the flag was a no-op.
- Glass bottles: added `ior={1.45}` — `transmission` without an `ior`
  refracts incorrectly (flat/greyish glass).
- Gold accents were being tone-mapped down (looked dull); `toneMapped`
  disabled on those emissive materials so they read as light sources.
- `ContactShadows frames={1}` kept but verified it bakes after the
  instanced furniture is in the scene (drei builds the instancedMesh in
  the same commit, so the first baked frame includes chairs/plates).

## Verification

- ✓ `tsc` clean (drei v10 `Lightformer form` / all APIs typecheck)
- ✓ `lint` 0 errors (6 pre-existing warnings, unrelated)
- ✓ `build` compiled · ✓ `test` 9/9
- ✓ No new dependency; three.js remains a lazy dynamic chunk (not
  eager) — main bundle unaffected.
- ✓ `/seating` compiles & runs in-browser (auth-redirect, no crash;
  three not loaded on the default 2D map).
- ⏳ Owner-side per the agreed plan: on-device look + 60 fps in the
  photoreal scene (real GPU is the only true measure of the
  reflector/Environment cost).

> A broader app-wide bug audit (R30-style) was **not** done here — that
> is a separate dedicated pass; this round's bug fixes are scoped to the
> 3D feature (the freshly-shipped code most likely to harbor issues).
> Say the word for a full sweep.
