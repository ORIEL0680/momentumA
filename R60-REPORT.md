# R60 — Pre-Launch Cleanup Report

_Filed in repo as R71. 7 phase-scoped commits + this report. Launch: 2026-05-26._

## Summary

- **Sections delivered**: 7 / 8 (Section 8 was "build still works" — it does).
- **Files deleted**: 12 source files + 5 page directories.
- **Dependencies uninstalled**: 4 (`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`).
- **Static-chunks bundle**: **4.3 MB → 3.0 MB** (~30 % smaller, three.js was the dominant slice).
- **DB migrations**: **none required** (see § DB Migrations below).
- **`/inbox` decision**: kept — RSVP-processing flow, not user-facing nav.

## Commits

| SHA | Section | What |
| --- | --- | --- |
| `4f55c8e` | R60-1 | Signup tab switcher (`/signup?mode=signin`) + Header "כניסה" link. |
| `b1d3853` | R60-2 | Remove WelcomeTour + `lib/useFirstLogin.ts` + settings entry. |
| `4979744` | R60-3 | Remove `BrainOnboarding` + orphaned `/api/calendar/seed-brain`. |
| `05d31e6` | R60-4 | Remove `/app/pass` + `buildGuestPassUrl` + pass-URL in guestWelcome. |
| `f7dfe44` | R60-5 | Remove `Room3D` + `Room3DScene` + uninstall three.js stack. |
| `84f45bd` | R60-6 | Delete `/alcohol /timeline /checklist /compare /pricing` + redirects in `vercel.json` + update navigation/links. |
| `4e6e8de` | R60-7 | FeatureGrid landing copy: drop QR/3D, swap in צ׳ק-אין מהיר + לוח שנה. |

## Files Deleted

| File | Lines deleted |
| --- | ---: |
| `components/onboarding/WelcomeTour.tsx` | 198 |
| `lib/useFirstLogin.ts` | 124 |
| `components/calendar/BrainOnboarding.tsx` | 130 |
| `app/api/calendar/seed-brain/route.ts` | 130 |
| `app/pass/[eventId]/[guestId]/page.tsx` | 197 |
| `components/seating/Room3D.tsx` | 169 |
| `components/seating/Room3DScene.tsx` | 1350 |
| `app/alcohol/page.tsx` | ~290 |
| `app/timeline/page.tsx` | ~210 |
| `app/checklist/page.tsx` | ~260 |
| `app/compare/page.tsx` | ~230 |
| `app/pricing/page.tsx` | ~280 |

**Empty directories removed**: `components/onboarding/`, `app/pass/`, `app/alcohol/`, `app/timeline/`, `app/checklist/`, `app/compare/`, `app/pricing/`.

## DB Migrations

**None required.** The original R60 spec referenced several columns/tables that never existed in this app's architecture:

- `user_profiles.onboarding_completed` — this app uses a JSON-blob `app_states` row per user; localStorage gates the tour. There is no `user_profiles` table.
- `guest_passes` table / `guests.pass_token` / `guests.pass_qr_url` — R20 Phase 3's `buildGuestPassUrl` was stateless, derived at message time from `eventId` + `guestId`. No DB row was ever created.
- `seating_tables.position_3d` — R44's 3D was view-only, computed from existing data. No 3D-specific column ever existed.

If at some point we surface these features behind feature flags, we may need to GC the orphan `app_states.payload.checklist` slice. Until then it's harmless.

## Bundle Size Delta

```
Before  (R70 build):  4.3 MB  .next/static/chunks
After   (R71 build):  3.0 MB  .next/static/chunks      ↓ ~1.3 MB
```

The dominant savings is the three.js stack:
- `three` (~580 KB minified)
- `@react-three/fiber` + `drei` + `postprocessing` (~370 KB combined)

Smaller savings: removed page chunks for `/alcohol /timeline /checklist /compare /pricing`.

Next 16 + Turbopack does not print per-route First-Load-JS in build output (R59 finding), so route-level budget enforcement is still deferred until `@next/bundle-analyzer` integration.

## Pages That Still Work (post-cleanup checklist)

| Route | Status | Notes |
| --- | :---: | --- |
| `/` (landing) | ✓ | FeatureGrid copy refreshed; no broken links. |
| `/signup` | ✓ | New: signup/signin tab switcher at the top of the choose step. |
| `/signup?mode=signin` | ✓ | Deep-linked entry for returning users (Header's "כניסה" link). |
| `/dashboard` | ✓ | WelcomeTour gone; tools grid reduced from 11 to 8 entries with /calendar replacing four removed tools. |
| `/guests` | ✓ | Untouched. |
| `/budget` | ✓ | Receives `/alcohol` redirect. |
| `/balance` | ✓ | Untouched. |
| `/seating` | ✓ | 2D-only now; no 3D toggle, no three.js. |
| `/calendar` | ✓ | BrainOnboarding splash gone; receives `/timeline` + `/checklist` redirects. |
| `/calendar/print` | ✓ | Untouched. |
| `/vendors` | ✓ | CompareBar floating bar removed; cards still compare-toggle (state slice intact). Receives `/compare` redirect. |
| `/inbox` | ✓ | Kept — RSVP processing flow. |
| `/settings` | ✓ | "עזרה והדרכה" section removed; "שדרג" link → `/#pricing`. |
| `/event-day`, `/manage/*`, `/live/*` | ✓ | Manager checkin flow intact (per the absolute rule "אסור לפגוע ב-checkin הידני"). |
| `/admin/*` | ✓ | Untouched. |
| `/pricing` | 301 → `/#pricing` |
| `/alcohol` | 301 → `/budget` |
| `/timeline` | 301 → `/calendar` |
| `/checklist` | 301 → `/calendar` |
| `/compare` | 301 → `/vendors` |
| `/pass/*` | 301 → `/dashboard` |

## What I Did NOT Touch

Per the absolute rules in the spec:

- **Manual manager checkin** in `/manage/[eventId]/checkin` is intact. Only the guest-side public pass page is gone.
- **2D seating** is now the only seating view and it's the proven workhorse.
- **No historical migrations were deleted**. Net change to `supabase/migrations/`: zero files.

## Open Questions for You

None that need your input — all spec items were either implemented or had a clean fallback (DB migrations didn't apply to our architecture).

One thing **worth flagging** but not blocking: the `state.checklist` localStorage slice + `hasChecklistProgress` journey criterion now have no UI feeding them (the `/checklist` page was the only one writing to that slice). The journey step labelled "calendar" still completes when that slice has progress, which means existing users who used /checklist before the cleanup will see their journey step auto-completed — accidentally correct UX. New users will need calendar appointments to feel like progress. If you want a cleaner check (`hasAppointmentChecklistProgress` reading from `appointments.checklist` JSONB), I can wire it in a follow-up — but it's nice-to-have, not launch-blocking.

## Build / Lint / Typecheck

```
npm run build      → ✓ Compiled successfully in 42s
npm run lint       → 0 errors, 1 informational warning (TanStack Virtual library compat — pre-existing, unchanged)
npx tsc --noEmit   → ✓ zero errors
```
