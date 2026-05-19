# TASKLIST · R51 — Real fix for "3D stuck on a long loading screen"

**Date:** 2026-05-19 · `tsc` ✅ · `lint` ✅ (0 err; 6 pre-existing) · `build` ✅ · `test` ✅ 9/9 · no new deps / no migration.

Owner: "still the same fault — comprehensive scan, fix it."

## The real root cause (found this pass)

R48 (ErrorBoundary) and R50 (remove `<Environment>` + 15 s watchdog)
both missed it because it is **neither an error nor a slow chunk** — it
is a **main-thread freeze**:

R49 rendered, for **every occupied seat**, a Hebrew **troika SDF
`<Text>`** wrapped in a per-frame `<Billboard>` (cap was 400). A normal
150–400-guest hall = **hundreds of SDF text meshes**. troika does bidi +
complex Hebrew shaping + builds a glyph atlas per text; doing that for
hundreds of meshes on mount stalls the main thread for **seconds** and
each `<Billboard>` adds per-frame quaternion work for every label.

Why R50's watchdog didn't save it: the scene calls `onReady()` on mount
(it mounts fine), which **cancels the 15 s watchdog**, and *then* the
troika layout freezes the device — so it still looked stuck. A freeze
isn't an error (ErrorBoundary can't catch it) and the chunk did load
(watchdog already cancelled).

## Fix

- Guest-name `<Text>` labels now render **only for the focused table**
  (≤ one tableful — ~12 max). **At initial load there is no focus →
  ZERO name labels → zero troika freeze.** Pick "תעמדו במקום של…" to
  reveal a table's names (a handful at a time — interactive).
- **Table-number** labels still render for every table — cheap (digits,
  ≈ number of tables, ≤~25; shared Latin font, one fetch).
- Gold orbs still mark every occupied seat (instanced — one draw call).
- Kept R48 ErrorBoundary + R50 watchdog as belt-and-suspenders.

This is the correct, honest bound: rendering every guest's Hebrew SDF
label simultaneously is not feasible at interactive rates on mobile —
not a fixable "bug", a hard ceiling. Names-on-focus delivers the intent
("see who sits where") without the freeze.

## Verification

- ✓ tsc clean · ✓ lint 0 errors · ✓ build compiled · ✓ test 9/9
- ✓ Change is contained to the label set; everything else (lights,
  materials, intro, instancing, lazy chunk) unchanged.
- ⏳ On-device confirm by the owner — but the initial 3D view now
  creates **no** Hebrew SDF text at all (only a few digit labels), so
  the multi-second mount freeze is structurally gone; names stream in
  ≤12-at-a-time only when a table is focused.
