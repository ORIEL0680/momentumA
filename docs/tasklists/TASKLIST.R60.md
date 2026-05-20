# TASKLIST · R60 — חוויית המשתמש החדש (השעה הראשונה)

> ממש את ה-spec "R51". (R51 כבר תפוס בהיסטוריה → R60 ברצף, באותה
> מוסכמה כמו R54/R56/R57/R58/R59.)

**Date:** 2026-05-20 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 75/75 · 1 migration ידני · אין תלות חדשה.

## Done

### חלק 1 — 7 תבניות מייל מותגות (paste-ready)

`emails/` (לא חלק מה-build; reference להעלאה ידנית):
- `01-confirm-signup.html` · `02-magic-link.html` · `03-reset-password.html`
- `04-change-email.html` · `05-email-otp.html` · `06-reauthentication.html`
- `welcome.html` (לקרון של חלק 2)
- `README.md` — בדיוק איזה Subject ואיזה body להדביק לאיזה slot
  ב-Supabase Dashboard → Authentication → Email Templates,
  ואיזה template variables (`{{ .ConfirmationURL }}`, `{{ .Token }}`).

כל קובץ: HTML עצמאי, dir="rtl", inline styles בלבד (Gmail Mobile
מסיר `<style>` מרכזי). שפת המותג: רקע `#0A0A0F`, כרטיס gradient
מוקף בזהב `#D4B068`, כותרת ב-`#F5E9D0`, CTA זהב-על-כהה. כפתור
fallback כקישור גלוי מתחת לכפתור (clients שחוסמים <a> מעוצב).

### חלק 2 — אימייל ברוכים הבאים אחרי שעה (אינפרה)

- **`supabase/migrations/2026-05-20-scheduled-emails.sql`** — טבלת
  `scheduled_emails` (id/user_id/email_type/send_at/sent_at/attempts/
  last_error) + RLS deny-all (כתיבה רק service-role) + טריגר
  `on_auth_user_created_welcome` שדוחף שורת welcome עם
  `send_at = NOW() + 1h`. הטריגר על `auth.users` ולא על
  `user_profiles` (לא קיים כאן). UNIQUE על (user_id, 'welcome')
  למניעת כפילויות.
- **`app/api/send-scheduled/route.ts`** — Vercel Cron handler.
  אימות `CRON_SECRET` אם מוגדר, service-role select לשורות-מוכנות,
  שליפת email מ-Auth admin API + שם פרטי best-effort מ-`app_states`
  payload, שליחה דרך Resend (אותו pattern של `lib/vendorNotifications`).
  Graceful degradation: בלי `RESEND_API_KEY` שורה מסומנת `sent` עם
  `last_error='resend-not-configured'` כדי לא להיכנס ל-busy-loop.
- **`vercel.json` crons:** `*/15 * * * *` ל-`/api/send-scheduled`.
  **שים לב:** Vercel Hobby מאפשר רק daily crons. צריך Pro להריץ */15.
- **HTML של ה-welcome מוטמע inline בroute** (אותו נוסח כמו
  `emails/welcome.html` — כפילות מודעת, ראה הערה בקוד).

### חלק 3 — Welcome Tour ראשון

- **`lib/useFirstLogin.ts`** — `useSyncExternalStore` על
  `localStorage["momentum.tour.completed.v1"]` (per-device, ללא
  שינוי סכמה). server snapshot מחזיר `completed=true` כך שה-tour
  לעולם לא מרונדר ב-SSR (אין hydration mismatch). `markCompleted`
  גם מפיץ אירוע ב-tab באמצעות listener Set פנימי.
- **`components/onboarding/WelcomeTour.tsx`** — 5-step modal
  (welcome → ניצוץ הזהב → אורחים → תקציב → ספקים). מקלדת:
  Esc=דלג, Enter/→=הבא, ←=חזרה. אין backdrop-click (מונע
  dismissal בטעות). סיום מפעיל `fireConfetti(1800)` + toast
  הצלחה. דלג נחשב הושלם — לא יחזור.
- **`app/dashboard/page.tsx`** — `<WelcomeTour />` אחרי `<Header />`.
  משתלב עם `WelcomeBanner` הקיים (URL ?welcome=true — מצב אחר,
  שניהם יכולים לחיות יחד).

### חלק 4 — Empty state ב-/balance

- **`app/balance/page.tsx`** — החליף `<div>` plain-text של
  "עוד לא אישרו הגעה..." ב-`<EmptyState>` נכון (אייקון Scale,
  כותרת "המאזן יבנה כשהאירוע יתחיל", CTA "חזרה לדשבורד",
  `emphasis` ל-card-gold). העתק מהspec, מותאם לקיים.
- **לא נגעתי ב-/guests** (יש לו empty-state עשיר עם import-from-
  contacts מ-R18, החלפה ל-EmptyState גנרי הייתה רגרסיה),
  **/budget** (כבר משתמש ב-EmptyState — הקופי המקורי action-oriented
  טוב יותר מהspec במצב הזה), **/vendors** (יש SmartEmptyState
  מותאם search-no-results, scope שונה).

## סטיות מתועדות מה-spec (החלטות בעקבות ההפרש לארכיטקטורה)

| ספק הניח | בפועל | התאמה |
|---|---|---|
| `user_profiles.onboarding_completed` | אין טבלה כזו; users מ-Auth API, state ב-`app_states` JSON | localStorage per-device (פשוט, ללא roundtrip, ללא שינוי סכמה) |
| Trigger על `user_profiles` | לא קיימת | Trigger על `auth.users` (אותה כוונה) |
| `useUserProfile()` hook | לא קיים | `useFirstLogin()` עם useSyncExternalStore |
| Coachmarks pixel-anchored | רגיש לresponsive, סיכון לפני השקה | 5-step modal sequence (זהה ביעד — להציג 4 סקציות ב-60ש׳, יציב בכל רוחב, RTL/מקלדת-נכון) |
| Vercel cron */15 | Vercel Hobby מאפשר רק daily | משאיר */15 (טוב יותר ל-UX); המשתמש שדרג ל-Pro או יחליף ל-daily |
| `emails/auth-templates.html` בקובץ אחד | 7 קבצים פר-template עדיף | קל יותר לcopy-paste לכל slot ב-Supabase Dashboard |

## נדרש ידנית — לפעולה שלך

1. **הריצו את ה-migration ב-Supabase SQL Editor:**
   `supabase/migrations/2026-05-20-scheduled-emails.sql` — יוצר את
   `scheduled_emails` + טריגר על `auth.users`. **בלעדיו אין שורות
   welcome להזמן.**
2. **הדביקו את 6 התבניות לתחת Authentication → Email Templates**
   ב-Supabase Dashboard. השמות + Subjects ב-`emails/README.md`.
3. **`RESEND_API_KEY` ב-Vercel env** (חינם, 3000 emails/חודש).
   בלעדיו ה-cron רץ בלי לשלוח (מסמן שורות `sent` עם
   `resend-not-configured`).
4. **`CRON_SECRET` ב-Vercel env** (אופציונלי אבל מומלץ): מחרוזת
   רנדומלית. Vercel Cron יזריק `Authorization: Bearer <secret>`
   והroute יוודא.
5. **Vercel cron interval** — `*/15` ב-`vercel.json` דורש Pro.
   ב-Hobby החליפו ל-`0 9 * * *` (שליחה יומית 09:00 UTC) או שדרגו
   לPro. אחרת ה-deploy ידחה את ה-crons block.
6. **Resend "from" address** — היום משתמש ב-`onboarding@resend.dev`
   (sandbox של Resend; מגיע ל-Gmail אבל יכול ליפול לספאם). לאחר
   אימות הדומיין `moomentum.events` ב-Resend, החליפו ל-
   `welcome@moomentum.events` בקבוע `RESEND_FROM` ב-
   `app/api/send-scheduled/route.ts`.

## Verification

- ✓ `npx tsc --noEmit` נקי · ✓ `npm run lint` 0 errors (6 warnings
  קודמות, לא בקבצי R60) · ✓ `npm run build` Compiled successfully
  (כל ה-routes החדשים נבנו) · ✓ `npx vitest run` 75/75.
- ✓ TypeScript strict, אפס `any`, אפס `@ts-ignore`. שום dep חדש.
- ⏳ **קבלה (owner):** משתמש חדש שנרשם → קופץ Welcome Tour, refresh
  אחרי השלמה → לא קופץ שוב, וכעבור שעה → מייל welcome (לאחר השלמת
  הצעדים הידניים לעיל).
