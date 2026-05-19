# TASKLIST · R57 — תיקון אוטנטיקציה אחרי מעבר ל-moomentum.events

> ממש את ה-spec "R47 — תיקון אוטנטיקציה". (R47 כבר תפוס בהיסטוריה →
> הסבב ממוספר R57 ברצף.) המשתמש כבר עדכן ידנית Supabase / Google
> OAuth / Vercel env — כאן רק תיקוני קוד.

**Date:** 2026-05-19 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 75/75 · no new deps / no migration.

## Root cause (השורש לבעיה "לא מצליח להיכנס מהדומיין החדש")

`lib/user.ts` בנה את ה-OAuth `redirectTo` (וגם `emailRedirectTo`)
דרך `tryGetPublicOrigin()` → `lib/origin.ts`, ש**מחזיר
`NEXT_PUBLIC_SITE_URL` קודם כל**. עוגיית ה-session היא host-scoped:
משתמש שנכנס *ב-*moomentum.events הופנה חזרה דרך origin אחר → ה-callback
נחת על host שונה מה-cookie → ה-session "נעלם" וההתחברות נכשלה בשקט.
זה בדיוק ה-❌ pattern שה-spec הזהיר ממנו.

## Done (קוד — דטרמיניסטי, מאומת)

1. **שלב 1 — SCAN:** grep ל-`momentum-psi-ten` / `vercel.app` ב-
   `app/ lib/ components/ public/` → **0 hardcoded refs** (R56 כבר
   ניקה; היחיד שנשאר הוא כלל ה-redirect ב-`vercel.json` + תיעודו,
   בכוונה).
2. **שלב 2 — `lib/user.ts` (התיקון המרכזי):** הוסר
   `import tryGetPublicOrigin`; נוסף helper `authCallbackUrl()`
   שמחזיר ``${window.location.origin}/auth/callback`` (המודול
   `"use client"` → window תמיד זמין; guard ל-SSR מחזיר undefined →
   Supabase נופל ל-Site URL). שני המופעים תוקנו: `signInWithOAuth`
   `redirectTo` ו-`signUpWithEmail` `emailRedirectTo`. **לא נגעתי
   ב-`lib/origin.ts`** — הוא env-first בכוונה (קישורי WhatsApp/RSVP
   צריכים origin אבסולוטי יציב גם ב-SSR); רק ה-redirect
   האינטראקטיבי חייב לעקוב אחרי ה-origin החי.
3. **שלב 3 — cookie domain:** grep ל-`cookieOptions`/`cookieDomain`/
   `domain:` → **0** — אין domain מקובע. ללא שינוי.
4. **שלב 4 — לוגינג מובנה:**
   - `app/auth/confirm/route.ts` (server route → Vercel Functions
     Logs): `console.log("[auth/confirm]", {...})` בתחילת ה-GET
     (host/forwarded_host/origin/token_present/type/error) +
     `console.error("[auth/confirm] verifyOtp failed", {...})` בכשל.
     **טוקנים לא נרשמים — רק נוכחות.**
   - `app/auth/callback/page.tsx` (client): `console.log` מובנה
     בתחילת ה-finish (host/origin/code_present/...) לצילום-מסך של
     המשתמש. (לדף הזה כבר היו console.error + UI שגיאה ידידותי.)
5. **שלב 5 — `app/signup/page.tsx`:** seed ל-state `error` מתוך
   `?error=` ב-lazy useState init (לא setState-in-effect) → ה-banner
   האדום הקיים מציג שגיאת-התחברות שהוחזרה במקום מסך ריק.
6. **שלב 6 — `middleware.ts`:** נבדק — CSP-only, ללא host/hostname
   enforcement שחוסם את הדומיין החדש. ללא שינוי (מאומת).
7. **שלב 7 — `lib/env-validate.ts` (חדש):** `validateEnv()` —
   מזהיר אם `NEXT_PUBLIC_SITE_URL` חסר / מצביע על `momentum-psi-ten`
   / לא https. נקרא פעם אחת ב-`app/layout.tsx` (server, module scope)
   כש-`NODE_ENV==="production"`. לעולם לא זורק.
8. **שלב 8 — `vercel.json`:** ה-redirects 301
   (`www`/`momentum-psi-ten.vercel.app` → apex) כבר נוספו ב-R56.
   אומת קיים — ללא שינוי.

## סטיות מה-spec (מתועד — מבנה הקבצים בפועל שונה)

- ה-spec הניח `app/auth/callback/route.ts` עם
  `exchangeCodeForSession` ו-redirect ל-`/signup`. בפועל:
  `/auth/callback` הוא **client page** שכבר עושה
  exchange/verifyOtp + יש לו UI שגיאה ידידותי משלו + כפתור חזרה;
  וה-route ה-server-side הוא `app/auth/confirm/route.ts`
  (verifyOtp). יישמתי את **כוונת** ה-spec על המבנה האמיתי: לוגינג
  מובנה בשני המקומות, ושמרתי redirect ל-`/auth/callback?error=`
  (mapping שגיאות עשיר) במקום `/signup` — שינוי ל-`/signup` היה
  רגרסיה. דף signup עדיין מציג `?error=` (שלב 5) למקרה שמשהו כן
  ינחת שם.

## Verification

- ✓ `npx tsc --noEmit` נקי · ✓ `npm run lint` 0 errors (6 warnings
  קודמות ב-`app/terms/page.tsx`, לא קשורות) · ✓ `npm run build`
  Compiled successfully (/auth/callback · /auth/confirm · /signup) ·
  ✓ `npx vitest run` 75/75. TypeScript strict · 0 any · 0 @ts-ignore.
- ✓ אפס תלויות חדשות · אפס מיגרציה.
- ⏳ **מבחן קבלה owner-side** (דורש דומיין חי + OAuth provider):
  כניסה מ-moomentum.events (Google + Phone OTP), בדיקת
  `[auth/callback]`/`[auth/confirm]` ב-Vercel Logs,
  vercel.app→301, ומסך שגיאה ידידותי. אי-אפשר headless.
