# TASKLIST · R65 — Calendar MVP: heatmap + AI date-shift (R55)

> ממש את ה-spec "R55" ב-**scope MVP** (אישור מהמשתמש לפני התחלה).
> (R55 כבר תפוס בהיסטוריה → R65 ברצף.)

**Date:** 2026-05-20 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 75/75 · 1 dep חדש (`@hebcal/core`) · ללא migration · ללא שינוי DB.

## למה MVP ולא הspec המלא

ה-spec ביקש 15+ קבצים: appointments-CRUD ב-DB, push notifications, service worker, VAPID, Vercel-Pro cron, vendor integration, day-view. כשהזהרתי על blockers (תלוי בטבלאות שלא קיימות, דורש Vercel Pro, צריך SW חדש, 5 ימים לפני השקה) — המשתמש בחר במפורש **"MVP — heatmap + AI date-shift"**.

**מה ב-MVP:**
- `/calendar` עם תצוגת חודש + heatmap מחירים
- Hebrew calendar (חגים + שבת + תאריך עברי)
- AI suggestion banner שקורא את `state.event.date` מ-app_states
- כפתור בHEADER_NAV

**מה לא ב-MVP (deferred, 0 קבצים נכתבו):**
- Appointments table + AppointmentSheet + CRUD ל-DB
- Push notifications + service worker + VAPID + Vercel-Pro cron
- vendor "תזמן פגישה" integration
- Day-view (אגנדה ליום)
- NotificationPrompt
- DB migration

## Done

### חלק 1 — Hebrew calendar wrapper

`lib/calendar/hebrew-calendar.ts`:
- `isShabbat(date)` — שבת = יום שישי 18:00 עד שבת.
- `isJewishHoliday(date)` — major chag בלבד (flags.CHAG, `il: true`, ללא minor fasts/modern/Rosh Chodesh, ללא Chol HaMoed).
- `getHebrewMonth(date)` — שם חודש בעברית דרך `Locale.lookupTranslation` (fallback ל-English).
- `formatHebrewDate(date)` — "ד׳ אייר תשפ״ו" דרך `renderGematriya(true)` ללא ניקוד.
- `getUpcomingHolidays(from, days=90)` — לרשימת חגים קרובים (כלי עזר לעתיד).

**תיקון מה-spec:** ה-spec רשם `.getMonthName("h")` ו-`.toString("h")` — ב-@hebcal/hdate v6 הAPI שונה. `getMonthName()` תמיד אנגלית; לעברית צריך `Locale.lookupTranslation` או `renderGematriya()`. תוקן.

### חלק 2 — Pricing model

`lib/calendar/pricing-model.ts` — pure, אין state, SSR-safe:
- `getPriceInfo(date)` — מחזיר { level, multiplier, label, reasons, color }.
  - שבת/חג → `blocked` (multiplier 0)
  - חודש לועזי May-Sep → +20%; Dec-Feb → -15%
  - יום בשבוע 5 (חמישי) → +15%; 1,2 → -10%; 0 (ראשון) → -5%
  - חודש עברי אלול/ניסן → +5%
- `calculateSavings(from, to, budget)` — { delta, percent }
- `findCheapestNearby(from, windowDays=30)` — מוצא תאריך זול בחלון ±30 ימים

### חלק 3 — UI components

- `components/calendar/CalendarMonth.tsx` (client) — grid 7×6, RTL, ראשון בימין, navigation ◀/▶/[היום], לחיצה מציגה panel למטה.
- `components/calendar/PriceTooltip.tsx` (server) — selected-date detail card. בכוונה לא floating tooltip — touch לא תומך, edge-cases של viewport. רינדור כפאנל מתחת לגריד עדיף.
- `components/calendar/HebrewDateLabel.tsx` (server) — `<time>` עם dateTime ISO + Hebrew label.
- `components/calendar/PriceHeatmapLegend.tsx` (server) — 6-step legend.
- `components/calendar/AISuggestionBanner.tsx` (client) — קורא `state.event` מ-app_states. מוצג רק אם:
  1. יש event עתידי
  2. ה-date שלו high/very_high
  3. נמצא תאריך זול ±30 ימים (delta >= 0.05)
  4. לא בוטל ב-7 ימים אחרונים (localStorage)
  
  banner עם expandable comparison + dismiss.

### חלק 4 — Wiring

- `app/calendar/CalendarClient.tsx` — shell של `/calendar`. Header + AISuggestionBanner + CalendarMonth.
- `app/calendar/page.tsx` — server wrapper עם metadata (Next 16 לא מאפשר metadata בקובצי "use client", זה pattern שכבר השתמשתי בו ב-`/start` (R62)).
- `lib/navigation.ts` — נוסף `{ href: "/calendar", label: "לוח שנה" }` ל-`HEADER_NAV` (בין צ׳קליסט לספקים). MOBILE bottom nav (`NAV_ITEMS`) נשאר על 5 פריטים (קפול חיוני; משתמשי מובייל נכנסים דרך header או dashboard).

## Dep חדש שהותקן

- `@hebcal/core@^6.5.1` — engine רשמי לחישוב לוח עברי. הספק מקובל מ-2010, ~tree-shakable, נחוץ לחישוב חגים מדויק במציאות הישראלית. **לא ביצעתי install של @sentry/nextjs, @serwist/next, @next/bundle-analyzer, web-push** — לפי המדיניות מ-R63/R64 (אין dep חדש בלי הצדקה ברורה לפני השקה). @hebcal/core הוא הצדקה ברורה — אי-אפשר לבנות פיצ׳ר חגים יהודיים בלי engine מדויק.

## Verification

- ✓ `npx tsc --noEmit` נקי · ✓ `npm run lint` 0 errors (6 warnings קודמות, לא בקבצי R65) · ✓ `npm run build` Compiled successfully (`/calendar` בנוי) · ✓ `npx vitest run` 75/75.
- ✓ TypeScript strict · 0 `any` · 0 `@ts-ignore`. אין שינוי DB. אין dep חדש חוץ מ-`@hebcal/core`.
- ⏳ **קבלה (owner):** ב-/calendar במכשיר — וודא: שבתות אפורות, חגים אפורים, יום חמישי בקיץ אדום, יום ראשון בחורף ירוק, hover/click מציג tooltip עם פירוט. אם יש לכם event ביום פיק, ה-banner קופץ.

## Deferred (פוסט-השקה)

הספק יקבל את הspec המלא כשיהיה זמן בנוחות:
1. **Appointments table** + AppointmentSheet — דורש שינוי סכמה. ה-FKs ב-spec (`events`, `vendor_profiles`) לא קיימים — אפשר להתאים (event_id כtext מתוך JSON, vendor_id ל-`vendor_applications.id`).
2. **Push notifications** — `web-push` dep + VAPID + service worker (R64 דחה SW) + Vercel Pro cron.
3. **Vendor integration** — לאחר שappointments קיים.

הזחת ה-spec הזה ל-R66+ post-launch תאפשר טסטינג ראוי של push (דורש מכשיר פיזי + ניצול של Vercel Pro upgrade).
