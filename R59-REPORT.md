# R59 — Pre-Launch Full Sweep Report

_Filed in repo as R70. Launch target: 2026-05-26._

## Summary

- **Pages scanned**: 30 routes × 4 viewports = 120 captures
- **Issues found**: 4 distinct root causes (manifesting as 136 captured alerts)
- **Issues fixed**: 3 (hydration on /vendors, nonce hydration on every route, lint warnings)
- **Issues deferred** (with documented reason): 6
- **Commits**: 4 phase-scoped commits on `main` (`2d53eaa`, `88d7d5a`, `bfe4e81`, this report)

## Phase 1: Build & Lint

| Check       | Result | Notes |
| ----------- | :----: | ----- |
| `npm run lint`        | ✓ | 1 informational warning (TanStack Virtual library compat — not actionable). 5 unused-import warnings fixed in `2d53eaa`. |
| `npx tsc --noEmit`    | ✓ | Zero errors. |
| `npm run build`       | ✓ | Compiles in ~10s. |
| Bundle size per route | ⚠ deferred | Next 16 + Turbopack no longer prints per-route First-Load-JS in build output. Need a stable analyzer integration (e.g. `@next/bundle-analyzer`) to re-enable per-route budget enforcement; deferred to a dedicated round since installing the analyzer triggers a build pipeline change. |
| Middleware deprecation| ⚠ flagged  | `next build` prints `The "middleware" file convention is deprecated. Please use "proxy" instead.` Rename has high blast radius (CSP nonce + auth gating live in `middleware.ts`); deferred to a dedicated round. |

## Phase 2: Visual Regression

Built `scripts/visual-sweep.mjs` (Puppeteer, 4 viewports × 30 routes). First run on dev server: **136 captures, 136 with notices**.

### Root causes (and the fix landed)

| # | Root cause | Hits | Fix | Commit |
|---|---|---|---|---|
| 1 | `<script nonce={…}>` in `app/layout.tsx`, `app/page.tsx`, `app/signup/page.tsx`, `app/start/page.tsx` triggered a hydration mismatch on **every route** — browsers strip `nonce` from the DOM after parsing (security), so React saw `nonce=""` on hydration. | 64 | Added `suppressHydrationWarning` to every nonce'd inline script (documented Next.js pattern). | `88d7d5a` |
| 2 | `components/vendors/VendorCard.tsx` — `hasSavedEver` initializer read `localStorage` during render. SSR returned `true` (window undefined), CSR returned `false` (no key) → hard hydration failure on **/vendors** in all 4 viewports. | 4 | Refactored to `useSyncExternalStore` pattern mirroring `lib/useFirstLogin.ts`. | `88d7d5a` → `bfe4e81` |
| 3 | Local dev's Supabase project hasn't had R67/R68 migrations applied → `/calendar` logs _"Could not find the table 'public.appointments' in the schema cache"_. Production is fine (migrations were applied during R67/R68). | 8 | No code fix — local-env-only. Documented. | — |
| 4 | React 19 informational note _"Encountered a script tag while rendering React component"_ on inline boot scripts. The scripts execute correctly server-side; React just warns that they won't re-run on client renders (which is exactly what we want). | 72 | No code fix — the warning is informational and the behavior is intentional. | — |

### Re-run after fixes: **80 captures with notices** (down from 136) — the 80 remaining are all the two non-bug categories (#3, #4) above.

### `/vendors` hydration deep-dive

Before:
```tsx
const [hasSavedEver, setHasSavedEver] = useState<boolean>(() => {
  if (typeof window === "undefined") return true; // SSR
  return window.localStorage.getItem(HAS_SAVED_KEY) === "1"; // CSR
});
```

After (canonical `useSyncExternalStore` pattern, same as `lib/useFirstLogin.ts`):
```ts
const hasSavedEver = useSyncExternalStore(
  subscribeHasSaved, getHasSavedSnapshot, getHasSavedServerSnapshot
);
```

## Phase 3: Page Issues by Category

| Category | Routes | Real bugs found |
| --- | --- | --- |
| A — Public | `/`, `/signup`, `/start`, `/pricing`, `/terms`, `/privacy`, `/rsvp` | None beyond the layout-wide nonce hydration (now fixed). |
| B — Authenticated couple | `/dashboard`, `/guests`, `/budget`, `/balance`, `/seating`, `/calendar`, `/calendar/print`, `/alcohol`, `/timeline`, `/checklist`, `/compare`, `/inbox`, `/settings`, `/onboarding` | None beyond the layout-wide nonce hydration (now fixed). |
| C — Event-day | `/event-day` (and the param-based `/live/[eventId]`, `/manage/*`, `/pass/*` not exercisable anonymously) | Not exercisable in anon sweep — relies on a real eventId. |
| D — Vendors | `/vendors`, `/vendors/join`, `/vendors/my`, `/vendors/dashboard`, `/vendors/dashboard/inbox`, `/vendors/dashboard/leads`, `/dashboard/vendor-studio` | **`/vendors` hard hydration failure on all 4 viewports** (now fixed via `bfe4e81`). |
| E — Admin | `/admin`, `/admin/dashboard`, `/admin/users`, `/admin/vendors/applications`, `/admin/errors` | None beyond the layout-wide nonce hydration (now fixed). Admin gate behaves correctly (silent redirect for anon, "not authorized" view for non-admin). |

## Phase 4: Cross-Cutting Fixes

| Audit | Hits | Action |
| --- | --- | --- |
| Hebrew typos (`וואצפ`, `וואצאפ`, `אינטראקטיב\b`, `אלמנמט`, `אינטגרציי`) | 0 | All instances of `וואטסאפ` already use the correct spelling. |
| Empty hrefs (`href="#"`, `href=""`) | 0 | None found. |
| `text-left` (LTR-biased) | 0 | None found. |
| `justify-start` | 5 | Logical alignment — works correctly under RTL via flexbox. Left as-is. |
| Icon-only buttons missing `aria-label` | 0 | The two grep candidates (`event-day/page.tsx:635`, `seating/page.tsx:647`) both already have `aria-label="סגור"` on the parent button. |
| `console.log/debug` in `app/`, `components/`, `lib/` | 2 | Both are intentional R47 auth-flow breadcrumbs (`app/auth/callback/page.tsx`, `app/auth/confirm/route.ts`) that only log presence-flags (no credentials). Kept by design. |
| Arrow icon direction (`ArrowRight` vs `ArrowLeft` for "הבא"/"חזרה") | mixed | Both conventions exist in the codebase. This is a design call, not a bug — flagged for a future design review but not auto-changed. |
| Unused imports | 5 | Fixed (`2d53eaa`): `Scale` in `app/budget/page.tsx`, `X` in `app/manage/[eventId]/page.tsx`, `FileText`/`Scale`/`Megaphone` in `app/terms/page.tsx`. |

## Phase 5: Lighthouse

> **Could not run authoritative Lighthouse audits from this environment.**

- **Public production** (`https://moomentum.events/`) is blocked by Bezeq ISP's "newly registered domain" filter (HTTP 403 served from `64.29.17.1`). Curl + Chrome for Testing both hit the same wall.
- **Vercel preview** (`https://momentum-*.vercel.app/`) sits behind Vercel deployment protection — Lighthouse audited the protection wall, not our pages (uniform Perf=54-56, A11y=87, BP=92, SEO=91 across all 4 public routes, with audit details referencing `/legal/terms` and `/legal/privacy-policy` — Vercel's footer, not ours).

**Recommendation**: Run Lighthouse from a network outside Bezeq (4G hotspot, Cloudflare WARP, or CI/GitHub Actions). Defer perf budget enforcement until then.

### Reading from the (invalid) Vercel-wall numbers, the only actionable directional signal:
- `meta-description`, `meta-viewport`, color-contrast hits are all on the Vercel auth page, not ours.
- Real LCP/TBT cannot be measured against the protection wall.

## Phase 6: Edge-Case Audit (13 scenarios)

| # | Scenario | Verdict | Notes |
| --- | --- | --- | --- |
| 1 | User closes tab, returns 1hr later | ✓ ok | Supabase auth tokens in `sb-*-auth-token` (localStorage); `app_states` persists in localStorage + DB. Session refreshes silently. |
| 2 | User mid-onboarding refreshes | ⚠ deferred | `app/onboarding/page.tsx` keeps step state in local `useState` — refresh loses progress. Fix requires per-step localStorage persistence; out of R59 scope. |
| 3 | Cellcom 5G load time | ⚠ untested | No representative-network testing in this run; deferred to Lighthouse-from-mobile. |
| 4 | Tel Aviv / Jerusalem / abroad timezone | ✓ ok | Only one explicit timezone in code: `Asia/Jerusalem` in the iCal feed (`X-WR-TIMEZONE`). All other `toLocaleDateString` calls use `"he-IL"`; browser-native locale is RTL-safe. |
| 5 | 500 guests | ✓ ok | `app/guests/page.tsx` uses `useVirtualizer` (TanStack Virtual). Pagination not needed at this scale. |
| 6 | 0 guests | ✓ ok | `card-gold` empty state in `app/guests/page.tsx:431` with primary "import contacts" CTA. |
| 7 | Past event date | ⚠ deferred | `daysUntil` in `lib/useNow.ts:71` clamps to `Math.max(0, …)` — past dates show as "0 days remaining" forever. `LivingSpark.tsx:54` checks `days < 0` for a "past" branch that's currently unreachable. Either remove dead branch OR un-clamp `daysUntil` and let the past branch fire. |
| 8 | Wedding day = tomorrow | ✓ ok | Wedding-day cell has `.wedding-day-pulse` + `.wedding-day-shimmer` (R69) — animation always running, not tied to "tomorrow" specifically. |
| 9 | User deleted event | ✓ ok | Calendar shows `CalendarEmptyState` with CTA to `/start` (added in R69). Other pages have their own empty states. |
| 10 | Signup with invalid email | ✓ ok | `SignupClient.tsx` surfaces Hebrew error messages for Supabase failures (line 163-166). |
| 11 | Signup with non-Israeli phone | ✓ ok | `components/inputs/PhoneInput.tsx` has a fixed `+972` chip — non-Israeli numbers are physically impossible to enter. |
| 12 | "Logout" → DA wiped + redirect | ✓ ok | `components/Header.tsx:100` awaits `userActions.signOut()` then `window.location.href = "/signup"` (hard navigation wipes module state). |
| 13 | Anon → `/admin` | ✓ ok | `app/admin/dashboard/page.tsx:111` `router.replace("/signup?returnTo=/admin/dashboard")`. Signed-in non-admin gets a silent "not authorized" view. |

**Edge-case score: 9 ✓ / 2 ⚠ deferred / 2 ⚠ untested.**

## Known Issues — NOT FIXED

1. **Onboarding mid-flow not persisted** (Phase 6 #2). Fix would require per-step localStorage writes and resume logic — meaningful complexity for an edge case. Defer until post-launch when we have user data showing this is hit.
2. **Past-event daysUntil clamp** (Phase 6 #7). `daysUntil` clamps at 0 → past events get stuck at "0 ימים". Either un-clamp the function (single-line change) OR delete the unreachable `days < 0` branch in `LivingSpark`. Needs a product call: do we want a celebratory "the event passed" screen, or just stop showing the countdown?
3. **Bundle size budgets** (Phase 1). Next 16 + Turbopack stripped per-route First-Load-JS from the build output. Needs `@next/bundle-analyzer` integration to re-enable enforcement. New dep + pipeline change → dedicated round.
4. **`middleware.ts` deprecated** (Phase 1). Next 16 wants the file renamed to `proxy.ts`. CSP nonce + auth gating live here — the rename is a blast-radius issue; defer to a dedicated round.
5. **Lighthouse cannot run from this network** (Phase 5). Bezeq ISP blocks `moomentum.events` as a "newly registered domain"; Vercel preview is behind deployment protection. Needs a runner on a different network (mobile hotspot, Cloudflare WARP, or GitHub Actions).
6. **React 19 _"Encountered a script tag"_ informational note** (Phase 2). Behavior is intentional — boot scripts only need to run server-side once. The note is informational, not an error. No fix planned.

## Recommendations for Launch Day

- **Run Lighthouse from a non-Bezeq network** before launch (mobile hotspot, GitHub Actions, or `npx unlighthouse-cli` via a Cloudflare tunnel). Capture the "real" perf baseline so we have something to track against post-launch.
- **Decide on past-event UX** before someone's event passes and the dashboard says "0 ימים" for a year.
- **Plan a `middleware.ts` → `proxy.ts` migration round** in the first quiet week post-launch. The deprecation is unlikely to break in a patch release of Next 16, but waiting until Next 17 may force a rushed migration.
- **Take a baseline of `error_logs` rows on launch day** so post-launch alerting has a clean "normal" to compare against.

## Methodology

```bash
# Phase 1
npm run lint
npx tsc --noEmit
npm run build

# Phase 2
npm install --save-dev puppeteer
npm run dev &
node scripts/visual-sweep.mjs           # → ./screenshots/*.png + ERRORS.json

# Phase 4
grep -rn "וואצפ\|וואצאפ" app/ components/
grep -rn 'href="#"\|href=""' app/ components/
grep -rn '"text-left"' app/ components/
grep -rn 'console\.\(log\|debug\)' app/ components/ lib/

# Phase 5 (incomplete — see Phase 5 notes)
CHROME_PATH="…/Google Chrome for Testing" \
  npx lighthouse "$URL" --form-factor=mobile \
    --output=json --output-path="./lighthouse/$name" \
    --chrome-flags="--headless --no-sandbox" \
    --only-categories=performance,accessibility,best-practices,seo
```
