# TASKLIST · R68 — Calendar upgrade layer (R57, MVP scope)

> ממש את ה-spec "R57" ב-**5 חלקים נקיים**, אחרי שאישרת scope. (R57
> תפוס בהיסטוריה → R68 ברצף.)

**Date:** 2026-05-20 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 75/75 · 1 migration ידני · אין dep חדש.

## Scope decision (locked עם המשתמש)

ה-spec הציעה 8 חלקים. אחרי שהצגתי את ה-blockers המשתמש בחר MVP נקי
(5 חלקים, אפס deps חדשים). מודחים:

- **Part 3 DnD reschedule** — דורש `@dnd-kit/core` + `@dnd-kit/sortable`. במדיניות "אפס deps חדשים" מ-R63-R67.
- **Part 4 multiple views** (week/day/agenda) — שלוש view-components נוספות, סקופ של 1.5-2 ימים. מובן שכל אחד בנפרד אבל לא יחד 4 ימים לפני השקה.
- **Part 5 AI brief cron** — דורש Vercel Pro (`0 * * * *` סאב-יומי) + Web Push infrastructure (SW + VAPID + push send) שאף פעם לא נבנתה (R60-R67 דחו push). שני בלוקרים שלא רלוונטיים לפני launch.
- **Part 6 geo-fence** — דרש `location_lat`/`location_lng` ב-appointments שלא הוספתי ב-R67. בלעדי Google Places אין UI להזין אותם, אז ה-feature הייתה נוחתת non-functional. הוסר.

## Done

### חלק 0 — Migration

`supabase/migrations/2026-05-20-calendar-pro.sql`:
- `ALTER TABLE appointments ADD COLUMN checklist jsonb NOT NULL DEFAULT '[]'`
- `CREATE TABLE calendar_sync_tokens` (user_id PK, token UNIQUE, enabled, timestamps) + RLS users-manage-own.

**הוסר מהspec:** `meeting_briefs` ו-`calendar_shares` — משרתים רק את Parts 5 + family-share שמודחים. הוספת טבלאות לא בשימוש זה רעש סכמה; migration עתידי יוסיף אותן כשהפיצ׳רים יישלחו.

### חלק 1 — Smart vendor checklists

- `lib/calendar/checklist-templates.ts` — 8 קטגוריות (venue / catering / photo / dj / flowers / dress / hair / other) עם questions + bring. `personal` ו-`milestone` נופלים ל-`other`. `buildChecklist(category)`, `checklistProgress()`, `newChecklistItemId()`.
- `lib/calendar/appointments.ts` — נוסף `checklist: ChecklistItem[]` ל-`Appointment`. `createAppointment` מזריע את ברירת המחדל ל-fresh rows. נוסף `updateChecklist(id, items)`.
- `components/calendar/AppointmentSheet.tsx` (edit mode בלבד) — section עם 2 קבוצות (📝 שאלות / 📦 להביא), checkbox + label + מחיקה per row, "+ הוסף שורה" עם input + Enter. progress chip "{N}/{total}" + "שומר…" indicator. **auto-save debounced 500ms** דרך `useEffect` + `setTimeout` (לא setState-in-effect — ה-setState ב-.then() async).

### חלק 2 — iCal feed (Google / Apple sync)

- `lib/supabase/service.ts` (חדש) — `createServiceClient()` עם `server-only` guard.
- `app/api/calendar/ics/[token]/route.ts` — public RFC-5545 feed. Token-based auth (token IS the auth), 30-day window עתיד+עבר, line-folding 75-octet, escape RFC §3.3.11, UTC timestamps, `Cache-Control: private, max-age=900`. `last_accessed_at` עדכון best-effort. 404 על token invalid/disabled (לא 401 — לא חושף שטוקן "היה קיים").
- `app/api/calendar/sync-token/route.ts` — JWT-auth'd. **GET** מחזיר/יוצר token עבור המשתמש. **DELETE** מסובב (upsert עם token חדש; מבטל את הקודם מיידית).
- `components/calendar/CalendarSyncSection.tsx` — UI ב-/settings: URL מלא עם token, כפתור העתקה (clipboard) + "ייצור לינק חדש" עם confirmation.
- `app/settings/page.tsx` — `<Section icon={Calendar} title="סנכרון לוח שנה">` חדש.

### חלק 7 — Smart day balance (inline hint)

- `AppointmentSheet` מקבל `appointmentsOnDay?(iso) => number` prop. CalendarClient מספק callback שסופר OTHER appointments ביום שנבחר (לא כולל את הnרצה שעורכים).
- כשהספירה ≥ 3 → inline hint כתום "💡 כבר יש N פגישות באותו יום. שיקלו לפזר על 2 ימים."
- **סטייה מ-spec:** ה-spec ביקש Confirm modal עם 2 options ופונקציית `suggestDistribution`. בחרתי inline hint — תועלת זהה (awareness), פחות חיכוך, פחות UI.

### חלק 8 — Print-friendly view

- `app/calendar/print/page.tsx` — page חדש (RTL). טבלה של פגישות עתידיות (תאריך לועזי+עברי, שעה, כותרת, מיקום), header עם wedding title + countdown, כפתור "הדפס עכשיו" שקורא `window.print()`. CSS `@media print` מסתיר chrome (back link, button), הופך רקע ללבן, A4 portrait עם margins 18mm/14mm.
- `components/calendar/CalendarMonth.tsx` — נוסף כפתור 🖨 (Printer icon) ב-header של הלוח, קישור ל-`/calendar/print`.

## ידני (owner)

1. **הריצו ב-Supabase SQL Editor:** `supabase/migrations/2026-05-20-calendar-pro.sql`. עד שתריצו — צ׳קליסט וסנכרון יחזירו שגיאה ב-console.
2. **בדיקות מומלצות אחרי deploy + migration:**
   - הוסיפו פגישת "טעימה באולם" → סגרו → פתחו שוב לעריכה → צ׳קליסט עם 7 שאלות + 3 פריטים. סמנו 2 → רענון → נשמרים.
   - /settings → "סנכרון לוח שנה" → העתיקו URL → הדביקו ב-Google Calendar (Settings → Add calendar → From URL) → הפגישות מסתנכרנות (תוך עד שעה ב-Google).
   - הוסיפו 3 פגישות לאותו יום → על השלישית → רואים את ההודעה הכתומה.
   - /calendar/print → רואים טבלה → הדפס.

## Verification

- ✓ `tsc --noEmit` נקי · ✓ `lint` 0 errors (6 warnings קודמות) · ✓ `build` Compiled successfully (`/calendar/print`, `/api/calendar/ics/[token]`, `/api/calendar/sync-token`) · ✓ `vitest` 75/75.
- ✓ TypeScript strict · 0 `any` · 0 `@ts-ignore`. **אפס dep חדש.** הdeploy יקרה דרך `vercel --prod` בסוף (לקח מ-R66).

## Deferred (post-launch)

DnD, multiple views, AI brief cron + push notifications, geo-fence, family-share. כל אחד מתועד למה לא נכנס; אפשר להחזיר אותם בסבב נפרד כשיש זמן לבדיקה ראויה + תקציב dev-dep + Vercel Pro.
