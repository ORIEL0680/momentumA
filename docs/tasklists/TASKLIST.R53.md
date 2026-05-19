# TASKLIST · R53 — brighter wedding hall + central dance floor + 3D tap-to-edit

**Date:** 2026-05-19 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 9/9 · no new deps / no migration.

Owner: still too black, want more colour, a real hall with a central
dance floor, and customers able to edit a table in 3D (e.g. a long
"knights' table") and see it change.

## Done (deterministic, verifiable)

1. **Killed "way too black"** — biggest brightness lift yet: walls
   champagne `#3A2C20`, floor lighter walnut `#6B4A2C`, fog lifted &
   pushed far (22→55, no more black void), hemisphere ×2 (→1.15),
   ambient ×2.5 (→0.4), key spotlight 8→16, and 5 rich colour
   point-lights brightened (rose / teal / gold / **emerald** / candle)
   so the hall reads colourful and lit.
2. **Central luxe dance floor** — replaced the flat plate with a
   reflective gold inlay + a glowing toneMapped gold **rim ring** +
   a soft uplight, pulsing on the beat. Reads unmistakably as
   "רחבת ריקודים באמצע".
3. **3D tap-to-edit** — tapping a table in 3D opens the existing table
   editor (`onTableTap` threaded page → Room3D → Scene → table group,
   with `stopPropagation` so it doesn't drag the camera). Editing a
   table's **capacity** in that editor already changes the 3D live
   (more seats → more chairs/guest-orbs; name/number update) — so a
   host raising a table to a big "knights' table" is reflected in 3D
   now.
- Kept: focus-only name labels (R51), table-number labels (R49),
  ErrorBoundary + watchdog (R48/R50), instancing, lazy chunk.

## Honest deferral

The round→**rectangular long-table geometry** is not in yet — a
"knights' table" currently shows as a (larger) round table with more
seats. Re-laying seats along a rectangle + a rect cloth needs a careful
`TablePlot` change; doing it half-blind risks another regression. The
*edit-reflects-in-3D* requirement IS met via capacity; the long
**shape** is the one deferred sub-item (flagged, next pass).

## Verification

- ✓ tsc clean · lint 0 · build · test 9/9 · onTableTap typed end-to-end.
- ⏳ The look + the tap-to-edit feel are owner-side on device (3D needs
  auth + event + opt-in; I can't see it). Brightness/colour/dance-floor
  are deterministic colour/geometry changes — no perf-sensitive code or
  new lights-per-table added (kept Phase-7-safe).
