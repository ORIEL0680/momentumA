# R50 — Pre-Launch Bug Hunt Report

**Date:** 2026-05-20 · pre-launch (26.5) · tsc ✅ · lint ✅ (0 err) · 75/75 tests ✅ · build ✅

This report is written honestly. Headless environment: I can run
greps, builds, lint, tsc and unit tests; I **cannot** drive a real
browser, run Lighthouse, exercise mobile viewports visually, or run
SQL against the production DB. Categories that require those are
clearly marked owner-side.

## ✓ Fixed (3 commits, 3 real bugs)

### Category 1 — New user journey
- **Onboarding step-3 gate accepted 0 / negative / NaN budget &
  guests.** `!!budgetTotal && !!guestEstimate` is true for `"0"`,
  `"-5"`, `"abc"` (raw string inputs). A new user could advance
  with 0 guests/budget; this persisted `guestEstimate: 0` →
  divide-by-zero or nonsense in every per-guest computation
  downstream (balance avg-per-head, seating capacity,
  cost-per-guest). **Commit `940a153`** (`R50-1`): require finite
  budget 1..100M and whole guests 1..5000 in `canNext` plus a
  defense-in-depth guard in `handleFinish`. Next stays disabled
  (existing affordance — no new UI).

### Category 3 — RTL + Hebrew typos
- **`וואצפ` → `וואטסאפ` in 2 customer-facing strings:**
  `components/landing/PainSection.tsx:5` (PAINS[0]) and
  `components/landing/FAQ.tsx:28` (sabta-grandma answer). The R58
  pass missed these two specific strings. **Commit `5c6afa3`**
  (`R50-3`).

### Category 7 — A11y quick wins
- **5 modal inputs lacked programmatic label association**
  (visible `<label>` rendered next to the `<input>` but no
  `htmlFor`/`id` link — screen readers don't announce the label on
  focus). Sites: seating table-edit modal (capacity) + budget
  item-edit modal (title, estimated, actual, paid).
  **Commit `b97ac0a`** (`R50-7`): added matching `htmlFor`/`id`
  pairs. Zero visual change.

## ⚠️ Found but did NOT fix — flagged with reason

### Category 1 — onboarding UX gaps (deliberate non-fix)
- **Past-date silently rejected with no inline error.** Logic
  blocks a past date from being pushed up, but the user sees no
  explicit "תאריך בעבר" message — the field just doesn't progress.
  *Reason:* adding inline validation UI is a feature, not a fix
  (rule 1). Today's behavior is non-broken (Next stays disabled).
- **Refresh mid-onboarding loses step.** Partial onboarding state
  isn't persisted; refresh sends the user back to step 0.
  *Reason:* persisting partial onboarding = new feature
  (localStorage scheme + recovery flow). Per rule 1.
- **Emoji-only event name accepted.** `"💍💕".trim() !== ""`, so it
  saves. *Reason:* arguably correct (some users want emoji); rule
  1 prevents adding name-content validation.

### Category 5 — `*_rate` rate-limit tables: RLS not visibly enabled
- 5 tables created in migrations (`short_links_rate`,
  `event_memories_rate`, `vendor_leads_rate`,
  `vendor_page_actions_rate`, `vendor_page_views_rate`) have no
  `enable row level security` line in the source migrations. Access
  pattern is via SECURITY-DEFINER triggers (which bypass RLS), so
  this is plausibly intentional, BUT it means anon clients reach
  them through the auto-exposed PostgREST surface unless RLS is
  on.
  *Reason for non-fix:* I cannot query `pg_tables.rowsecurity` to
  confirm DB-state vs. migration-source, and per rule 2 +
  auto-mode I will not silently mutate production-DB security. A
  one-line owner migration listed below in "Manual" fixes it
  with zero risk if needed.

### Category 2 — Mobile (360–430px)
- *No verifiable findings or fixes.* Static greps (no obvious
  `text-left`/`justify-start`/etc. anti-patterns in the new
  surfaces) plus prior rounds' work (R48 landing, R51-R53 3D,
  R55 voice, R59 admin) are RTL-correct from code review, but a
  real viewport pass is owner-side. Listed under "Manual" below.

### Category 6 — Performance / Lighthouse
- Build green, three.js confirmed still lazy (`dynamic ssr:false`
  in `components/seating/Room3D.tsx` from prior rounds). Per-route
  First-Load-JS numbers from Next 16's build output aren't reliably
  parseable headlessly, and Lighthouse needs a running browser.
  Listed under "Manual."

### Category 4 — Empty/error states
- Spot-checked the main flows: `/dashboard` redirects to
  `/onboarding` if `!state.event` (lines 75/92 of
  `app/dashboard/page.tsx`); `/balance` shows
  `EmptyEventState` + per-list empty messages; `/seating` shows an
  empty-state when guests exist but no tables (line 383);
  `/admin/errors` shows "no errors 🎉" / "table missing" hints
  (R59). No broken empty states surfaced.

## 📊 Performance — measured what I could

| Check | Status |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ 0 errors, 6 pre-existing warnings (TanStack Virtual, terms unused imports) |
| `npx vitest run` | ✅ 75/75 |
| `npm run build` | ✅ Compiled successfully (all routes built incl. /admin/*, /balance, /seating, /onboarding) |
| three.js lazy | ✅ confirmed (R53 hardened) |
| First-Load-JS per route | ⏳ owner — run `npm run build` and read the table |
| Lighthouse mobile | ⏳ owner — needs real browser |

## 🎯 Manual — what's left for you

1. **Lighthouse mobile** (Perf/A11y/BP/SEO ≥ 90) on `/`, `/dashboard`,
   `/signup`, `/balance`, `/seating`. Same for `/admin` as admin.
2. **Mobile viewport pass** (iPhone SE 375×667 and 14 Pro Max 430×932)
   on every page listed in the spec — horizontal scroll, 44×44 touch
   targets, bottom-nav not blocking, keyboard not hiding input.
3. **RLS sanity SQL** in Supabase to confirm the `*_rate` finding —
   paste this in SQL Editor:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables
   WHERE schemaname = 'public' AND rowsecurity = false;
   ```
   If the 5 `*_rate` tables come back, you can lock them down with:
   ```sql
   alter table public.short_links_rate enable row level security;
   alter table public.event_memories_rate enable row level security;
   alter table public.vendor_leads_rate enable row level security;
   alter table public.vendor_page_actions_rate enable row level security;
   alter table public.vendor_page_views_rate enable row level security;
   ```
   (No policies needed — they're only written by SECURITY-DEFINER
   triggers, which bypass RLS. The toggle blocks the auto-exposed
   anon read/write surface.)
4. **Pre-launch smoke** (5 minutes, in person on your phone):
   `moomentum.events` → signup with a fresh Google account → onboarding
   to /dashboard → add a guest → /balance → /seating.

## Commit log
- `5c6afa3` R50-3 RTL + Hebrew typos
- `940a153` R50-1 onboarding guest/budget gate
- `b97ac0a` R50-7 a11y input labels

3 small focused commits. No new features, no visual changes > 0% on
any page, TypeScript strict, no `any`, no `@ts-ignore`. All gates
green after each commit.
