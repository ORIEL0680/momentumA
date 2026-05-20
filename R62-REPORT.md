# R62 — Pre-Launch Security & Bug Sweep

_Filed in repo as R75. Launch target: 2026-05-26._

## Headline

- **Critical found**: 1 (RLS missing on 5 internal rate-limit tables) → migration drafted, awaiting your `psql` run.
- **High found**: 0.
- **Medium found**: 2 (npm audit moderate × 2, iOS input-zoom). One fixed inline; the other two deferred.
- **All code-side fixes**: build + lint + typecheck green.

## Critical Found & Fixed (or pending DB action)

### 🔴 Cat 1 — RLS missing on 5 internal `*_rate` tables

| Table | Status |
| --- | --- |
| `event_memories_rate` | No `ENABLE ROW LEVEL SECURITY` in migrations |
| `short_links_rate` | Same |
| `vendor_leads_rate` | Same |
| `vendor_page_actions_rate` | Same |
| `vendor_page_views_rate` | Same |

**Impact**: Without RLS, an authenticated Supabase client can `DELETE FROM short_links_rate WHERE event_id = '...'` to reset their per-hour bucket and bypass the rate limit. Could also `SELECT *` to read other tenants' counters (low-value leak).

**Fix**: New migration `supabase/migrations/2026-05-20-r62-rate-tables-rls.sql` does two things:
1. Promotes the 5 trigger functions to `SECURITY DEFINER` so they keep working with RLS locked down.
2. Enables RLS on each `*_rate` table with **no policies** (= deny-all for regular clients).

> 🔧 **Manual action required**: run `supabase/migrations/2026-05-20-r62-rate-tables-rls.sql` in the Supabase SQL editor before launch.

## Medium Found & Fixed

### 🟡 Cat 11 — iOS Safari auto-zooms `text-sm` form inputs

`.input` (the shared form-field class in `app/globals.css`) had no explicit `font-size`. When a wrapping element used Tailwind's `text-sm` (14px), iOS Safari triggered its auto-zoom-on-focus behavior, jarring users mid-typing.

**Fix**: explicit `font-size: 16px` floor on `.input`. Tailwind utilities can still override per-instance for dense forms, but the default is safe.

## Medium Found & Deferred (with reason)

### 🟡 Cat 8 — npm audit (2 moderate)

| Advisory | Severity | Fix |
| --- | --- | --- |
| postcss < 8.5.10 (bundled inside Next.js) | moderate (CVSS 6.1) | Needs a Next.js minor/major bump |
| ~~ws 8.0–8.20.1~~ | moderate (CVSS 4.4) | **Fixed** by `npm audit fix` |

`npm audit fix` cleared the `ws` vuln. The two remaining `postcss` advisories live inside `node_modules/next/node_modules/postcss` and require a Next.js version bump. Per your rule ("major version bump → תדווח לי, אל תעדכן"), deferred.

### 🟡 Cat 11 — iOS Safari `100vh` bottom-bar offset (72 sites)

72 occurrences of `min-h-screen` / `h-screen` / `100vh`. On iOS Safari, `100vh` doesn't account for the URL bar — content extends below the visible area. The modern fix is `dvh` (dynamic viewport height). Deferred because:
- Refactoring 72 sites is high-touch.
- Real impact is "page extends slightly below the fold" — not broken, just slightly off.
- A dedicated round should also test `svh` vs `dvh` vs `lvh` to find the right default.

## Clean Categories (no findings)

| Cat | Audit | Result |
| --- | --- | --- |
| 2 | Service-role key client leakage | 4 hits, all server-only (`app/api/**`, `lib/admin/server.ts`, `lib/supabase/service.ts` with `import "server-only"`). |
| 3 | PII leak (URLs / console / analytics / errors) | Zero hits. `track("signup_started", { method: "phone" })` passes the *choice*, not the actual phone. |
| 4 | XSS surface | 6 `dangerouslySetInnerHTML` sites — 5 constants, 1 (`buildRedirectScript(next)`) hardened with origin-filter regex + `JSON.stringify` escaping; `jsonLdSafe` already escapes `<`/`>`/`&`/`'`. Zero `eval` / `new Function`. Zero SQL-template-literal injection. |
| 5 | Auth bypass | 3 unauth API routes (`/api/health`, `/api/invitation/view`, `/api/vendors/apply`) all intentional public endpoints; `/api/manager/invite` has `auth.getUser()`. Middleware matcher covers everything except static assets. Admin gate enforced both client-side (`router.replace` to `/signup`) and server-side (`requireAdmin()` in API routes). |
| 6 | CSRF / cookies | App uses Authorization-header Bearer JWT in localStorage — not cookies. Traditional CSRF doesn't apply (other origins can't read localStorage). No cookies set anywhere. |
| 7 | Open redirect / external links | `buildRedirectScript` rejects scheme-relative, backslash, angle-brackets, and quotes; falls back to `/dashboard`. Multi-line check confirms zero `target="_blank"` anchors missing `rel="noopener noreferrer"`. |
| 9 | Race / date / null / NaN / arrays | Zero async-useEffect set-state without cancel flag. All `parseInt`/`parseFloat` sites have a `Number.isFinite` / `Number.isNaN` / regex pre-check. All `state.event.X` chains sample-verified to live inside `state.event ? …` ternaries or `if (!state.event) return` early-returns. |
| 10 | Performance / re-renders / keys | Zero `.map()` JSX hits missing `key=`. R59 already audited heavy operations. |

## RLS Audit Summary

| Metric | Count |
| --- | --- |
| Tables in `public.*` (excluding helper rows) | 27 |
| Tables without `ENABLE ROW LEVEL SECURITY` | **5** (all `*_rate` counters — fix migration drafted) |
| Tables without any policies | 0 (excluding the 5 above, which are designed deny-all post-fix) |
| Suspicious `USING (true)` policies | 0 — all 8 `using (true)` hits are intentional public-read tables (`vendor_cost_reports`, `vendor_reviews`, `vendor_review_responses`, `vendor_review_helpful`, `event_memories`, `short_links`, `invitation_views`, `vendor_page_views`/`actions`) |

## RPC `SECURITY DEFINER` Audit — Manual Required

Could not run from CLI (no direct DB access). Run in Supabase SQL editor:

```sql
SELECT proname, prosecdef
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND prosecdef = false
ORDER BY proname;
```

Expected: zero rows after the R62 migration runs (the 5 rate-limit functions are explicitly promoted in the new migration; other RPCs were promoted in earlier rounds).

## NPM Audit Summary

| Severity | Count (before) | Count (after `npm audit fix`) |
| --- | --- | --- |
| Critical | 0 | 0 |
| High | 0 | 0 |
| Moderate | 3 | 2 (postcss × 2, requires Next.js bump) |
| Low | 0 | 0 |

## Manual Actions Required From You

1. **Run the new migration in Supabase**:
   ```
   supabase/migrations/2026-05-20-r62-rate-tables-rls.sql
   ```
   This is the only DB change required for R62. Idempotent — safe to re-run.
2. **Run the `prosecdef` query above in Supabase SQL editor** to confirm all RPCs are `SECURITY DEFINER`. Expected output: zero rows.
3. **(Optional)** Schedule a Next.js minor-version bump after launch to clear the 2 remaining moderate `postcss` advisories.

## Methodology

```bash
# Cat 1 — grep migrations for tables without ENABLE ROW LEVEL SECURITY
grep -h "enable row level security\|create table" supabase/migrations/*.sql | …

# Cat 2 — service-role surface
grep -rn "SERVICE_ROLE\|service_role" app/ lib/ components/ public/

# Cat 3 — PII grep matrix (URLs, console, analytics, errors)

# Cat 4 — dangerouslySetInnerHTML / eval / RPC template literals
grep -rn "dangerouslySetInnerHTML" app/ components/
grep -rEn '\beval\s*\(|\bnew Function\s*\(' app/ lib/ components/

# Cat 5 — API routes without auth helpers
find app/api -name "route.ts" | while read f; do
  grep -qE "auth\.getUser|auth\.getSession|requireAdmin|token|service_role" "$f" || echo "  $f"
done

# Cat 7 — target="_blank" multi-line check (Python regex against the full anchor tag)

# Cat 8 — npm audit --omit=dev

# Cat 9 — async-useEffect-without-cancel-flag (Python regex)

# Cat 10 — .map JSX missing key= (Python regex)

# Cat 11 — grep min-h-screen / 100vh
```
