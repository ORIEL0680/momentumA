# TASKLIST · R49 — ROOM 3D: guest-name + table-number labels, more colour/life

**Date:** 2026-05-19 · `tsc` ✅ · `lint` ✅ (0 err; 6 pre-existing) · `build` ✅ (✓ compiled, 51/51 static) · `test` ✅ 9/9 · no new deps / no migration. three/drei/pp stay lazy.

Owner: marketing/design leap — the guest's **name on every (taken)
chair**, the **table number on every table**, more colour & life,
Apple-keynote grade.

## Labels (the headline)

- Served the project's existing Heebo subsets at `public/fonts/`
  (`heebo-heb.ttf` Hebrew, `heebo-lat.ttf` Latin/digits) — the same
  fonts the R28 OG images use, so Hebrew coverage is proven.
- **Per table:** a billboarded gold `<Text>` of the table number
  (`table.number ?? index+1`), Latin font, outlined, above the
  centerpiece.
- **Per taken seat:** the assigned guest's name, billboarded white
  `<Text>` floating just above the chair — Hebrew font, `direction="rtl"`
  (troika bidi) so names read correctly, outlined for legibility on any
  background.
- Guest→seat mapping is now real (seat slot _k_ ← the _k_-th guest
  assigned to that table), so the right name sits on the right chair.
- **Billboarded** (drei `<Billboard>`) → labels stay readable from any
  angle and through the whole cinematic flyover.
- **Perf-bounded:** name labels render for *occupied* seats only (not
  empty chairs — also the correct semantic), with a hard cap (skip
  names above 400 occupied) so a huge hall can't drown the GPU in text
  meshes. Furniture stays instanced; PerformanceMonitor still gates post.

## Colour & life

Cinematic colour separation without losing gold as the hero: a soft
**rose** wash on one side, a **teal** on the other, a warm **gold**
fill from the front (distance/decay-tuned point lights). Reads like a
real lit event / keynote stage, adds depth — the dance floor keeps its
breathing pulse.

## Robustness (kept from R48)

The whole scene is still inside the `<ErrorBoundary>` — if a font 404s
or troika/WebGL trips on a device, it degrades to the clean notice and
the 2D map keeps working (no white screen).

## Verification

- ✓ tsc clean (drei `<Text>` accepts `font`/`direction`/`textAlign`)
- ✓ lint 0 errors · ✓ build ✓ compiled 51/51 · ✓ test 9/9
- ✓ fonts present in `public/fonts/`; three/drei/pp remain lazy.
- ✓ `/seating` compiles & runs in-browser (auth-redirect, no crash).
- ⏳ Owner-side: the actual look — name legibility / Hebrew RTL
  shaping / the colour grade / 60 fps with N labels — needs the device
  + a real event (auth + seated guests + the 3D opt-in). The
  ErrorBoundary guarantees the app can't break even if a specific GPU
  or the font load misbehaves.

> Still deferred (R47): L5 (segmented UI / WALK / long-press sheet) +
> L6 (assignment ripple) — separate focused pass.
