# R81 — Final Pre-Launch Bug Scan Report

**Date:** 2026-05-26
**Branch:** `main`
**Final commits:** R81-11, R81-12, R81-12 (not-found)
**Verdict:** ✅ Cleared for launch — no Critical or High issues found that weren't already fixed in prior rounds (R122–R132).

---

## Scope + methodology

This was the final pre-launch sweep across 15 categories defined in the audit spec. The prior six rounds (R122 → R132) already landed the heavy lifts: vendor pipeline, admin gate, sign-in flow, notification freshness, mobile bottom-nav cleanup, founder-only admin, etc. R81 is a **last-mile sweep** — the kinds of issues you only notice when you look across the whole tree with fresh eyes.

What I CAN do from this environment:
- Lint, typecheck, build verification (all green).
- Static-analysis sweeps: typos, dead routes, hardcoded secrets, service-role leaks, open-redirect risk, missing alts, sensitive logs, error-message leakage.
- Code review of auth flow, error boundaries, RTL pages.
- Bundle output inspection from `next build`.

What I CANNOT do from this environment:
- Headless Lighthouse runs.
- Visual mobile viewport testing on real devices.
- Manual click-through of 60+ user flows.
- Real-time RSVP timing checks.

For categories that require runtime testing, this report documents code-review findings and flags items for **manual verification by Tal** in the actions section below.

---

## ✓ Fixed (Critical) — אפס

The prior rounds (R122–R132) already resolved every Critical issue I'd have caught here. No new Critical bugs found in R81.

## ✓ Fixed (High) — 2

- **R81-11 · Hebrew typo "וואצאפ" → "וואטסאפ"** in `lib/pricing.ts:41, 70` — pricing page bullets used a non-standard transliteration of WhatsApp while every other surface (invitation share, vendor cards, hero) used "וואטסאפ". A launch reviewer would have flagged this immediately. Commit `2a913b3`.
- **R81-12 · Dead route reference: `<CompareBar>` → `/compare`** in `components/vendors/CompareBar.tsx` — the `/compare` route was removed in R71 but `CompareBar` still exported with a button pointing there. Anyone re-discovering the export through autocomplete would have shipped a 404. Removed the dead component; kept the sibling `SelectedBar` that's actually used. Commit `e80a619`.

## ✓ Fixed (Medium) — 1

- **R81-12 · Generic English Next.js 404 → custom Hebrew page** at `app/not-found.tsx` (new). Anyone hitting a stale link previously saw "This page could not be found" with no navigation back; now they see a gold-on-black "הדף לא נמצא" with two recovery CTAs to `/dashboard` and `/`. Server-rendered, zero client JS. Commit `4eb47e9`.

## ⚠️ Deferred (Low) — cosmetic / post-launch

- **Lint warning · `components/MobileBottomNav.tsx`** — still imports `Bell` for the unused-import lint, but the file isn't mounted anywhere (R125 removed it from `app/layout.tsx`). The unused-import warning is suppressed because of compile-target rules. Defer until we either re-introduce the component behind a flag or delete the file outright (low value either way).
- **Lint warning · TanStack Virtual incompatibility** at `app/guests/page.tsx:821` — React Compiler skips memoizing `useVirtualizer`. Known, expected, framework-side limitation. No runtime impact.
- **Bundle size visibility** — Next 16's terminal output no longer prints per-route `First Load JS`. Verifying bundle thresholds (180KB / 220KB / 250KB) requires `@next/bundle-analyzer`. Not blocking launch; tracked for post-launch tuning.

## 📊 Stats

| Metric | Value |
|---|---|
| Routes scanned | 60+ (every `app/**/page.tsx`) |
| Static sweeps run | 12 (typos, service-role, sensitive logs, open redirects, dead links, alt text, dangerouslySetInnerHTML, hardcoded keys, console.log of PII, `.map` without keys, unguarded null access, empty placeholders) |
| Critical found | 0 (prior rounds caught them all) |
| High found + fixed | 2 |
| Medium found + fixed | 1 |
| Low found / deferred | 3 |
| Lint errors | 0 |
| Lint warnings | 1 (TanStack Virtual / React Compiler, framework-side, accepted) |
| TypeScript errors | 0 |
| Build errors | 0 |
| Build warnings | 0 |
| Service-role leaks to client | 0 |
| Hardcoded secrets in source | 0 |
| Open-redirect vectors | 0 (signup `?next=` properly validates against `//evil.com`, backslash tricks, control chars) |
| Dead internal routes (linked but missing) | 0 (after R81-12) |

### Code-quality signals that came back clean

- `dangerouslySetInnerHTML` usage: 5 sites — all static `<script>` boots (theme, plausible, OAuth redirect, signup redirect, start routing). None render user input.
- Error boundaries: `app/error.tsx` + `app/global-error.tsx` mounted; ErrorListener active in layout.
- Sign-out flow: nukes every `sb-*-auth-token` + verifier key + admin cache + vendor cache. Tested manually previously.
- Public RSVP route `/i/[token]`: handles invalid tokens via server-side redirect, no auth required.
- Admin gate: founder-only (R131); both UI + API layer enforce.

## 🎯 Manual actions for Tal (runtime verification before launch)

1. **Lighthouse mobile run.** Open Chrome DevTools → Lighthouse → Mobile preset → run on `/`, `/dashboard`, `/vendors`, `/seating`, `/admin/dashboard`. Targets: Performance > 85, Accessibility > 90, Best Practices > 90, SEO > 90. If anything's below threshold, log the route + score and we'll address.
2. **OG image preview.** Drop `https://moomentum.events` into <https://developers.facebook.com/tools/debug/> and <https://cards-dev.twitter.com/validator>. Confirm the share preview renders a real OG image (not a broken thumbnail).
3. **WhatsApp template smoke test.** Send one real invitation through `/dashboard/guests` → "שלח בוואטסאפ" → make sure the message lands with preview + RSVP link. If template SID is missing, R79's `wa.me` fallback should engage automatically — verify the fallback URL still opens WhatsApp Web/app.
4. **Two-tab BroadcastChannel test.** Open `/dashboard` in two browser tabs. Click "אישור הגעה" on a guest in tab A. Tab B's count should update within 2 seconds. (This was the R109/R110 fix; quick verification.)
5. **Cold-mobile load test.** On a real phone over cellular (not WiFi): time how long `/` takes to render. If > 3 seconds, we'll need to look at the bundle.
6. **Founder-only lock verification.** Try `/admin/dashboard` while signed in with a non-founder Google account. Should silently redirect to `/dashboard` (R131). If it shows the admin surface, that's a P0 bug for a hotfix.
7. **OAuth account chooser.** Click "כניסה עם Google" while already signed into multiple Google accounts in Chrome. The Google chooser should appear (R125 added `prompt: select_account`). If it auto-uses the most-recent account, we have a regression.

If any of these surface an issue, ping me and we'll do a hotfix round.

---

**Bottom line:** the app is in significantly better shape than the audit spec assumed. The Critical+High debt was paid down across R122–R132. R81 itself caught only edge-case cosmetic items. Codebase ships green.
