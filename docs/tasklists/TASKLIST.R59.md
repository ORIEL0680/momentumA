# TASKLIST · R59 — Admin Dashboard למייסד (מותאם לארכיטקטורה הקיימת)

> ממש את ה-spec "R49". (R49 תפוס בהיסטוריה → R59 ברצף.)
> **המשתמש אישר במפורש: "להתאים לארכיטקטורה הקיימת".**

**Date:** 2026-05-19 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 75/75 · 1 migration ידני · no new deps.

## הרקע — למה התאמה ולא יישום מילולי

ה-spec הניח סכמה רלציונית (`user_profiles`, `vendor_profiles`,
`events`, `error_logs`, `admin_users` + RPC `is_admin`) ו-server
Supabase client. בפועל: כל הדאטה של אירוע/אורחים הוא **JSON blob יחיד
למשתמש** ב-`app_states`; משתמשים מגיעים מ-**Supabase Auth admin API**;
gating קיים דרך **`admin_emails`** (כבר seeded עם
`talhemo132@gmail.com`); הסשן ב-localStorage (לא cookies) → אין auth
ב-SSR/middleware; וכבר קיים dashboard עובד + `/api/admin/stats`
(service-role). יישום מילולי = 12 קבצים שבורים. לכן הכול הותאם.

## Done

**תשתית error logging (חדש אמיתי):**
- `supabase/migrations/2026-05-19-error-logs.sql` — טבלת `error_logs`
  + אינדקסים + RLS (admin reads דרך `admin_emails`; אין insert policy
  — כתיבה רק דרך service-role).
- `lib/error-tracker.ts` — `logError()` best-effort, POST ל-route
  (לא service-role בקליינט). לעולם לא זורק. איזומורפי (baseUrl לשרת).
- `app/api/admin/log-error/route.ts` — service-role insert, ולידציה +
  caps, ללא טוקנים. ללא service-role → 204 שקט.

**גישה מאובטחת (admin_emails, לא is_admin RPC):**
- `lib/admin/server.ts` — `requireAdmin(req)`: anon-client+JWT מוכיח
  זהות + קורא `admin_emails` תחת RLS → אז service-role client.
  **זה הגבול האבטחתי האמיתי.**
- `components/admin/AdminGuard.tsx` — client guard (UX): non-admin →
  `/dashboard` שקט, ללא רמז שקיים אזור admin; מספק access-token
  ל-context. (middleware/SSR אי-אפשר — סשן ב-localStorage; מתועד.)

**נתונים:**
- `/api/admin/stats` — **הורחב additively** (legacy dashboard ממשיך
  לעבוד): sparklines 7d (users/events), deltas 7d-vs-prev-7d,
  upcoming events מפענוח JSON של `app_states`, errors_last_24h
  (graceful אם הטבלה חסרה).
- `/api/admin/users` — רשימה/פרופיל יחיד מ-Auth admin API + join
  ל-`app_states` (כותרת אירוע/מס׳ אורחים). אין `user_profiles`.
- `/api/admin/errors` — 100 אחרונות, סינון type, frequency,
  `table_missing` ידידותי.
- `lib/admin/queries.ts` — עזרי pure (dayBuckets/pctDelta/
  parseUpcomingEvents), `lib/admin/realtime.ts` — channel על טבלאות
  אמיתיות, `lib/admin/types.ts` — shape משותף.

**UI (סגנון Stripe, שפת הזהב הקיימת):**
- `components/admin/StatCard.tsx` (card-gold, מספר זהב, delta, sparkline,
  placeholder), `MiniChart.tsx` (SVG), `ActivityFeed.tsx` (realtime,
  seed מ-recent_activity).
- `app/admin/page.tsx` — מסך ראשי: SystemHealth, 4 KPIs,
  פעולות דחופות, אירועים קרובים, גרף שימוש, פיד חי.
- sub-pages: `users`, `users/[id]`, `vendors/applications`
  (אישור/דחייה דרך `/api/vendors/admin/decide` הקיים), `events`,
  `errors`.
- `logError` חובר ל-`app/auth/callback` (client) ו-`auth/confirm`
  (server) — exchange/getSession/verifyOtp failures.

## סטיות מתועדות (מאושר ע"י המשתמש — "התאם לקיים")

1. **admin_emails במקום is_admin/admin_users.** כבר קיים+seeded. אין
   UUID להכניס — המודל email-based, ו-`talhemo132@gmail.com` כבר שם.
2. **אין middleware /admin/\* gate.** הסשן ב-localStorage → אין
   cookie ל-SSR/middleware. לא נגעתי ב-middleware (CSP). האכיפה
   האמיתית = `requireAdmin` בכל route + AdminGuard ל-UX.
3. **stats הורחב, לא נכתב מחדש.** שמירה על תאימות ל-`/admin/dashboard`.
4. **events מ-`app_states` JSON**, users מ-Auth API — אין טבלאות
   `events`/`user_profiles`. revenue = placeholder (Stripe Q3).
5. usage chart = 7d (יש לנו 7d series), לא 30d — מסומן ביושר.

## נדרש ידנית (owner)

1. **Migration להריץ ב-Supabase SQL Editor:**
   `supabase/migrations/2026-05-19-error-logs.sql` (היחיד החדש; כל
   השאר משתמש בטבלאות קיימות). עד שירוץ — דף השגיאות מציג הודעה
   ידידותית ו-`errors_last_24h=0` (אין 500).
2. **Admin UUID:** ה-spec ביקש UUID — **לא רלוונטי**. הגישה
   email-based דרך `admin_emails`, וכבר מאוכלס ב-`talhemo132@gmail.com`
   (מ-migration 2026-05-10-vendor-applications). להוסיף אדמין נוסף:
   `insert into admin_emails(email) values('<email>');`.
3. `SUPABASE_SERVICE_ROLE_KEY` כבר נדרש ל-`/api/admin/stats` הקיים —
   ודא שמוגדר ב-Vercel env (אחרת 503 עם הודעה ברורה).
4. בדיקת קבלה (לא ניתן headless): כניסה כ-admin → `/admin`,
   non-admin → `/dashboard` שקט, realtime feed, אישור ספק, יצירת
   שגיאה ב-/signup שמופיעה ב-/admin/errors, Lighthouse.

## Verification

- ✓ `tsc --noEmit` נקי · ✓ `lint` 0 errors (6 warnings קודמות, לא
  בקבצי admin) · ✓ `build` Compiled successfully (כל /admin/* +
  /api/admin/* נבנו) · ✓ `vitest` 75/75.
- ✓ TypeScript strict, 0 `any`, 0 `@ts-ignore`. כל שאילתה ב-try/catch.
  אפס console.log חדש מעבר ל-error-logging מכוון. אפס תלות חדשה.
