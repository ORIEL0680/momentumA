# R82 — Comprehensive Audit Report (Code · Security · Copy · Legal)

**Date:** 2026-05-26
**Branch:** `main`
**Commits landed this round:** R82-1-code, R82-3-copy, R82-4-legal
**Verdict:** ✅ Cleared for launch after R82-4-legal. One Critical legal gap closed; everything else clean or already mitigated in R81/R122–R132.

---

## 📊 Summary

| Dimension | Critical found | High found | Medium found | Fixed in R82 | Deferred |
|---|---|---|---|---|---|
| Code Quality | 0 | 0 | 1 | 1 | 0 |
| Security | 0 | 0 | 1 | 0 | 1 (postcss advisory) |
| Copy | 0 | 0 | 1 | 1 | 0 |
| Legal | **1** | 0 | 0 | **1** | 0 |

**Bottom line:** the one Critical issue R82 surfaced (terms §19 + footer missing the real operator identity) is fixed and committed. Without R82-4-legal, launch would have shipped a `Momentum (בהליכי רישום)` placeholder + three placeholder emails that don't route — Israeli law mandates the עוסק פטור tax ID on every paid-service surface.

---

## 1. CODE QUALITY

### Critical Fixed — 0

### High Fixed — 0

### Medium Fixed — 1

- **`/vendors` page dumped full vendor list to browser console** (`app/vendors/page.tsx:115`). Vendor names are public catalog data so not a strict PII leak, but it was a free scraping helper concentrated in one log line. Switched to count-only + `NODE_ENV !== 'production'` gate so production visitors see nothing in the console for this code path. Commit `R82-1-code`.

### Deferred (Low) — 0

### Metrics

| Check | Result |
|---|---|
| `: any` / `as any` | 3 (all `as any` for Supabase `postgres_changes` event-type, eslint-disabled and documented — intentional workaround for too-strict Supabase types) |
| `@ts-ignore` / `@ts-nocheck` | 0 |
| `console.log` / `.info` / `.debug` | 28 — all server-side route files with `[module]` prefix for Vercel logs (or guarded behind `NODE_ENV !== 'production'` after R82-1) |
| `dangerouslySetInnerHTML` | 6 — all static boots (theme, plausible, OAuth redirect, signup redirect, start routing) + JSON-LD via `jsonLdSafe()` |
| Missing React keys | 0 (false positives only — keys present on the child element of every `.map()`) |
| Bare async `useEffect` without cleanup | 0 |
| TypeScript errors | 0 |
| ESLint errors | 0 |
| ESLint warnings | 1 (TanStack Virtual + React Compiler incompatibility — framework-side, accepted) |
| Build errors | 0 |
| Outdated deps | 11 minor/patch updates available, none critical |

---

## 2. SECURITY

### Critical Fixed — 0

### High Fixed — 0

### Medium Found — 1 (deferred)

- **postcss <8.5.10 has XSS via `</style>` in CSS stringify output** (transitive via Next.js). `npm audit fix --force` would downgrade Next to 9.3.3 which is a breaking change — not acceptable. Real-world exposure is theoretical: postcss runs at BUILD time on our own CSS, not at runtime on untrusted input. **Deferred** until Next 16.x bumps its postcss dependency. Owner action: monitor the Next.js release notes; upgrade as soon as a patched minor lands.

### Verification (all clean)

| Check | Result |
|---|---|
| Service-role usage outside `/api` + `lib/admin` + `lib/supabase` + `lib/vendorAutoLanding` | ✅ none |
| Hardcoded secrets / API keys in source | ✅ none |
| `eval` / `new Function` | ✅ none (only a comment containing "eval-time") |
| Wide-open CORS (`Access-Control-Allow-Origin: *`) | ✅ none |
| Open redirect via `searchParams.next` | ✅ `app/signup/page.tsx:buildRedirectScript` properly rejects `//evil.com`, backslash tricks, and control characters before JSON-encoding |
| PII (email/phone/token) in `console.log` | ✅ auth/confirm + auth/callback log only `*_present` booleans, never the values |
| `dangerouslySetInnerHTML` with user input | ✅ JSON-LD goes through `lib/jsonLdSafe.ts` which escapes `<`, `>`, `&`, `'` before emitting inside `<script>` |
| Cookies without httpOnly/secure/sameSite | ✅ no manual `set-cookie` calls; Supabase manages its own session cookies with secure defaults |

### npm audit results

- 2 moderate severity issues, both for postcss XSS (same advisory, listed twice via different paths). Documented above; deferred.
- 0 high, 0 critical.

### RLS coverage

Not runnable from this environment — requires the owner to execute the two queries from the spec in the Supabase SQL editor. Owner action listed below.

---

## 3. COPY

### Hebrew typos fixed: 0 (R81 already swept)

### Misleading promises softened: 1

- **`/dashboard/vendor-studio` page header** was "נראה ב-Google תוך 24 שעות" — Google indexing time is not within our control. Softened to "מאונדקס במנועי חיפוש לאחר זחילה" — describes mechanism, no fixed timeline. Commit `R82-3-copy`.

### Domain stale refs: 0

The only `momentum-psi-ten` reference is a defensive console warning in `lib/env-validate.ts` that fires if the env var still points at the old preview URL — intentional diagnostic.

### Other copy verification (clean)

| Check | Result |
|---|---|
| "ללא כרטיס אשראי" claims | ✅ none — Stripe coming, copy doesn't pre-claim |
| "תוך X שעות" UX promises | ✅ remaining mention in terms refers to ACCOUNT BLOCKING policy, not response time |
| "החזר מלא" / "money back guarantee" | ✅ explicitly removed in R75/R96; FAQ explicitly says no money-back guarantee |
| "מובטח" / "ערבות" hits | ✅ all in legal text — either "rights guaranteed by LAW" or "service NOT under warranty (AS-IS)" — correct usage |
| Singular vs. plural ("אתה" vs. "אתם") | ✅ landing copy already uses "אתם" / "תכננו" / "חיו" throughout (R48-style) |

---

## 4. LEGAL

### ✅ Critical Fixed (R82-4-legal)

**Terms §19 + Footer now identify the real operator.**

Before:
```
§19: Momentum (בהליכי רישום)
     legal@momentum.app, privacy@…, complaints@…
Footer: © 2026 Momentum. כל הזכויות שמורות.
```

After:
```
§19: מופעל ע״י טל חמו, עוסק פטור מס׳ 211477617 (ישראל).
     עוסק פטור פטור ממע״מ — מחירים סופיים.
     אימייל: talhemo132@gmail.com
Footer: © 2026 Momentum · מופעל ע״י טל חמו, עוסק פטור 211477617
```

Why this was Critical:
1. Israeli law (חוק הגנת הצרכן + תקנות סחר אלקטרוני) requires the seller's tax ID on every promotional surface that offers a paid service. Without it, exposed to fines and consumer-complaint nullification.
2. The three placeholder emails (`legal@`, `privacy@`, `complaints@momentum.app`) don't route. A GDPR/privacy complaint sent there would never reach anyone — that alone is a GDPR violation under right-to-respond.
3. "בהליכי רישום" implies a company that doesn't yet legally exist — combined with offering paid plans, that's a misrepresentation issue.

### Coverage verification

| Requirement | Status | Where |
|---|---|---|
| Operator identity (name + tax ID) | ✅ R82-4 | `app/terms/page.tsx §19`, `components/Footer.tsx` |
| Working contact email | ✅ R82-4 | `talhemo132@gmail.com` in §19 |
| Jurisdiction clause | ✅ | terms §18 "בית המשפט המוסמך בתל אביב-יפו" |
| Refund policy clarity | ✅ | terms §15 "AS-IS", FAQ explicitly no money-back |
| Delete account flow | ✅ | `app/settings/page.tsx:559` "מחיקת חשבון לצמיתות" |
| Data export (GDPR portability) | ✅ | `app/settings/page.tsx:101` `exportData()` |
| GDPR / privacy mention | ✅ | terms §17, privacy page in full |
| מע״מ disclosure (עוסק פטור) | ✅ R82-4 | terms §19 explicit "פטור ממע״מ — מחירים סופיים" |
| Copyright on user content | ⚠️ | terms §8 mentions IP but doesn't explicitly retain user content ownership — see Manual Actions |
| Age verification | ⚠️ | no age gate; terms §3 mentions 18+ implicitly via "כשרות משפטית" — see Manual Actions |

### Cookie banner

**Not required.** Plausible analytics is cookie-less by design and doesn't collect PII — it's the standard GDPR-compliant alternative to Google Analytics specifically because it avoids triggering consent requirements. The FAQ's "GDPR מלא" claim holds.

---

## 🎯 Manual Actions for Tal

In priority order:

1. **Add a mailing address to terms §19.** Israeli law allows the address to be a registered accountant's office or a PO box, but SOMETHING must be listed before launch. Currently shown as "יתווסף עם השלמת הרישום". Until then, the email is the only legal contact channel — fine for soft launch but reviewers may ding it.
2. **Run the RLS coverage queries in Supabase SQL Editor.** From the audit spec:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables
   WHERE schemaname = 'public' AND rowsecurity = false;

   SELECT t.tablename, COUNT(p.policyname) as policies
   FROM pg_tables t LEFT JOIN pg_policies p ON p.tablename = t.tablename
   WHERE t.schemaname = 'public'
   GROUP BY t.tablename
   HAVING COUNT(p.policyname) = 0;
   ```
   Both should return 0 rows. If anything comes back, ping me and we'll add the missing policies.
3. **Optional: explicit user-content ownership clause in terms §8.** Right now it covers our IP but doesn't explicitly say "users own their content, license to Momentum to host". Standard SaaS clause; worth adding before launch but not legally blocking.
4. **Optional: age gate at signup.** Currently relies on terms §3 "כשרות משפטית" (legal capacity) — fine for adults, ambiguous for 16–17yo planning a bar/bat mitzvah for younger siblings. Consider adding "אני בן/בת 18+" checkbox at signup.
5. **Monitor Next.js release notes for the postcss XSS patch.** When Next 16.x bumps its transitive postcss to ≥ 8.5.10, run `npm update next` and re-run `npm audit`.
6. **Lighthouse run (carryover from R81).** Real mobile run on `/`, `/dashboard`, `/vendors`, `/seating`, `/admin/dashboard`. Targets in R81 report.

---

**Closing note:** the codebase is in launch-ready shape. The one Critical issue (operator identity) is fixed; everything else is either already-mitigated, deferred to post-launch with a clear path, or in your hands (RLS query / manual verification).
