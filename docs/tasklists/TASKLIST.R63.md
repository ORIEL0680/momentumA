# TASKLIST · R63 — Analytics + Error Tracking + Uptime Monitoring (R53)

> ממש את ה-spec "R53". (R53 כבר תפוס בהיסטוריה → R63 ברצף.)

**Date:** 2026-05-20 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 75/75 · ללא dep חדש · ללא migration.

## הכרעה אדריכלית: לא Sentry (לפחות לא עכשיו)

ה-spec ביקש `npm install @sentry/nextjs` + הרצת ה-wizard האינטראקטיבי
(`npx @sentry/wizard@latest -i nextjs`). 3 שיקולים שגרמו לי לא להתקין:

1. **Bundle weight** — `@sentry/nextjs` מוסיף ~70KB לקליינט. אחרי
   רבים סבבים של דחיסת bundle (R58, R53 שאסר אנליטיקס יקר) זה גורם
   ל-regression מדידה ב-LCP.
2. **Wizard אינטראקטיבי** — לא יכולתי להריץ אותו אצלי (אין TTY).
   ביצוע הid wizard ידנית מעמיד אותי בסיכון להחמיץ פרט (sourcemaps,
   `withSentryConfig`, `tsconfig.paths`) ולשבור את ה-build יום-יומיים
   לפני השקה.
3. **ה-R59 כבר נותן את אותו ערך מעשי** — `error_logs` + `logError`
   + `/admin/errors`. רק חסר: capture של window errors. הוספתי
   והעבדתי מקיפה עליו (ראה חלק 2).

**אם תרצה Sentry post-launch:** install + הוסף את ה-DSN ל-env →
3 הקבצי boundary שלי (app/error.tsx, app/global-error.tsx,
components/error-tracking/ErrorListener.tsx) הם נקודת ה-wire-up
הברורה. שינוי 5-10 שורות.

## Done

### חלק 1 — Plausible (נטמע מלא)

- `lib/analytics.ts` — נוספו `track()` ו-`trackFirstOnce()` ליד
  `trackEvent` הקיים (שמרתי את הקיים → 4 callers ב-/live, /rsvp,
  /guests, ShareEventCard ממשיכים לעבוד). `trackFirstOnce` משתמש
  בlocalStorage key per-device.
- `app/layout.tsx` — `plausibleBootScript` (nonce'd, inline IIFE).
  סקריפט: setting up `window.plausible` queue + הזרקה דינמית של
  `https://plausible.io/js/script.tagged-events.js`. תחת
  `'strict-dynamic'` CSP, סקריפט nonce'd יכול להזריק עוד scripts.
- `middleware.ts` — נוסף `https://plausible.io` ל-`connect-src`
  כדי שpageviews יישלחו.
- **תחת איזה דומיין:** `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` עם default
  `moomentum.events`. Plausible no-ops על דומיינים לא רשומים → אין
  זיהום של stats מ-localhost/tunnels.

### חלק 2 — Error tracking (extending R59, לא Sentry)

- `app/error.tsx` (Next route-level boundary) — נוסף `void logError({...})` ב-useEffect, מעביר message + stack לאותו endpoint של R59. מתועד בקומפ' שזה ה-wire-up point ל-Sentry בעתיד.
- `app/global-error.tsx` (top-level boundary, חיצוני לlayout) — fetch inline ל-`/api/admin/log-error` ב-useEffect. **בכוונה לא מייבא מ-`lib/`** — הקובץ הזה תופס שגיאות שמתפוצצות מעל ה-layout עצמו (שגיאת טעינת font, וכו'), ואם הוא ירמוס על import — הגענו למסך לבן.
- `components/error-tracking/ErrorListener.tsx` (חדש, client) — נרשם ל-`window.error` ו-`unhandledrejection`. שולח כל אחד ל-`logError`. Rate-limited ל-10 אירועים per session (מניעת ספאם בלולאה רעה). לא לתפוס במעבר navigation שגרתי. **דבר חדש לעומת R59**: שגיאות runtime לא-React מגיעות עכשיו ל-error_logs.
- `app/layout.tsx` — מרונדר `<ErrorListener/>` בתוך `<body>`.

### חלק 3 — UptimeRobot endpoint (`app/api/health/route.ts`)

- Public (אין auth — UptimeRobot לא נושא JWT). מבדק `app_states`
  דרך REST anon (HEAD + count=0; 2xx = הסכמה מגיבה). מחזיר 200
  בריא / 503 פגום + JSON עם `checks: { supabase: bool }`.
- **סטייה מ-spec:** השתמשנו ב-`@/lib/supabase/server` ב-spec — לא
  קיים אצלנו (אין cookie-SSR; הסבר ב-R47/R49/R59/R62). השאלת
  `user_profiles` גם לא קיימת. הסיכוי הקצר ש-`app_states` עובד
  זהה בערך לבריאות של המערכת.

### חלק 4 — Web Vitals (`app/vitals.tsx`)

- `useReportWebVitals` → `track("web_vital", { metric, value, rating })`.
- `rating === "poor"` → גם `logError({ type: "api", ... })` כך שתראה
  metrics רעים ב-/admin/errors (במקום ב-Sentry שאין). מתועד.
- `app/layout.tsx` — `<VitalsReporter/>` מתחת ל-ErrorListener.

### חלק 5 — Tracking funnel events (7 מקומות)

נחבר כדלהלן:
- `app/signup/SignupClient.tsx` — `track("signup_started", { method })` ב-`handleProvider` / `sendOtp` / `submitEmail` (3 calls עם method = google/apple/phone/email).
- `app/auth/callback/page.tsx` — `track("signup_completed", { method })` אחרי `syncOnLogin` המוצלח, method מ-`session.user.app_metadata.provider`.
- `app/onboarding/page.tsx` — `track("first_event_created", { event_type })` בתוך `if (!existing)` (לצד `fireConfettiOnce`).
- `app/guests/page.tsx` — useEffect שזוכר prev length ומפעיל `trackFirstOnce("guest", "first_guest_added")` ב-0→≥1.
- `app/balance/page.tsx` — אותו pattern על `totals.filledCount`.
- `app/budget/page.tsx` — אותו pattern על `state.budget.length`.
- `app/vendors/join/page.tsx` — `track("vendor_application_submitted", { category })` אחרי submit מוצלח.

הפילטר 0→1 (לא רק `length >= 1`) חשוב: משתמש חוזר שמסנכרן מענן עם
נתונים קיימים — לא יפעיל אירוע funnel-first מטעה. ה-localStorage gate
של `trackFirstOnce` מבטיח שבכל מקרה האירוע נשלח לכל היותר פעם אחת
per-device.

### חלק 6 — Monitoring card ב-/admin

ב-`app/admin/page.tsx` נוסף `<MonitoringCard/>` (אחרי UsageChart
בעמודה השמאלית). 3 קישורים, grid-cols-3, באייקונים אמוג'י:
- 📊 Analytics → https://plausible.io/moomentum.events (external)
- 🐛 Errors → `/admin/errors` (internal — R59)
- 🟢 Uptime → https://uptimerobot.com/dashboard (external)

ה-spec דרש קישור ל-Sentry; הוחלף בקישור פנימי ל-/admin/errors שהוא
הנקודה המקבילה כאן.

## נדרש ידנית (owner)

1. **Plausible:** `plausible.io` → register → add site `moomentum.events`. Goals להגדיר: `signup_completed`, `first_event_created`, `first_guest_added`, `vendor_application_submitted` (Dashboard → site → Goals → Add custom event goal).
2. **UptimeRobot:** register → monitors HTTPS:
   - `https://moomentum.events` (5min interval)
   - `https://moomentum.events/api/health` (5min)
   - `https://moomentum.events/signup` (5min)
   - Alert: email `talhemo132@gmail.com`.
3. **Vercel env (אופציונלי):**
   `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=moomentum.events` (כברירת מחדל;
   אפשר להחליף ל-staging דומיין למצב test).
4. **Sentry:** **לא הותקן.** אם תרצה בעתיד — `npm install
   @sentry/nextjs` + הרץ wizard + הוסף DSN. 3 ה-boundaries המוכנים
   ייכנסו בלי שינוי לוגי.

## Verification

- ✓ `tsc --noEmit` נקי · ✓ `lint` 0 errors (6 warnings קודמות) · ✓
  `build` Compiled successfully (`/api/health`, `/api/admin/log-error`,
  כל ה-routes שנגעו בהם נבנים) · ✓ `vitest` 75/75.
- ✓ TypeScript strict · 0 `any` · 0 `@ts-ignore`. ללא dep חדש. ללא
  שינוי DB.
- ✓ אין shift visual בשום עמוד: Plausible inline script, ErrorListener
  מחזיר null, VitalsReporter מחזיר null, MonitoringCard בעמוד admin
  בלבד.
- ⏳ **קבלה (owner):** DevTools→Network → סינון "plausible" אחרי טעינת
  `/` — צריך לראות `/api/event` POST. `/api/health` → JSON `status:"ok"`.
  צריך לאמת ידנית בכלים החיצוניים (Plausible/UptimeRobot dashboards)
  אחרי הרישום.
