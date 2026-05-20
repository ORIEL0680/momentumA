# Changelog — Momentum

כל השינויים המשמעותיים בפרויקט. פורמט: [Keep a Changelog](https://keepachangelog.com/he/1.1.0/).

---

## [R67] — 2026-05-20 — Calendar appointments + Wedding Brain + Header cleanup (R56)

ממש את ה-spec "R56". בR55 בחרת MVP; ב-R56 חזרת לסט מלא. השמטתי בכוונה
push notifications (לא הוזכרו ב-R56, דורש SW/VAPID/Vercel-Pro cron).
tsc/lint(0)/build/test(75/75) ירוקים. 1 migration ידני, אין dep חדש.

- `supabase/migrations/2026-05-20-calendar-appointments.sql` — טבלת appointments + RLS + טריגר updated_at. **סטיות:** `event_id text` (לא FK ל-events — לא קיים), `vendor_id` FK ל-`vendor_applications` (לא `vendor_profiles` — לא קיים).
- `lib/calendar/wedding-brain.ts` — `WEDDING_TIMELINE` (24 פריטים) + generator.
- `lib/calendar/appointment-templates.ts` — 8 תבניות + `CATEGORY_COLORS`.
- `lib/calendar/appointments.ts` — CRUD client-side דרך RLS.
- `app/api/calendar/seed-brain/route.ts` — POST עם JWT, idempotent (בודק existing rows במקום `user_profiles.calendar_seeded` שלא קיים).
- `components/calendar/CalendarMonth.tsx` (rewrite) — dots לפגישות, ✨ pulse לAI pending, **ריבוע זהב + 💍** ליום החתונה עם `wedding-day-pulse` keyframes (reduced-motion safe). Click handlers: יום ריק → Sheet, יום עם פגישות → פאנל פירוט.
- `components/calendar/AppointmentSheet.tsx` (חדש) — modal CRUD עם תבניות, תאריך עברי+לועזי, validation.
- `components/calendar/SuggestionPopover.tsx` (חדש) — Modal accept/edit/dismiss. בכוונה לא floating popover (touch-friendly + viewport-edge-safe).
- `components/calendar/BrainOnboarding.tsx` (חדש) — splash one-shot, localStorage gate, useSyncExternalStore (אין flash).
- `app/calendar/CalendarClient.tsx` — orchestrator. fetch, sheet/popover state, refetch on save.
- `app/globals.css` — `@keyframes wedding-day-pulse` + class + reduced-motion override.

**Header cleanup (CONSERVATIVE):** `lib/navigation.ts` חולק לHEADER_NAV (3 פריטים: המסע/מוזמנים/לוח שנה) + `MORE_MENU_NAV` (6 פריטים). `Header.tsx` קיבל כפתור `...` (MoreHorizontal) שפותח dropdown עם MORE_MENU. Mobile hamburger = union. **לא נגעתי** בChatBell/EventSwitcher/theme/UserMenu — מעורבים בintegrations רבים, סיכון 4 ימים לפני השקה לא מצדיק תועלת.

**Deferred:** Push notifications + SW + VAPID + Vercel-Pro cron (לא ב-R56), animation polish מעבר לבסיס, הסרה אגרסיבית של בorders ימני בHeader.

**אימות:** tsc נקי · lint 0 err (6 warnings קודמות) · build ok · 75/75 · strict 0 any · אפס dep. הפעם **`npx vercel --prod`** מופעל בסוף כדי שלא יקרה כמו R60-R65 שישבו ברפו 4 ימים בלי deploy.

---

## [R65] — 2026-05-20 — Calendar MVP: heatmap + AI date-shift (R55)

ממש את ה-spec "R55" ב-scope MVP (אחרי האישור המפורש). המשתמש בחר
"heatmap + AI date-shift" כשנציע 4 אפשרויות שכוללות גם פתרון מלא +
דחייה. tsc/lint(0)/build/test(75/75) ירוקים. 1 dep חדש: `@hebcal/core`.

- `lib/calendar/hebrew-calendar.ts` — wrapper על `@hebcal/core` v6: `isShabbat`, `isJewishHoliday` (major chag בלבד, `il:true`), `getHebrewMonth` (Hebrew via `Locale.lookupTranslation`), `formatHebrewDate` (`renderGematriya(true)` — ללא ניקוד). **תיקון מה-spec:** `getMonthName("h")` ו-`toString("h")` של ה-spec לא קיימים בv6; השתמשתי ב-API הנכון.
- `lib/calendar/pricing-model.ts` — pure functions: שבת/חג→blocked, מאי-ספטמבר→+20%, דצמבר-פברואר→-15%, חמישי→+15%, ב׳/ג׳→-10%, אלול/ניסן→+5%. `calculateSavings`, `findCheapestNearby`.
- `components/calendar/CalendarMonth.tsx` — month grid RTL, 7×6, navigation ◀/▶/[היום], לחיצה→panel למטה.
- `components/calendar/PriceTooltip.tsx` — selected-date detail card (לא floating — touch-friendly + edge-case-proof).
- `components/calendar/AISuggestionBanner.tsx` — קורא `state.event` מ-app_states. מראה רק אם יש event עתידי בdate היקר עם cheaper alternative ±30 ימים. dismissible 7 ימים localStorage.
- `components/calendar/HebrewDateLabel.tsx` + `PriceHeatmapLegend.tsx` — small helpers.
- `app/calendar/{page,CalendarClient}.tsx` — server metadata + client shell.
- `lib/navigation.ts` — `{ href: "/calendar", label: "לוח שנה" }` בHEADER_NAV (בין צ׳קליסט לספקים). MOBILE NAV ללא שינוי (5 פריטים capacity).

**Deferred למחזור פוסט-השקה (R66+):** appointments-CRUD ב-DB (FKs ל-events/vendor_profiles לא קיימים), push notifications (web-push dep, VAPID, SW, Vercel-Pro cron), vendor integration, day-view. מפורט ב-TASKLIST.R65.md.

**אימות:** tsc נקי · lint 0 err (6 warnings קודמות) · build ok (`/calendar` בנוי) · 75/75 · strict 0 any · אפס שינוי DB.

---

## [R64] — 2026-05-20 — Performance + PWA Polish (R54)

ממש את ה-spec "R54" עם איפוק לפני השקה: עשיתי מה שניתן לאמת ולשמר
ביציבות, ודחיתי כלים שמצריכים dev-dep חדש או שינוי build pipeline.
tsc/lint(0)/build/test(75/75) ירוקים. **אפס dep חדש, אפס שינוי DB.**

**ממצאים — מה לא נדרש לתקן:**
- *Full-library imports:* רק `import * as THREE` ב-Room3DScene, וזה כבר ב-lazy chunk (R44+). שאר הbundle נקי.
- *Tesseract / PDF / Excel:* לא מותקנים. Confetti = Canvas2D custom (16KB פחות מהספרייה).
- *9 raw `<img>` tags:* כולם user-uploaded / data URLs. R20 documented policy אוסר המרה ל-next/image (דורש wildcard remotePatterns → open image proxy). שמרנו.

**מה נוסף:**
- `components/InstallPWA.tsx` — RTL Hebrew install card. 3 מסלולים: Android (beforeinstallprompt), iOS (manual "הוסף למסך הבית"), כבר-מותקן (null). 7-day dismiss localStorage. `track("pwa_installed")` בקבלה.
- `app/dashboard/page.tsx` — `<InstallPWA/>` נטען רק שם (signed-in only). `router.prefetch("/guests")` + `prefetch("/budget")` ב-useEffect.
- `app/balance/page.tsx` — `VoiceCapture` הומר ל-`next/dynamic({ssr:false})`. /balance's eager bundle נחסך מקוד ה-speech recognition.

**מה לא בוצע + סיבה (תועד ב-TASKLIST.R64):**
- **Sentry, @next/bundle-analyzer, @serwist/next** — dep installs חדשים, 5 ימים לפני השקה. ה-spec הציע, אני לא מצדיק עכשיו. PNG icons + Lighthouse scores + service worker = owner-side post-launch אם תרצה.
- **API revalidate hints** — כל ה-endpoints מבוססי-Bearer → Next יעלה אותם force-dynamic; הoption יזרק warning ויתעלם. `/api/health` כבר `force-dynamic` (R63).
- **next.config.js** — הspec כתב `.js`, הקובץ הוא `.ts`. ידעתי מ-R56.

**אימות:** tsc נקי · lint 0 err (6 warnings קודמות) · build ok · 75/75 · strict 0 any · אפס dep / migration / שינוי DB. ⏳ Lighthouse + PWA install flows owner-side במכשיר אמיתי.

---

## [R63] — 2026-05-20 — Analytics + Error Tracking + Uptime (R53)

ממש את ה-spec "R53" עם adapt-to-architecture (כמו R59/R62). 3 כלי
ניטור: Plausible (full install), error tracking (extending R59 — לא
Sentry, see TASKLIST.R63 לסיבה), UptimeRobot (endpoint + manual signup).
tsc/lint(0)/build/test(75/75) ירוקים. **אין dep חדש**, אין migration.

- `lib/analytics.ts` — נוסף `track()` ו-`trackFirstOnce()` ליד `trackEvent` הקיים (4 callers שמרים יציבים).
- `app/layout.tsx` — Plausible loader (nonce'd inline IIFE, תחת strict-dynamic CSP) + `<ErrorListener/>` + `<VitalsReporter/>`. `middleware.ts` הוסיף `plausible.io` ל-connect-src.
- `app/error.tsx` + `app/global-error.tsx` — קוראים ל-`logError` (R59 endpoint) על כל קריסה. global-error inlining ה-fetch כדי לא לייבא מ-`lib/`.
- `components/error-tracking/ErrorListener.tsx` (חדש) — `window.error` + `unhandledrejection` → logError, rate-limited 10/session.
- `app/api/health/route.ts` (חדש) — health check ל-UptimeRobot (HEAD על app_states עם anon).
- `app/vitals.tsx` (חדש) — `useReportWebVitals` → Plausible, "poor" → error_logs.
- Funnel tracking ב-7 מקומות: signup_started (3 paths) · signup_completed · first_event_created · first_guest_added · first_envelope_filled · first_budget_item · vendor_application_submitted. 0→1 transitions מתועדות עם prev-length refs כדי לא להפעיל false-fire למשתמש חוזר.
- `app/admin/page.tsx` — `<MonitoringCard/>` עם 3 קישורים (Plausible / R59 errors / UptimeRobot).
- **סטיות מ-spec:** (1) **לא הותקן Sentry** — ~70KB bundle weight + wizard אינטראקטיבי לא רץ אצלי + R59 מספק כיסוי דומה. ה-boundaries המוכנים = wire-up אחיד אם תרצה Sentry post-launch. (2) `/api/health` לא משתמש ב-`@/lib/supabase/server` ולא query ל-`user_profiles` (שניהם לא קיימים — מתועד מ-R47/R59/R62). (3) Sentry link במונטור-card הוחלף ב-internal link ל-`/admin/errors`.
- **ידני (owner):** רישום Plausible + UptimeRobot, הוספת 3-4 מוניטורים, הגדרת goals ב-Plausible. פרטים ב-TASKLIST.R63.md.
- אימות: tsc נקי · lint 0 err (6 warnings קודמות) · build ok · 75/75 · strict 0 any · אפס dep · אפס שינוי DB.

---

## [R62] — 2026-05-20 — ניתוב: משתמש מחובר → ישר לדשבורד (R52)

ממש את ה-spec "R52" עם adapt-to-architecture (אישור מהמשתמש). הסשן
ב-localStorage לא בcookie → server-component getUser() תמיד מחזיר
null → ה-redirect הסטנדרטי לא יורה. במקום זה, **inline pre-paint
script** שרץ סינכרונית ב-SSR HTML לפני paint. אין flash בשני
המקרים (מחובר ולא). tsc/lint(0)/build/test(75/75) ירוקים.

- `app/page.tsx` — async server component. nonce מ-`headers()` + סקריפט שבודק `^sb-.*-auth-token$` ב-localStorage ועושה `location.replace("/dashboard")` אם נמצא.
- `app/signup/page.tsx` (rewrite) + `app/signup/SignupClient.tsx` (חדש, התוכן הישן עם named export). ה-wrapper קורא `searchParams.next` (וגם `returnTo` legacy), מסנן open-redirect (חייב להתחיל ב-`/` יחיד, לא `//`/`/\\`, לא תווים מסוכנים, עטיפת `JSON.stringify`), ומזריק סקריפט redirect.
- `app/start/page.tsx` — async server עם 2 בדיקות בסקריפט: אין session→`/signup?returnTo=/start`; יש session ויש `event.id` ב-`momentum.app.v1`→`/dashboard`; אחרת StartClient.
- Header — נבדק: כבר עושה `useUser()` + gating נכון. אין שינוי.
- `lib/supabase/server.ts` — **לא נוצר בכוונה** (cookie-SSR לא יעבוד פה; ייצר בלבול בעתיד).
- אבטחה: כל ה-inline scripts נושאים `nonce` מ-CSP. הפילטר על `next` מונע open-redirect.
- **סטייה מתועדת:** ה-spec ביקש useEffect+router.push נאסר וגם getUser+redirect ב-Server Component. שני אלה לא עובדים פה (אחד גורם flash, השני לא רואה session). בחרתי דפוס שלישי: inline pre-paint script, אותו דפוס שכבר משמש ב-`app/layout.tsx` ל-theme.
- אימות: tsc נקי · lint 0 err (6 warnings קודמות) · build ok · 75/75 · strict 0 any · אין dep / migration / שינוי DB.

---

## [R61] — 2026-05-20 — R51-תוספת: WelcomeTour hardening

תוספת ל-R60. 3 דרישות: "סיום ההדרכה" בכל שלב, עיגון "לעולם לא שוב",
ואפשרות להפעיל מחדש מההגדרות. tsc/lint(0)/build/test(75/75) ירוקים.

- `lib/useFirstLogin.ts` — נחשף `TOUR_COMPLETED_KEY` + `forceMarkTourCompletedSync()` (sync, idempotent, בטוח ל-unmount cleanup) + `resetTour()` (מנקה flag + מודיע listeners).
- `components/onboarding/WelcomeTour.tsx`:
  - שמות חדשים: `"דלג"` → `"סיום ההדרכה"`; `"סיים"` → `"סיימתי"` (צעד 5).
  - skip path: toast `"אפשר תמיד לחזור לסיור מההגדרות"` (info, **בלי confetti**); finish path: confetti + toast הצלחה.
  - `FADE_MS = 200` עם binding על opacity/pointerEvents → fade-out חלק.
  - **close-on-unmount safety net**: `useEffect` cleanup קורא `forceMarkTourCompletedSync()` אם המשתמש סגר את הטאב באמצע הסיור — מבטיח שהsiror לא יחזור.
- `app/settings/page.tsx` — `<Section icon={HelpCircle} title="עזרה והדרכה">` חדש. כפתור `"הפעל מחדש"` קורא `resetTour()` + מנווט ל-/dashboard → ה-tour קופץ אוטומטית (useSyncExternalStore מעורר re-render).
- **סטייה (כמו R60):** ה-spec דיבר על `UPDATE user_profiles SET onboarding_completed=false`. אין טבלה כזו → `resetTour()` מסיר רק את localStorage.
- אימות: tsc נקי · lint 0 err (6 warnings קודמות) · build ok · 75/75 · strict 0 any · אין dep חדש.

---

## [R60] — 2026-05-20 — חוויית המשתמש החדש (השעה הראשונה)

ממש את ה-spec "R51". 4 חלקים — מיילי auth מותגים, welcome email
אחרי שעה (אינפרה), welcome tour ראשון, ושיפור empty-state ב-/balance.
tsc/lint(0)/build/test(75/75) ירוקים. 1 migration ידני, אין dep חדש.

- `emails/` (7 קבצים) — 6 תבניות auth ב-RTL/inline-styles + welcome.html + README שמסביר בדיוק לאן להדביק כל אחת ב-Supabase Dashboard. paste-ready, לא חלק מה-build.
- `supabase/migrations/2026-05-20-scheduled-emails.sql` — `scheduled_emails` + RLS deny-all + trigger על `auth.users` (לא `user_profiles` — לא קיים).
- `app/api/send-scheduled/route.ts` + `vercel.json` crons (`*/15 * * * *`) — שליחה דרך Resend (אותו pattern של `vendorNotifications`). Graceful degrade בלי `RESEND_API_KEY` (מסמן שורות sent עם reason, לא loop). אימות `CRON_SECRET`.
- `lib/useFirstLogin.ts` — `useSyncExternalStore` על localStorage `momentum.tour.completed.v1`. server snapshot מחזיר completed=true → אין render ב-SSR, אין hydration mismatch.
- `components/onboarding/WelcomeTour.tsx` — 5-step modal (Welcome → ניצוץ → אורחים → תקציב → ספקים). Esc=דלג, Enter/→=הבא, ←=חזרה. אין backdrop-click. סיום: `fireConfetti` + toast. דלג נחשב הושלם.
- `app/dashboard/page.tsx` — `<WelcomeTour />` משולב (משתמע עם WelcomeBanner הקיים).
- `app/balance/page.tsx` — div plain-text של "עוד לא אישרו..." → `<EmptyState>` נכון עם icon/CTA.

**סטיות מתועדות (פערים מהארכיטקטורה הנחתה):** `user_profiles.onboarding_completed` לא קיים → localStorage per-device. trigger על `auth.users` לא `user_profiles`. Coachmarks pixel-anchored → 5-step modal (יציב בכל רוחב). `*/15` cron דורש Vercel Pro (Hobby = daily). Resend "from" כרגע `onboarding@resend.dev` עד שהדומיין יאומת.

**ידני (owner):** הריצו את ה-migration; הדביקו את 6 התבניות ב-Supabase Auth → Email Templates (subjects ב-README); הוסיפו `RESEND_API_KEY` + `CRON_SECRET` ב-Vercel env; אם על Hobby — החליפו cron ל-`0 9 * * *`.

---

## [R59] — 2026-05-19 — Admin Dashboard למייסד (מותאם לארכיטקטורה הקיימת)

ממש את ה-spec "R49" (R49 תפוס → R59). **המשתמש אישר: "התאם
לארכיטקטורה הקיימת"** — ה-spec הניח סכמה רלציונית שלא קיימת
(האפליקציה: JSON-blob per-user ב-app_states + admin_emails + route
service-role קיים). tsc/lint(0)/build/test(75/75) ירוקים. 1 migration
ידני, ללא תלות חדשה.

- `supabase/migrations/2026-05-19-error-logs.sql` (חדש) — `error_logs` + RLS (קריאה לאדמין, כתיבה רק service-role). `lib/error-tracker.ts` + `app/api/admin/log-error` (service-role insert, caps, ללא טוקנים).
- `lib/admin/server.ts` — `requireAdmin()` (anon+JWT → admin_emails תחת RLS → service-role). הגבול האבטחתי האמיתי. `components/admin/AdminGuard.tsx` — client guard ל-UX, non-admin → /dashboard שקט. (אין middleware gate — סשן ב-localStorage, אין cookie ל-SSR; מתועד.)
- `/api/admin/stats` — הורחב additively (legacy /admin/dashboard ממשיך לעבוד): sparklines 7d, deltas, upcoming events מ-app_states JSON, errors_last_24h (graceful). `/api/admin/users` + `/api/admin/errors` חדשים (service-role). `lib/admin/{queries,realtime,types}.ts`.
- UI סגנון Stripe בשפת הזהב: `StatCard`/`MiniChart`/`ActivityFeed` (realtime) + `app/admin/page.tsx` (KPIs, פעולות דחופות, אירועים קרובים, פיד חי) + sub-pages users/users[id]/vendors·applications/events/errors.
- `logError` חובר ל-auth callback (client) + confirm route (server).
- **סטיות (מאושרות):** admin_emails במקום is_admin/admin_users (כבר seeded — אין UUID להכניס, email-based); events מ-app_states JSON, users מ-Auth API (אין user_profiles/events tables); revenue placeholder (Stripe Q3); usage chart 7d (לא 30d).
- **ידני:** הרצת migration error-logs ב-Supabase; `talhemo132@gmail.com` כבר admin; `SUPABASE_SERVICE_ROLE_KEY` ב-Vercel env (כבר נדרש להיום).
- אימות: tsc נקי · lint 0 err (6 warnings קודמות, לא בקבצי admin) · build ok · 75/75 · strict 0 any · כל query ב-try/catch.

---

## [R58] — 2026-05-19 — שכתוב מלא של עמוד הנחיתה (קופי + פיצ׳רים + יוקרה)

ממש את ה-spec "R48" (R48 תפוס → R58 ברצף). tsc/lint(0)/build/
test(75/75) ירוקים. ללא תלות חדשה, ללא מיגרציה. כל הסקציות Server
Components, אפס תמונות חיצוניות (CSS/SVG inline).

- **קופי קריטי:** הוסרו כל "ללא/בלי כרטיס אשראי" / "ללא חתימת אשראי לחינם" (Stripe רק Q3 2026 — טענה מטעה) → "התחלה חינמית · ללא התחייבות". (`Hero`, `PricingSection`, `FinalCTA`)
- **עברית/אחידות:** וואצפ→וואטסאפ; כל ה-CTAs ללשון רבים (התחל→התחילו); נוסחו מחדש Pain/Solution/HonestStats/FinalCTA לפי ה-spec.
- `components/landing/FeatureGrid.tsx` (חדש) — 12 פיצ׳רים, grid 1/2/3, צ׳יפ אייקון זהב (color-mix על `--gold-100`), hover lift+glow.
- `components/landing/AppShowcase.tsx` (שכתוב) — 3 mockup-טלפונים CSS (דשבורד/מוזמנים/Live), notch, gold reflection, רקע נקודות-זהב, 6 callouts עם SVG connector.
- `components/landing/TrustSection.tsx` (חדש) — "תשתית של בנק. חוויה של רויאלטי." + 3 עמודי אבטחה/תשתית/תמיכה.
- `FAQ` — 2 ניסוחים תוקנו + 4 שאלות חדשות (סוגי אירועים, פרטיות, PWA/native, 100 הראשונים).
- `Hero` — badge "Israeli Startup", 2 orbs עדינים (rose/emerald 0.15), social-proof (4 avatars + 27 זוגות), h1 → `gradient-gold-shimmer`.
- `PricingSection` — "73 מקומות נשארו מתוך 100", שורת "מאובטח על ידי:" (Supabase/Twilio/OpenAI/Vercel, font-mono), trust-row → ביטול/החזר/תמיכה אנושית.
- `app/globals.css` — `@keyframes goldShimmer` + `.gradient-gold-shimmer` (טוקני `--gold-*`, reduced-motion→static, נוסף ל-print override); `.glow-orb-rose`/`.glow-orb-emerald`.
- `app/page.tsx` — FeatureGrid אחרי Solution, TrustSection אחרי Pricing.
- **סטייה מתועדת:** AppShowcase ללא קרוסלת-JS/עיגון-פיקסל (חוק Server-Components) — 3 טלפונים בשורה (מרכזי מודגש) + connector כמוטיב SVG; הכוונה מולאה, zero-JS ויציב.
- אימות: tsc נקי · lint 0 err (6 warnings קודמות ב-terms, לא קשורות) · build ok · 75/75 · strict 0 any. ⏳ ביקורת ויזואלית/Lighthouse — owner-side.

---

## [R57] — 2026-05-19 — תיקון אוטנטיקציה אחרי מעבר ל-moomentum.events

ממש את ה-spec "R47" (R47 כבר תפוס → R57 ברצף). תיקון הבאג
"לא מצליח להיכנס מהדומיין החדש". tsc/lint(0)/build/test(75/75)
ירוקים. ללא תלות חדשה, ללא מיגרציה. ללא נגיעה ב-Supabase/OAuth/Vercel
(עודכנו ידנית ע"י המשתמש).

- **השורש:** `lib/user.ts` בנה `redirectTo`/`emailRedirectTo` דרך `tryGetPublicOrigin()` שמחזיר `NEXT_PUBLIC_SITE_URL` קודם. עוגיית session היא host-scoped → כניסה מ-moomentum.events נחתה ב-callback על host אחר מה-cookie → ההתחברות נכשלה בשקט.
- `lib/user.ts` — הוסר import `tryGetPublicOrigin`; נוסף `authCallbackUrl()` → ``${window.location.origin}/auth/callback`` (המודול `"use client"`; SSR-guard→undefined→Supabase Site URL). תוקנו `signInWithOAuth.redirectTo` ו-`signUpWithEmail.emailRedirectTo`. **`lib/origin.ts` לא נגע** — env-first בכוונה לקישורי WhatsApp/RSVP.
- `app/auth/confirm/route.ts` — `console.log("[auth/confirm]",…)` בתחילת GET + `console.error` בכשל verifyOtp (Vercel Functions Logs). טוקנים לא נרשמים — רק נוכחות.
- `app/auth/callback/page.tsx` — `console.log("[auth/callback]",…)` מובנה בתחילת finish (debug client / צילום-מסך). UI השגיאה הידידותי כבר היה קיים.
- `app/signup/page.tsx` — seed ל-`error` מ-`?error=` ב-lazy useState init (לא setState-in-effect) → ה-banner האדום הקיים מציג שגיאה במקום מסך ריק.
- `lib/env-validate.ts` (חדש) — `validateEnv()` מזהיר אם `NEXT_PUBLIC_SITE_URL` חסר/ישן/לא-https; נקרא פעם אחת ב-`app/layout.tsx` (server, production, לא זורק).
- `middleware.ts` — נבדק: CSP-only, ללא host enforcement. ללא שינוי. `vercel.json` redirects כבר ב-R56.
- **סטייה מתועדת:** ה-spec הניח `app/auth/callback/route.ts`; בפועל זה client page + `auth/confirm/route.ts`. יושמה הכוונה על המבנה האמיתי; נשמר redirect ל-`/auth/callback?error=` (mapping עשיר) במקום `/signup` (היה רגרסיה).
- אימות: tsc נקי · lint 0 err (6 warnings קודמות ב-terms, לא קשורות) · build Compiled successfully · vitest 75/75 · strict, 0 any. ⏳ מבחן קבלה (כניסה חיה מ-moomentum.events + Vercel Logs) — owner-side.

---

## [R56] — 2026-05-19 — מעבר לדומיין moomentum.events (תיקון רפרנסים)

ממש את ה-spec "R46 — מעבר לדומיין" (R46 כבר תפוס בהיסטוריה →
הסבב ממוספר R56 ברצף). deadline: לפני השקה 26.5. החלפת כל הופעות
`momentum-psi-ten.vercel.app` → `moomentum.events` + redirects
ל-canonical. tsc/lint(0)/build/test(75/75) ירוקים. ללא תלות חדשה,
ללא מיגרציה. **ללא נגיעה ב-Vercel/Supabase/OAuth — ידני.**

- `app/layout.tsx` — `SITE_URL` fallback → `https://moomentum.events` (env עדיין מנצח); נוסף `alternates.canonical` ו-`openGraph.url` (env-driven).
- `app/terms/page.tsx` — סעיף הגדרות: הדומיין הישן → `moomentum.events`.
- `app/manifest.webmanifest/route.ts` — נוסף `id` יציב (env-driven) + `scope:"/"`; `start_url`/`scope` נשארו יחסיים.
- `README.md` / `.env.example` — דוגמת/ברירת `NEXT_PUBLIC_SITE_URL` → `moomentum.events`; נוסף `NEXT_PUBLIC_APP_URL`. `.env.local` (gitignored) עודכן מקומית.
- `vercel.json` — `redirects` 301: `www.moomentum.events` ו-`momentum-psi-ten.vercel.app` → apex (הדומיין הישן ימשיך לענות אך יפנה — שומר קישורים שנשלחו).
- `DEPLOYMENT.md` — שלב 5 עודכן ל-`moomentum.events` + צעדי DNS/Vercel/Supabase/OAuth הידניים.
- הקוד כבר env-driven (`lib/origin.ts`/`NEXT_PUBLIC_SITE_URL`) — אין domain hardcoded ב-invitation/shortLinks וכו'. אין sitemap/robots/manifest.json בריפו (לא נוצרו — מחוץ ל-scope).
- אימות: `tsc` נקי · `lint` 0 errors (6 warnings קודמות) · `build` Compiled successfully · `vitest` 75/75 · grep מאשר אפס `momentum-psi-ten` פרט לכלל ה-redirect ותיעודו.
- **לידני (owner):** Vercel Domains + env, Supabase Auth URLs, Google OAuth redirect URIs, ובדיקות פוסט-פריסה.

---

## [R55 · יום 2/3] — 2026-05-19 — SMART INPUT: קלט קולי + אישור + מאזן

המשך ה-spec "R45 — SMART INPUT" (יום 1 = R54). יום 2: רכיב הקול,
זרימת אישור חובה, וחיבור לעמוד המאזן. tsc/lint(0)/build/test(75/75)
ירוקים. ללא תלות חדשה, ללא מיגרציה.

- `lib/useSpeechRecognition.ts` — hook דק מעל Web Speech API (he-IL): תמיכה/אי-תמיכה, start/stop, transcript סופי + interim חי, שגיאות (חסימת מיקרופון/אין-דיבור/כללי), restart שקוף בין sessions. **פרטיות: התמליל נשאר אך ורק ב-state — אפס רשת.** טייפים מינימליים (אין `any`/`@ts-ignore`); עומד בכללי react-hooks (lazy useState init, אין setState-in-effect, אין ref ב-render).
- `components/balance/VoiceCapture.tsx` — capture (מיקרופון + תמליל חי) → review: כל רשומה = `parseHebrew`+`matchName` מול האורחים שהגיעו, שדה סכום לעריכה, עד 3 צ'יפים של התאמות + סיבה, "דלג", checkbox הכללה. **שום כתיבה ל-store מהרכיב** — רק `onApply` אחרי "אשר והחל". אישור אנושי חובה לכל קלט; חסר-התאמה → טיפול ידני.
- `app/balance/page.tsx` — כפתור "קלט קולי" בסרגל + מודאל; `applyVoiceRows` קורא `actions.setGuestEnvelope` רק לשורות שאושרו (amount>0); הרשימה מתעדכנת אוטומטית.
- **דחייה מתועדת (יום 3):** Edge OCR (OpenAI Vision — מפתח שרת, אסור ב-bundle), `EnvelopeScan` (מצלמה), `SmartInputFAB`.
- אימות: `tsc` נקי · `lint` 0 errors (6 warnings קודמות) · `build` Compiled successfully (/balance) · `vitest` 75/75 · אפס deps · אפס מיגרציה. ⏳ בדיקת מיקרופון בפועל (he-IL, הרשאה, דיוק) — owner-side, דורש מכשיר אמיתי.

---

## [R54 · יום 1/3] — 2026-05-19 — SMART INPUT למאזן (שכבת לוגיקה + טסטים)

ממש את ה-spec "R45 — SMART INPUT" (השם R45 כבר תפוס בהיסטוריה →
הסבב ממוספר R54 ברצף). יום 1 בלבד לפי שער ה-spec: 3 ספריות טהורות
+ טסטים ירוקים, ורק אז ממשיכים. tsc/lint(0)/test(75/75) ירוקים.
ללא תלות חדשה, ללא מיגרציה.

- `lib/hebrewNumbers.ts` — מילות-מספר עברית → מספר שלם. טהור/איזומורפי, אפס deps. יחידות (זכר/נקבה), עשרות, מאות (מאה/מאתיים/X מאות), אלפים (אלף/אלפיים/שלושת אלפים), המחבר ו־, ומחרוזות ספרות. `null` כשאין מספר. `isNumberWord()` עוזר.
- `lib/voiceParser.ts` — תמליל → `ParsedEntry[]` (`{name,amount,rawText}`). פיצול על מפרידים מדוברים (ואז/וגם/אחר כך/פסיק/שורה) + מכונת-מצב per-chunk שמפצלת רצף בלי פסיקים ("אבי 500 שירה 300 יוסי 400" → 3). רק סכום > 0 נוצר; הכול עובר אישור downstream.
- `lib/nameMatcher.ts` — התאמת שם עברי מטושטשת (Levenshtein + נרמול אותיות-סופיות/ניקוד/ה־ פתיחה). עד 3 הצעות מדורגות + סיבה, סינון score>0.3.
- טסטים: `tests/hebrewNumbers.test.ts` (36), `tests/voiceParser.test.ts` (19), `tests/nameMatcher.test.ts` (13) — סופקו 36/19/13 מול דרישת ה-spec 20/15/10. סך הכול 75/75 ירוקים.
- **דחייה מתועדת (ימים 2-3):** `VoiceCapture` (Web Speech + getUserMedia, דורש מיקרופון/מכשיר), זרימת Confirmation, אינטגרציית מאזן, Edge OCR (OpenAI Vision — מפתח שרת, אסור ב-bundle), `EnvelopeScan` (מצלמה), `SmartInputFAB`. דורשים חומרה + מפתח שרת + קבלה על מכשיר אמיתי — owner-side לפי ה-spec עצמו.
- אימות: `npx vitest run` 75/75 · `tsc --noEmit` נקי · `lint` 0 errors (6 warnings קודמות, לא בקבצים החדשים) · אפס deps · אפס מיגרציה.

ימים 2-3 (קול/מצלמה/OCR) — בהמשך, owner-side לאימות מכשיר.

---

## [R44 · 1/3] — 2026-05-18 — LIVING SPARK (ניצוץ זהב חי בדשבורד)

ראשון מתוך 3 מהפכות עיצוב להשקה (commit לכל פיצ'ר). הקאונטדאון הסטטי
בדשבורד הוחלף ב-LIVING SPARK — ניצוץ זהב Canvas2D שמתפתח לאורך המסע.
tsc/lint(0)/build/test(9/9) ירוקים. ללא תלות חיצונית חדשה, ללא מיגרציה.

- `components/dashboard/LivingSpark.tsx` — Canvas2D וניל (אפס ספריות), rAF יחיד עם cleanup מלא, 40 חלקיקים. התפתחות לפי ימים-לאירוע (פזור→התקבצות→הילה→פעימה→התפוצצות ביום→זר אור). פלטת זהב. API אימפרטיבי מוכן: `flash/ripple/shake` (לא ממציאים טריגרים — הדשבורד יקרא כשיזהה שינוי). `prefers-reduced-motion` → SVG סטטי של השלב הנוכחי (אפס אנימציה, listener עם cleanup). `aria-label` דינמי.
- `IntimateHero` — הקאונטדאון הוחלף ב-LivingSpark; מספר הימים נשאר כשורת מידע קטנה (לא tooltip). הוסרו imports שלא בשימוש; `progress` עובר מהדשבורד ל-aria.
- אימות: tsc/lint/build/test ירוקים; delta bundle אפסי (וניל, אפס deps); /dashboard נטען נקי. בדיקת 60fps בטלפון אמיתי = אצל הבעלים (מוסכם).

פיצ'רים 2 (TIME SPIRAL) ו-3 (ROOM 3D) — ב-commits נפרדים בהמשך.

---

## [R44 · 2/3] — 2026-05-18 — TIME SPIRAL (ספירלת זמן אינטראקטיבית)

ה-JourneyPath הליניארי בדשבורד הוחלף בספירלת זמן SVG. tsc/lint(0)/
build/test(9/9) ירוקים. ללא תלות חדשה (framer-motion כבר מותקן).

- `components/dashboard/TimeSpiral.tsx` — SVG 600×600, היום במרכז, ~18 חודשים נגד כיוון השעון × 3 סיבובים. כל משימת `state.checklist` = נקודה (רדיוס לפי קריטיות, צבע: בוצע/דחוף/פתוח), hover scale 1.3 + tooltip-מידע. Pointer-Events מאוחדים: pinch-zoom (0.5–3×) + drag-סיבוב + wheel; `touch-action:none`; framer-motion springs. ≥80% בוצע → זוהר זהב על כל ה-SVG.
- **התאמה מתועדת:** ה-spec ביקש "JourneyPath = fallback", אבל הוא מציג שלבי-מסע ולא את ה-checklist המתוארך שהספירלה משרטטת — לכן ה-fallback ל-reduced-motion/נגישות הוא **רשימה מסודרת לפי תאריך** מובנית עם aria-labels מלאים (לא רכיב בצורה לא נכונה). JourneyPath נשאר ב-repo, רק לא מרונדר בדשבורד (ה-import הוסר, lint נקי).
- `Date.now()` ב-useMemo מפר purity → שימוש ב-`useNow()` + placeholder עד שמתאזן.
- אימות: tsc/lint/build/test ירוקים; אפס deps חדשים; /dashboard נטען נקי. בדיקת 60fps/pinch בטלפון = אצל הבעלים.

ROOM 3D (3/3) — ב-commit נפרד בהמשך.

---

## [R44 · 3/3] — 2026-05-18 — ROOM (תצוגת אולם תלת-מימד)

תצוגת ה-Seating קיבלה מצב 3D. tsc/lint(0)/build/test(9/9) ירוקים.

- חבילות חדשות: `three@0.169`, `@react-three/fiber@9`, `@react-three/drei@10`, `@types/three`. **fiber@8 נכשל ב-peer-deps על React 19** — fiber v9/drei v10 הם הגרסאות התואמות.
- `components/seating/Room3DScene.tsx` — סצנת R3F: רצפת אולם, שולחנות עץ בגריד מ-`state.tables`, כיסאות + סמני-אורח מ-Instanced (draw call אחד לכל), רחבת ריקודים פועמת, בר עם בקבוקים, OrbitControls. **"תעמדו במקום של [שם]"** — המצלמה טסה לכיסא בגובה 1.7m ומביטה פנימה.
- `components/seating/Room3D.tsx` — עטיפה: `next/dynamic(ssr:false)` כך ש-three.js הוא **chunk עצל שנטען רק בלחיצה על "תלת-מימד"** (ה-bundle הראשי לא מושפע); זיהוי WebGL → נפילה חזרה ל-2D הקיים.
- `app/seating/page.tsx` — toggle מפה⇄תלת-מימד (ברירת מחדל: מפה).
- **סטיות מתועדות:** אין במה (`cfg.hasStage` לא קיים ב-eventConfig); WALK מלא עם device-orientation נדחה (לא ניתן לאמת headless, מסוכן) — קסם ה-"עמדו במקום של" כן מומש.
- אימות: tsc/lint/build/test ירוקים; three עצל (לא ב-bundle הראשי); /seating נטען נקי. 60fps בסצנה על מכשיר אמיתי = אצל הבעלים (מוסכם).

**R44 הושלם** — 3 הפיצ'רים, 3 commits נפרדים.

---

## [R53] — 2026-05-19 — ROOM 3D: בהיר יותר + רחבת ריקודים מרכזית + עריכה ב-3D

לבקשת הבעלים: "עדיין שחור, יותר צבעים, אולם אמיתי עם רחבה באמצע, ועריכה
ללקוחות שתשתקף ב-3D". tsc/lint(0)/build/test(9/9) ירוקים. ללא תלות חדשה.

- **נהרג ה"שחור מדי":** קירות שמפניה, רצפת אגוז בהירה, fog הורם והורחק (22→55, אין יותר תהום שחורה), hemisphere ×2, ambient ×2.5, key spotlight 8→16, ו-5 point-lights צבעוניים עזים (ורוד/טורקיז/זהב/**אמרלד**/נר) — האולם נקרא צבעוני ומואר.
- **רחבת ריקודים מרכזית יוקרתית:** inlay זהב מחזיר-אור + טבעת זהב זוהרת + uplight רך, פועם בקצב — נקרא חד-משמעית כ"רחבה באמצע".
- **עריכה מתוך 3D:** נגיעה בשולחן ב-3D פותחת את עורך השולחן הקיים (`onTableTap` עובר page→Room3D→Scene→group עם stopPropagation כדי לא לגרור מצלמה). עריכת קיבולת בשולחן כבר משנה את ה-3D חי (יותר כיסאות/אורחים; שם/מספר מתעדכן).
- נשמר: תוויות-שם בפוקוס (R51), מספרי שולחן (R49), ErrorBoundary+watchdog, instancing, lazy.

נדחה בכנות: גאומטריית שולחן ארוך (מלבני) — "שולחן אבירים" כרגע מוצג כשולחן עגול גדול יותר עם יותר כיסאות; שינוי ה-TablePlot למלבן + פריסת מושבים בשורה דורש pass זהיר (דגול, הסבב הבא). דרישת "עריכה משתקפת ב-3D" מתקיימת דרך קיבולת.

אומת: tsc/lint/build/test ירוקים; onTableTap מוקלד מקצה לקצה; אפס קוד רגיש-ביצועים/אורות-לכל-שולחן (Phase-7-safe). המראה והתחושה על המכשיר אצל הבעלים.

---

## [R52] — 2026-05-19 — ROOM 3D: פלטת "חתונה אמיתית" חמה (R44.6 פאזה 2)

ה-spec של R44.6 הוא 7 פאזות שהקבלה שלהן היא במכשיר של הבעלים (לא ניתן
לאימות אצלי), וכמה פאזות **סותרות את מנדט הביצועים של פאזה 7** (point-
light לכל שולחן + grid 36 תיבות + spotlights מסתובבים + bloom = בדיוק
הלאג ש-R49→R51 נכשלו עליו). ה-spec גם אוסר "זה בערך עובד". לכן **לא**
הצפתי את הפאזות המקסימליסטיות בעיוורון; מימשתי את השינוי הדטרמיניסטי
שהוא המנוף הכי גדול על "מרגיש כמו חתונה". tsc/lint(0)/build/test(9/9).

- פלטת `WP` + `LINENS`: רקע/קירות אגוז-שחור עמוק, fog חם וקרוב יותר (אינטימי), רצפת אגוז עמוק, אור hemisphere/ambient בגוון נר חם (moccasin).
- **מפות שולחן מתחלפות לבן→ורד→מרווה לכל שולחן** (`LINENS[i%3]`) עם sheen חם וזוהר-נר רך כשהשולחן מאויש — עושר ויזואלי אמיתי בעלות אפס.
- כל השאר (instancing, תוויות-בפוקוס מ-R51, intro, ErrorBoundary+watchdog, lazy) ללא שינוי.

נדחה במכוון (סותר ביצועים / on-device): נרות+point-light לכל שולחן (פאזה 3), grid רחבה (4), שכתוב UI (5), סליידר יום-לילה/confetti/drag (6), drag בתוך 3D (1 — לא קיים, פיצ'ר חדש). אלה דורשים pass זהיר ומשוב מהמכשיר — לא הצפה עיוורת.

אומת: tsc/lint/build/test ירוקים; שינוי צבע ממוקד, אפס קוד רגיש-ביצועים. ה-5 בדיקות הקבלה + תחושת ה"וואו" הן אצל הבעלים במכשיר.

---

## [R51] — 2026-05-19 — תיקון אמיתי: 3D נתקע (freeze מ-troika Text)

R48/R50 פספסו — זה לא שגיאה ולא צ'אנק איטי אלא **freeze של ה-main
thread**. tsc/lint(0)/build/test(9/9) ירוקים. ללא תלות חדשה.

- **שורש:** R49 רינדר troika `<Text>` עברי (SDF, בתוך `<Billboard>` פר-פריים) **לכל כיסא תפוס** (cap 400). אולם של 150–400 אורחים = מאות meshes של טקסט; bidi + shaping עברי + atlas גליפים פר-טקסט = stall של שניות ב-mount. ה-watchdog מ-R50 נכשל כי `onReady` ב-mount מבטל אותו ואז ה-freeze קורה (freeze אינו שגיאה → ErrorBoundary לא תופס; הצ'אנק כן נטען).
- **תוקן:** תוויות שם מרונדרות **רק לשולחן שבפוקוס** (≤ שולחן אחד, ~12 מקס׳). **בטעינה הראשונית אין פוקוס → אפס תוויות עברית → אפס freeze.** "תעמדו במקום של…" חושף שמות של שולחן (קומץ בכל רגע). מספרי שולחן עדיין לכל השולחנות (זול — ספרות, ≈#שולחנות). כדורי הזהב עדיין מסמנים כל כיסא תפוס (instanced).
- ErrorBoundary (R48) + watchdog (R50) נשמרו כרשת ביטחון נוספת.
- זה החסם הנכון: רינדור תווית SDF עברית לכל אורח בו-זמנית אינו אפשרי בקצב אינטראקטיבי במובייל — לא באג שניתן "לתקן", תקרה קשה. שמות-בפוקוס נותן את הכוונה בלי ה-freeze.

אומת: tsc/lint/build/test ירוקים; שינוי ממוקד; הטעינה הראשונית כבר לא יוצרת שום טקסט SDF עברי → ה-freeze נעלם מבנית.

---

## [R50] — 2026-05-19 — תיקון: 3D נתקע על מסך טעינה ארוך

הבעלים דיווח שה-3D מציג מסך טעינה אינסופי/ארוך. ה-ErrorBoundary מ-R48
תופס **שגיאות**, לא **suspense אינסופי**. tsc/lint(0)/build/test(9/9)
ירוקים. ללא תלות חדשה.

- **שורש:** (1) drei `<Environment>` בונה env-map מאחורי Suspense פנימי — בקומבו drei/three הזה עלול לא להתממש לעולם → התוכן תקוע ב-suspended (אין שגיאה → ErrorBoundary לא נורה). (2) R49 הוסיף troika `<Text>` שניפח את הצ'אנק העצל → הורדת המודול עצמה ארוכה בלי שום חסם.
- **תוקן:** הוסר `<Environment>`+`<Lightformer>` → `hemisphereLight`+`ambientLight` שלא עושים suspense (ה-spotlights + ה-point-lights ורוד/טורקיז/זהב מ-R49 נושאים את המראה). אפס async, צ'אנק קטן יותר.
- **Watchdog ב-Room3D:** הסצנה קוראת `onReady()` ב-mount; אם זה לא קרה תוך **15 שנ׳** — עוצרים את הספינר ומציגים הודעה חסומה ("3D איטי — השתמשו במפה") עם "נסו שוב" שמרנדר מחדש. מבטיח מבנית שאי-אפשר להיתקע (מכסה גם צ'אנק איטי, מה ש-ErrorBoundary לא יכול).
- ה-ErrorBoundary מ-R48 נשמר (שגיאות) + עכשיו watchdog (תקיעות) → תקלת 3D יכולה רק להפוך להודעה נקייה + מפת 2D, לעולם לא מסך תקוע.

אומת: tsc/lint/build/test ירוקים; הצ'אנקים נשארים lazy. אישור במכשיר = אצל הבעלים, אבל ה-watchdog מבטיח שהספינר נגמר תוך 15 שנ׳ בכל מקרה.

---

## [R49] — 2026-05-19 — ROOM 3D: שמות אורחים + מספרי שולחן + צבע וחיים

קפיצה שיווקית/עיצובית: שם האורח על כל כיסא תפוס, מספר השולחן על כל
שולחן, ויותר צבע וחיים. tsc/lint(0)/build(51/51)/test(9/9) ירוקים.
ללא תלות חדשה, ללא מיגרציה; three/drei/pp נשארים lazy.

- גופני Heebo (subset עברי + לטיני, אותם של ה-OG מ-R28) הוגשו מ-`public/fonts/`.
- **כל שולחן:** `<Text>` זהוב billboarded עם מספר השולחן (`table.number ?? i+1`) מעל ה-centerpiece.
- **כל כיסא תפוס:** שם האורח המשובץ, `<Text>` לבן billboarded מעל הכיסא — גופן עברי, `direction="rtl"` (bidi של troika), עם outline לקריאוּת. מיפוי אורח→כיסא אמיתי (כיסא k ← האורח ה-k בשולחן).
- billboard → תוויות קריאות מכל זווית ולאורך הפתיחה הקולנועית.
- חסם ביצועים: תוויות שם רק לכיסאות תפוסים (סמנטית נכון) + cap קשיח (מעל 400 תפוסים — דילוג); ריהוט נשאר instanced; PerformanceMonitor עדיין שולט ב-post.
- **צבע וחיים:** הפרדת צבע קולנועית — wash ורוד מצד אחד, טורקיז מהשני, מילוי זהב מקדימה (point lights עם decay/distance מכוונים). הזהב נשאר הגיבור; הרחבה ממשיכה לנשום.
- נשמר מ-R48: כל הסצנה בתוך `<ErrorBoundary>` — כשל גופן/troika/GPU יורד בחן לתצוגת מפה (אין מסך לבן).

אימות: tsc/lint/build/test ירוקים; הגופנים ב-public; הצ'אנקים lazy; /seating נטען נקי. המראה בפועל (קריאוּת/RTL/דירוג צבע/60fps) = במכשיר אצל הבעלים (ה-ErrorBoundary מבטיח שהאפליקציה לא נשברת).

---

## [R48] — 2026-05-18 — סריקת תקלת 3D + הקשחה

הבעלים דיווח על תקלה בתלת-מימד. ה-3D עולה רק מאחורי auth+אירוע+opt-in
(לא ניתן לשחזר headless) — סרקתי את צינור R47 והקשחתי את החשודים +
רשת ביטחון גורפת. tsc/lint(0)/build/test(9/9) ירוקים.

- **חשוד #1 שתוקן:** `Environment preset="sunset"` מושך HDRI מ-CDN בזמן ריצה ו-suspends עליו — כשל רשת/CDN חסום זורק בתוך Suspense ללא fallback ⇒ כל ה-Canvas נופל. הוחזר ל-rig של `<Lightformer>` בתוך הסצנה (כמו R45/R46 שעבד) — אותה תחושת HDR חם, אפס רשת.
- **רשת ביטחון (התיקון האמיתי):** `Room3D` עוטף עכשיו את הסצנה הדינמית ב-`<ErrorBoundary>` עם fallback נקי — **כל** תקלת runtime ב-three/drei/pp/camera-controls יורדת בחן במקום לשבור את העמוד; toggle ה-2D נשאר עובד.
- intro עכשיו כולו `setLookAt` דטרמיניסטי (הוסר `.rotate()` מ-top-down שגורם gimbal/NaN ב-camera-controls).
- `ChromaticAberration offset` עכשיו `THREE.Vector2` אמיתי (tuple עלול לשבור את ה-pass ב-pp v3 בזמן ריצה).

אומת: tsc/lint/build/test ירוקים; הצ'אנקים נשארים lazy; /seating נטען נקי. אישור סופי שהתקלה נעלמה = במכשיר (ה-ErrorBoundary מבטיח שגם אם משהו אחר ייכשל ב-GPU מסוים — האפליקציה כבר לא נשברת).

---

## [R47 / R44.5] — 2026-05-18 — ROOM 3D ברמת Apple-Maps-Flyover

לבקשת הבעלים — קפיצת רמה ויזואלית ("שפר את הקיים, אל תוסיף פיצ'רים").
מומשו שכבות הנשמה הוויזואלית. tsc/lint(0)/build/test(9/9) ירוקים.
תלות חדשה `@react-three/postprocessing@3` — **lazy בלבד** (רק בצ'אנק
הדינמי של Room3DScene; ה-bundle הראשי לא מושפע).

### שכבות שנשלחו (1,2,3,4,7)
- **L1 תאורה (ה-80%):** הוסר ambient/directional שטוח → `Environment preset="sunset"` (HDR אמיתי) + 2 spotlights נפחיים + `SoftShadows` (PCSS) + ACES/exposure/SRGB + fog אטמוספרי.
- **L2 חומרים:** רצפת פרקט physical (clearcoat), מפת שולחן עם sheen על רגל דקה, בקבוקי זכוכית (transmission+ior), כיסאות מרופדים, רחבת ריקודים פועמת, זהב `toneMapped=false`.
- **L3 post:** EffectComposer — Bloom/Vignette/ChromaticAberration/ACES ToneMapping; **מותנה ביצועים** (רק dpr≥2 וכל עוד PerformanceMonitor לא ירד).
- **L4 פתיחה קולנועית:** `CameraControls` יחיד, רצף 0–6ש׳ (מבט-על → סיבוב → צלילה לרחבה → זווית three-quarter), דילוג בנגיעה אחת.
- **L7 ביצועים:** כל כיסא/צלחת/אורח = draw-call אחד `<Instances>`; dpr [1,2]; PerformanceMonitor מכבה post אוטומטית.

### נדחה ל-pass הבא (L5, L6)
UI סגמנטי חדש שמחליף את כל הכפתורים + מצב WALK + long-press sheet (L5) וריפל-שיבוץ + hover-scale (L6) הם **אינטראקציות חדשות מהותיות** — לא "שיפור הקיים". מימוש חצי-אפוי ייכשל ברף ה-4/4. השליטה הקיימת (select אורח + חזרה) נשמרת כדי שכלום לא יישבר.

### סטיות מתועדות
- frameloop נשאר רציף (לא `demand`) — `demand` מקפיא רינדור במנוחה ויהרוג את הנשימה/פתיחה (נכשל בשאלת הקבלה "נושם במנוחה?"). העלות נשלטת ב-instancing+dpr+post-מותנה.
- כיסאות = boxes מ-Instanced (לא RoundedBox מקומר) — L7 מחייב Instances, RoundedBox לא ניתן ל-instance; ה-instancing מנצח, וה"לא-פלסטיק" בא מהתאורה/חומרים/post.

### אימות
tsc/lint/build/test ירוקים; pp נשאר lazy; /seating נטען נקי. מבחן ה-Apple (וידאו 15ש׳ במכשיר + חבר לא-טכנולוגי) ו-60fps על מכשיר אמיתי = אצל הבעלים (לא ניתן headless).

---

## [R46] — 2026-05-18 — שדרוג איכות ROOM 3D + תיקוני באגים

לבקשת הבעלים — איכות הרבה יותר גבוהה לתלת-מימד + תיקוני באגים.
tsc/lint(0)/build/test(9/9) ירוקים. אפס deps חדשים; three נשאר lazy.

### איכות
- **כיסאות אמיתיים** — היו קוביות חסרות-צורה (סיבוב קובייה סימטרית לא נראה). עכשיו מושב Instanced + משענת Instanced, מסובבים לכיוון השולחן → צללית כיסא אמיתית, עדיין 2 draw calls לכל הכיסאות.
- **תאורת Lightformer קולנועית** — key חם / rim קר / מילוי זהב / top רך / טבעת glint ספקולרית. השתקפויות והבלטות אמינות, ללא HDRI חיצוני.
- **רצפה מלוטשת נקייה** — היה מראה 70×70 מטושטש ובוצי; עכשיו רצפת אולם 40×40 שפויה (blur/strength מכווננים) — ברק נקי וגם זול יותר.
- ACES tone mapping + exposure 1.18, high-performance GL, `toneMapped=false` על הזהב כדי שה-centerpieces ורחבת הריקודים באמת יזהרו; נוספה טבעת זהב זוהרת סביב הרחבה.

### תיקוני באגים
- הוסר `receiveShadow` מת (shadows כבויים — ה-grounding הוא ContactShadows אפוי).
- בקבוקי זכוכית: נוסף `ior=1.45` (transmission בלי ior שובר את שבירת הזכוכית).
- אקצנטי זהב הופחתו ב-tone-mapping (נראו עמומים) → `toneMapped=false`.
- אומת ש-ContactShadows (frames=1) נאפה אחרי שהריהוט ה-Instanced כבר בסצנה.

> ביקורת באגים רוחבית (R30-style) **לא** נעשתה כאן — זה pass ייעודי נפרד; התיקונים כאן ממוקדים בפיצ'ר ה-3D (הקוד הטרי). אפשר לבקש סריקה מלאה.

---

## [R45] — 2026-05-18 — ביטול TIME SPIRAL + ROOM 3D פוטוריאליסטי

לבקשת הבעלים: פיצ'ר 2 (TIME SPIRAL) בוטל לגמרי; פיצ'ר 3 (ROOM 3D) שודרג
לאיכות פוטוריאליסטית. tsc/lint(0)/build/test(9/9) ירוקים. ללא תלות
חדשה, ללא מיגרציה.

- **בוטל TIME SPIRAL:** `components/dashboard/TimeSpiral.tsx` נמחק; הדשבורד הוחזר ל-`JourneyPath` הליניארי (הרכיב נשמר ב-repo — שחזור נקי). אין אזכורים שנותרו.
- **ROOM 3D פוטוריאליסטי** (`Room3DScene.tsx` נכתב מחדש, עדיין lazy מאחורי `dynamic(ssr:false)` — three.js לא ב-bundle הראשי): ACES tone mapping + exposure, Environment מ-`<Lightformer>` (השתקפויות+מילוי, ללא HDRI חיצוני), רצפה מלוטשת ממוראת (`MeshReflectorMaterial`), `ContactShadows` רכים אפויים, חומרי PBR (בר clear-coat, בקבוקי זכוכית transmission, מפות שולחן לבנות עם sheen, פוסטמנטים, centerpiece זוהר + point-light), צלחות+כיסאות מסובבים Instanced, רחבת ריקודים פועמת, ערפל לעומק. נשמר: instancing, dpr `[1,2]`, OrbitControls, וקסם **"תעמדו במקום של [שם]"**.
- סטיות (כמו R44): אין במה (`cfg.hasStage` לא קיים); WALK עם device-orientation נדחה.
- אימות: tsc/lint/build/test ירוקים; אפס deps חדשים; three נשאר lazy; /dashboard ו-/seating נטענים נקי. 60fps בסצנה הפוטוריאליסטית על מכשיר אמיתי = אצל הבעלים (מוסכם).

---

## [R43] — 2026-05-18 — צ'אט ספק↔זוג (Inbox חכם + realtime)

תקשורת מובנית בין זוג לספק: צ'אט realtime per-lead, Inbox לספק עם
הצעות תשובה מ-AI. tsc/lint(0)/build(51 ראוטים, 4 חדשים)/test(9/9)
ירוקים. ה-migration כבר רצה אצל הבעלים בנקודת הביקורת.

### נוסף
- migration `vendor_chat_messages` (RLS דו-צדדי, טריגר 20/lead/שעה, realtime).
- `/api/chat/send` (Bearer, RLS-authorized, rate-limit, SMS best-effort), `lib/useVendorChat.ts` (realtime + cleanup קפדני).
- `ChatWindow` (בועות, ✓/✓✓, realtime), `VendorChatLauncher` ב-`/vendor/[slug]` (מסתתר אם אין lead פעיל).
- `/vendors/dashboard/inbox` split-view (סיכום AI, badge, urgency 🟢/🟡/🔴) + Smart-Reply (3 הצעות AI, cache per-message), כרטיס Inbox בדשבורד.
- `/api/ai/chat-assist` (summary/tags/urgency, ספאם→נקרא) + `/api/ai/smart-replies` — fail-soft, rate-limit 50/יום.
- `ChatBell` בכותרת — מונה הודעות שלא נקראו (fail-soft, realtime).

### הערה
SMS couple→vendor נדחה: טלפון הספק ב-vendor_landings חסום ל-RLS של הזוג (היה צריך RPC = מיגרציה ידנית נוספת). vendor→couple עובד; הפיד החי + ה-badge הם ההתראה לכיוון השני. מתועד.

---

## [R42] — 2026-05-18 — דף נחיתה יוקרתי + מחירי השקה (₪99 / ₪199)

דף הבית עוצב מחדש מהיסוד כדף מכירה: hook → כאב → פתרון → mockup →
**תמחור** → סטטים → FAQ → CTA סופי. מחיר זוגות ₪399→₪99 (השקה, חד-פעמי)
בעקביות בכל מקום. tsc/lint(0)/build/test(9/9) ירוקים; `/` אומת חי. ללא
מיגרציה/env.

### תמחור
- `lib/pricing.ts` (מקור-אמת יחיד): פרימיום ₪99 + תווית/CTA השקה; חינם "50 אורחים" (היה 30, display-only) + הסרת טענת "333 ספקים" המיושנת.
- תוקנו אזכורי ₪399 קשיחים: `app/pricing` (metadata+body), `app/start/StartClient`, `app/rsvp/RsvpClient`, `app/admin/dashboard` (הקרנת הכנסה ‎*399→*99; ספקים ‎*199 נשאר). הכרטיסים ב-/pricing,/start נקראים מ-COUPLE_TIERS — מתעדכנים לבד.

### רכיבים חדשים (components/landing/)
Hero · PainSection · SolutionSection · AppShowcase (phone-mock CSS, ללא asset) · PricingSection · HonestStats · FAQ (accordion `<details>` — אפס client JS) · FinalCTA. `app/page.tsx` הפך לקומפוזיציה דקה; ~670 שורות inline (כולל הטסטימוניאלס המומצאים) נמחקו.

### סטייה מודעת
ה-spec ביקש "280+ ספקים" ב-HonestStats. R37 הסיר 332 ספקים מזויפים ואישרת מספרים כנים — אז ה-tile מציג את **המספר האמיתי הדינמי** (`{VENDORS.length}+`, כרגע "1+", גדל מאליו). שאר 3 הסטטים אמיתיים.

### עיצוב/נגישות
clamp() רספונסיבי (mobile-first), py-24/32 נדיב, orb בודד לכל section. **ללא `pulse-gold`** על כפתור ה-CTA הסופי (הוא `display:none` תחת reduced-motion — היה מסתיר את ה-CTA; R41).

---

## [R41] — 2026-05-18 — עיצוב מחדש של הדשבורד (Hero אינטימי + מסע אנכי)

הדשבורד עוצב מחדש לשתי שכבות: Hero אינטימי (שמות הזוג, תאריך, ספירה
לאחור ענקית) ומתחתיו Journey Path אנכי גרפי. tsc/lint(0)/build/test(9/9)
ירוקים. ללא מיגרציה/env.

### נוסף
- `components/dashboard/IntimateHero.tsx` — badge סוג, שמות gradient gold (clamp), תאריך עברי מלא, count-up ענק (reduced-motion-safe), מצבי היום/עבר. ללא תמונת רקע (אין שדה כזה ב-EventInfo — הענף האופציונלי ב-spec הושמט במכוון).
- `components/dashboard/JourneyPath.tsx` — נתיב אנכי: עיגול לכל שלב (✓/מספר/🔒) + קו מקשר זהוב, כרטיס עם "התקדם →"/"ייפתח אחרי …". confetti קטן (מכבד reduced-motion) במעבר milestone. סמן ה-active הוא glow סטטי ולא pulse (כי `.pulse-gold` מוסתר תחת reduced-motion).
- `TodayCard` ("מה היום?") + `StatsStrip` רצועה דקה (👥/💰/🤝/⚡, בלי מכנים מומצאים).

### הוסר/נשמר
- נמחקו הרכיבים המתים Hero/NextActionCard/StatCard/JourneyCard + imports שלא בשימוש (lint נקי).
- נשמרו LiveModeCTA / InvitationActivityCard / WelcomeBanner. `ToolsSection` **לא** נמחק (אין route ‎/menu; הסרת גישה לכלים = רגרסיה) — הועבר לתחתית תחת "כל הכלים" מוחלש.

### בדיקה
מודול /dashboard נטען נקי (redirect ל-/signup בלי auth מוכיח קומפילציה+ריצה). תצוגה מלאה דורשת host מחובר עם אירוע — ידני.

---

## [R40] — 2026-05-18 — Hotfix: יצירת short-link דרך RPC

R36 הסיר את ה-SELECT הציבורי מ-`short_links`, אז ה-dedup SELECT של
`createShortLink` החזיר null תחת RLS → כל INSERT נכשל על האינדקס הייחודי
`(event_id,long_path)` מ-R30 → היצירה תמיד החזירה null → מוזמנים קיבלו
שוב URL ארוך בלי תמונה. תוקן: `createShortLink` קורא עכשיו ל-RPC
`create_or_get_short_link` (SECURITY DEFINER) שעושה dedup+insert
אטומית בצד השרת. נתיב הכשל ללא שינוי (null → fallback ל-URL ארוך).
tsc/lint(0)/build/test(9/9) ירוקים. ה-SQL כבר רץ ב-Supabase.

---

## [R39] — 2026-05-18 — שליחה מהירה (Express Bulk Send)

כפתור "🚀 שליחה מהירה" ב-/guests פותח Modal שמטפל בכל המוזמנים
הממתינים אחד-אחרי-השני. המשתמש פותח wa.me, שולח, חוזר ל-tab → תוך
~1.5 שנ׳ ה-wa.me הבא נפתח אוטומטית. הפתיחה רוכבת על "חזרת ה-tab"
(visibilitychange) כך שחוסם הפופאפים מתייחס אליה כיוזמת-משתמש.
~200 הזמנות ב-5 דק׳. tsc/lint(0)/build/test(9/9) ירוקים. ללא מיגרציה.

### נוסף
- `hooks/useExpressSend.ts` — state machine: queue/current/completed/skipped, listener `visibilitychange` יחיד (cleanup מסודר נגד memory-leak), prebuild של ה-wa.me URL (כדי ש-window.open יישאר סינכרוני — משתמש ב-`buildHostInvitationWhatsappLink` הקיים, בלי builder חדש), שמירת state ל-localStorage + "המשך מאיפה שהפסקת?" ל-2 שעות.
- `components/guests/ExpressSendModal.tsx` — שלב 0 סינון קבוצה (חברים/משפחה/עבודה/שכנים), כרטיס מוזמן נוכחי, progress bar, צ׳יפים סטטיסטיים, overlay countdown עם ביטול, מסך סיום + confetti, mobile full-screen.
- `/guests` — כפתור "🚀 שליחה מהירה לכולם (N)" (N = ממתינים עם טלפון תקין), `STORAGE_KEYS.expressSendState`.

### הערת תכנון
ספק ביקש "status נשאר pending"; אך כפתור השליחה הבודד הקיים כבר קורא `actions.markInvited` (→ "invited" שזה סטטוס ה-awaiting-response באפליקציה). שמירה על העקביות הזו (פילטר/ספירה/resume) נבחרה במקום סטייה שהייתה משבשת ספירות ומכניסה שוב מוזמנים שכבר נשלחו ל-resume.

### בדיקה
מודול /guests נטען נקי; זרימת ה-tab-return + confetti + haptics דורשים host מחובר + מעבר אמיתי ל-WhatsApp — בדיקה ידנית במכשיר.

---

## [R36+R37 — ליטוש] — 2026-05-17 — RPC טהור ל-short_links + אתר דפוס אומן אמיתי

R36/R37/R38 כבר נפרסו וה-migrations רצו. הסבב הזה הוא ליטוש על הקיים
(ה-spec הוגש מחדש; חלק מהפריטים כבר היו, חלק היו רגרסיה אם היו מיושמים
מילולית — `type:"invitations"` אינו `VendorType` חוקי, נשאר `"printing"`):

- **`lib/shortLinks.ts`** — `lookupShortLink` הופשט ל-**RPC טהור**
  (`lookup_short_link`). ה-fallback ל-select ישיר (רשת-ביטחון לסדר
  פריסה ב-R36) הוסר — המיגרציה כבר חיה, וה-RLS חוסם את ה-select ממילא.
- **`lib/vendors.ts`** — נוסף ה**אתר האמיתי** של דפוס אומן
  (`https://www.ouman.co.il`) + תגית "נהריה". טלפון עדיין placeholder.
- **`VendorCard`** — תג 0-ביקורות יושר ל-"✨ חדש בקטלוג" (בלי ⭐).
- אומת מחדש: אף עמוד לא קורס על `VENDORS` בן פריט אחד (find/filter/length,
  אפס גישת אינדקס). tsc/lint(0)/build/test(9/9) ירוקים.

תיעוד R36/R37 המקורי קיים ב-`docs/tasklists/TASKLIST.R36.md` ו-`TASKLIST.R37.md`.

---

## [R38] — 2026-05-17 — ספק מאושר נכנס לקטלוג אוטומטית

"כל ספק שממלא טופס → מגיע אליי לאישור → ורק אז נכנס לאפליקציה."
כל צינור האישור כבר היה קיים (טופס → vendor_applications pending →
מייל אליי → /admin/vendors אישור/דחייה). החוליה החסרה: ספק מאושר מעולם
לא הופיע ב-/vendors. R38 סוגר את זה. tsc/lint(0)/build/test(9/9) ירוקים.

⚠️ **להריץ ב-Supabase:** `supabase/migrations/2026-05-17-approved-vendors-public.sql`.
עד שזה ירוץ — מאושרים לא יופיעו (הקטלוג הסטטי עדיין עובד, אומת: ללא
קריסה). הקוד בטוח לפריסה לפני המיגרציה.

### נוסף
- migration: RPC `list_approved_vendors()` (SECURITY DEFINER) שמחזיר **רק עמודות ציבוריות** (שם עסק, קטגוריה, עיר, אודות, אתר, IG/FB) — **לא** טלפון/מייל/ח.פ/IP (כדי לא ליצור דליפת PII רביעית אחרי R36). אותו דפוס כמו `lookup_short_link`.
- `lib/approvedVendors.ts` — מיפוי שורה מאושרת → `Vendor` (קטגוריה→VendorType לפי המיפוי המתועד, עיר→אזור היוריסטי, `reviews:0` → תג "ספק חדש", `phone:""` לא חושף PII).
- `app/vendors/page.tsx` — טוען מאושרים דרך ה-RPC וממזג עם הסטטי (`allVendors`). Fail-soft: RPC חסר/שגיאה → נשאר הקטלוג הסטטי (אומת חי לפני המיגרציה).
- decide route — מטביע `approved_vendor_id='app-<id>'` באישור → מנקה את אזהרת ה-admin "מאושר אך לא בקטלוג".

### זרימה (אחרי המיגרציה)
טופס → pending → מייל ל-talhemo132@gmail.com → אתה מאשר ב-/admin/vendors → הספק מופיע ב-/vendors. דחוי/ממתין לעולם לא מופיעים.

### הערות
- חובה להתחבר לאפליקציה עם `talhemo132@gmail.com` כדי לגשת ל-/admin/vendors. למיילים צריך `RESEND_API_KEY` ב-Vercel (בלעדיו הבקשה עדיין נשמרת ונראית ב-/admin/vendors).
- פתוח (R36/R37): פרטי דפוס אומן + תקנון §19.

---

## [R37] — 2026-05-17 — ניקוי ספקים: רק "דפוס אומן" האמיתי

הוסרו ~332 ספקי דמו מזויפים. הקטלוג מכיל עכשיו ספק אמיתי מאומת אחד —
**דפוס אומן** (בית דפוס, נהריה). tsc/lint(0)/build/test(9/9) ירוקים;
`/vendors` אומת חי. ללא מיגרציה.

### שינויים
- `lib/vendors.ts` — ספק יחיד. **תיקון מול ה-spec:** `"invitations"` אינו `VendorType` — נעשה שימוש ב-`"printing"` (בתי דפוס) שזה הנכון. טלפון/סושיאל = placeholders (TODO(owner) — אין לי את הפרטים האמיתיים, לא ממציא).
- `app/vendors/page.tsx` — empty-state עם CTA יוקרתי "🎯 אתה ספק? הצטרף אלינו עכשיו" → `/vendors/join` (ה-spec ציין `/vendors/welcome` שלא קיים).
- `VendorCard` — `reviews===0` → תג "ספק חדש" במקום דירוג מזויף.
- דף הבית — הוסרו ספירות מנופחות (24+/22+/100+); CategoryShowcase לקופי השקה כן; StatsCounter ל-`{VENDORS.length}` דינמי ("ספקים מאומתים / גדל מדי יום").
- `lib/aiAssistant.ts` — מקרה 0 ספקים באזור מנוסח כהזמנה ("הקטלוג בהקמה…") במקום "גישה ל-0 ספקים".
- audit: כל צרכני `VENDORS` משתמשים ב-find/filter/length — אין קריסה על מערך בן פריט אחד.

### Follow-ups לבעלים
1. טלפון/IG/FB/אתר אמיתיים של דפוס אומן → אעדכן.
2. (פתוח מ-R36) פרטי ישות משפטית לתקנון §19.

---

## [R36] — 2026-05-17 — Security hotfix: 3 דליפות RLS + 8 תיקוני ליטוש

תיקון אבטחה קריטי: `short_links` / `invitation_views` / `event_memories`
היו עם פוליסת `"anyone reads"` פתוחה — כל אנונימי יכל לקרוא קישורים,
אנליטיקת פתיחות (כולל שמות אורחים) ותמונות של **כל** האירועים.
tsc/lint(0)/build/test(9/9) ירוקים.

⚠️ **להריץ ב-Supabase:** `supabase/migrations/2026-05-17-rls-hardening.sql`.
הקוד בטוח לפריסה **בכל סדר** (`lookupShortLink` מנסה RPC ונופל חזרה
ל-select ישיר), אבל הדליפה פתוחה עד שזה ירוץ — דחוף.

### Block A — דליפות RLS
- `short_links` — בוטלה קריאה פתוחה; קריאה דרך RPC `lookup_short_link` (SECURITY DEFINER). `lib/shortLinks.ts` עם fallback עמיד.
- `invitation_views` + `event_memories` — קריאה רק לבעל האירוע / מנהלים מאושרים. טריגר rate-limit (1000/אירוע/שעה) על invitation_views.
- **תיקון מול ה-spec:** ה-host לא מותנה בקבלת המנהל (`invited_by = auth.uid()` ללא `status='accepted'`) — אחרת הזוג ננעל מהאנליטיקה של עצמו. פער שיורי מתועד (זוג בלי מנהל ב-event_managers — מעקב המשך).

### Block B — 8 תיקונים
- B1 whatIf: `Number(guests)||1` נגד `₪NaN`. B2 realCost: "תקציב אמיתי" דורש גם סכום>0. B3 aiPackages: בחירה אקראית בין חבילות שוות-ניקוד. B4 twilio: בלי fallback מספר קשיח. B5 ai/packages: ולידציה ל-priorities (מערך, ≤5, מחרוזות). B6 crisis: `.limit(50)`. B7 navLinks: Apple Maps `?daddr&dirflg=d`. B8 serverRateLimit: prune כל 60 שנ׳.

### Block C — תקנון §19
דחוי — דורש פרטי ישות משפטית אמיתיים מהמשתמש (לא ניתן להמציא). אין שינוי קוד.

---

## [R33] — 2026-05-17 — חיבור הקישור הקצר + ההודעה הפרימיום לזרם הקנוני

תיקון קריטי שמאחד את כל מה שנבנה ב-R28. הלוגיקה של הקישור הקצר +
ההודעה הפרימיום ישבה רק בתוך `useGuestWhatsappLink` מעל ההודעה הישנה
הארוכה — שני מסלולים לאותה עבודה. tsc/lint(0)/build ירוקים; ללא מיגרציה.

### איחוד
- `lib/invitation.ts` — `buildHostInvitationWhatsappLink` נכתב מחדש כבונה **הקנוני היחיד**: URL ארוך חתום → `createShortLink` (`/i/<id>`, dedup מ-R30) → `buildWhatsappInviteMessage` (הודעה פרימיום + קישור נקי שמציג כרטיס OG). Fail-soft: כשל קיצור → URL ארוך אבל עדיין הודעה פרימיום. מחזיר `rsvpUrl` = הקישור הקצר.
- הוסר `formatHebrewDate` המת + ההודעה הישנה הידנית.
- `useGuestWhatsappLink` — `buildLink` הפך ל-map דק (הוסר בלוק ה-R28 הכפול + ה-imports שלא בשימוש). מבטל יצירת קישור-קצר כפולה.
- בדיקת callers: היחיד האמיתי הוא ה-hook; כפתור "שלח הזמנה" ב-/guests צורך אותו → עכשיו שולח הודעה פרימיום קצרה.
- הותאם לחתימה האמיתית של `buildWhatsappInviteMessage` (ה-spec ביקש `eventTime` שלא קיים ב-`EventInfo`).

### Cache-bust
- כל הפניות `/og-default-1200x630.png` → `?v=2` (layout/rsvp/i) כדי לכפות re-scrape ב-WhatsApp/Facebook. אחרי deploy: Facebook Sharing Debugger → "Scrape Again".

### OG סטטית
- אומת ש-`metadataBase` + התמונה הסטטית ב-layout/rsvp/i כבר תקינים מ-R32 (ללא שינוי).

---

## [R32] — 2026-05-17 — תמונת OG סטטית כברירת-מחדל + מעקב פתיחות חי

מטרה כפולה: כל הזמנה מציגה את כרטיס המותג הסטטי; הזוג רואה בזמן אמת מי
פתח את הקישור. tsc/lint(0)/build(54 ראוטים) ירוקים; חי: `/api/invitation/view`
→ 200, עמוד RSVP נטען ושולח ping.

⚠️ **להריץ ב-Supabase:** `supabase/migrations/2026-05-17-invitation-views.sql`
(טבלת `invitation_views` + RLS open-insert/select + realtime עם guard
אידמפוטנטי). הקוד בטוח לפריסה לפני המיגרציה — עד שהטבלה קיימת ה-ping
פשוט no-op והכרטיס מציג "עדיין אין פתיחות".

### OG סטטית
- `app/layout.tsx` — `metadataBase` (og:image אבסולוטי, חובה ל-WhatsApp) + `openGraph`/`twitter` עם `/og-default-1200x630.png`. כל route יורש.
- `app/i/[token]/opengraph-image.tsx` — **נמחק** (next/og הדינמית שברירית בנתיב serverless; הסטטית מספיקה, ניתן להחזיר בעתיד עם font setup).
- `/i/[token]` + `/rsvp` — generateMetadata/metadata מצהירים מפורשות על התמונה הסטטית (page-level דורס את ה-root).

### מעקב פתיחות
- migration `invitation_views` (+2 אינדקסים, RLS, realtime guard).
- `app/api/invitation/view/route.ts` — POST, anon, תמיד 200 (כשל מעקב לא שובר RSVP).
- `RsvpClient` — ping fire-and-forget פעם אחת לטעינה (catch-all לכל מסלולי הכניסה; ה-ping מצד-שרת של `/i` לא מומש בכוונה — un-awaited fetch לפני redirect לא מובטח).
- `lib/useInvitationViews.ts` + `components/dashboard/InvitationActivityCard.tsx` — מונה מונפש, פיד 5 אחרונים (✨ מזוהה / 👤 אנונימי), realtime + toast/haptic על פתיחה חדשה. בדשבורד מעל ToolsSection, רק כשיש אורחים.

### Dedup + פרטיות
- אותו אורח תוך 10 דק׳ → לא נרשם שוב. IP נשמר רק כ-`sha256(salt:ip)`, לא raw.

---

## [R31] — 2026-05-17 — קישורי ניווט בהזמנות (Waze + Google + Apple)

לכל הזמנה ומסך — כפתור ניווט בלחיצה אחת. Waze כברירת-מחדל בישראל
(`&navigate=yes` מתחיל ניווט מיד), לצד Google/Apple Maps לבחירת המוזמן.
ללא מיגרציה / env — שינוי client/helper טהור, בטוח לפריסה לבד.
tsc/lint(0)/build/test(9/9, ‎+3 חדשים) ירוקים; כרטיס ה-RSVP אומת חי בתצוגה.

### נוסף
- `lib/navigationLinks.ts` — `buildNavigationLinks(address)` → Waze/Google/Apple + `primary`, או `null`. טהור, איזומורפי, `encodeURIComponent` (עברית/גרשיים/פסיקים/סוגריים בטוחים).
- הודעת WhatsApp: שורת `🚗 ניווט ב-Waze: …` בשורה נפרדת (כדי ש-WhatsApp יזהה כקישור).
- עמוד RSVP: כרטיס "איך מגיעים?" עם 3 כפתורים (Waze/Google/Apple); מוסתר כשאין venue.
- דשבורד (לינק "פתח ב-Waze"), יום-אירוע + LiveMode (כפתור "ניווט לאולם"), דשבורד-מנהל (אייקון Waze בכותרת הדביקה).
- `tests/navigationLinks.test.ts` — 3 בדיקות (קידוד, פסיק/סוגריים, null → הסתרה).

### הערות
- כתובת הניווט = `synagogue · city` הקיים (כפי שכבר מוצג ב-📍 ובדשבורד).
- כפתור Apple Maps מוצג לכולם — בישראל רוב משתמשי Apple Maps ב-iPhone; ללא UA-sniffing, בלי כפתור שבור.

---

## [R30] — 2026-05-18 — סריקת באגים: הקשחת אבטחה ותיקוני נכונות

3 סוכני סקירה עברו על R18–R29. 46 ראוטים, tsc/lint(0)/build/test ירוקים.

⚠️ **להריץ ב-Supabase:** `supabase/migrations/2026-05-18-r30-hardening.sql`
(dedupe ל-short_links + אינדקס ייחודי + טריגרי הגבלת-קצב + תקרת גודל/MIME
ל-bucket התמונות). הקוד בטוח לפריסה לפני המיגרציה — היא הערובה הקשיחה לתקרות.

### אבטחה
- **P0 Open-redirect** ב-`/i/[token]`: `redirect()` השתמש בערך DB ניתן-להשפעה (INSERT פתוח) → עכשיו whitelist קשיח לנתיב `/rsvp?` בלבד.
- **/api/manager/invite** היה SMS לא-מאומת לחלוטין (הצפת עלויות Twilio/פישינג) → דורש session + הגבלת-קצב; שני ה-callers שולחים טוקן.
- **/api/crisis/broadcast** — אימות `getUser()` אמיתי + הגבלת-קצב (היה בדיקת-מחרוזת בלבד).
- **/api/ai/packages** — Map דולף הוחלף ב-`lib/serverRateLimit.ts` משותף שמתנקה.
- `createShortLink` — dedupe (select-לפני-insert) נגד ניפוח שורות.

### נכונות
- realCostPerGuest: חיסכון שלילי → `Math.max(0,…)`.
- תקציב: `₪NaN` על פריטים ישנים → `?? 0`. confirmedHeads: `attendingCount ?? 1`.
- AlcoholCalculator: `needByCategory` NaN → coercion. AiPackages: ערכי-ברירת-מחדל תקועים אחרי hydration → re-sync חד-פעמי.
- LiveModeView: מרוץ realtime (haptic/קול שווא) → guard.
- prompt ה-Wrapped: דגל localStorage נכתב מוקדם מדי → עכשיו ב-dismiss.
- AlertToast: טיימר 8 שנ׳ התאפס בכל render → ref יציב.
- מיגרציית event-memories: שורת realtime לא-אידמפוטנטית → guard.

---

## [R29] — 2026-05-17 — Hotfix: עמידות /i/[token] לשורת short_links חסרה

תיקון: כשל Supabase / שורה חסרה גרם לדף קריסה גנרי במקום מסך "ההזמנה פגה תוקף".
עכשיו `generateMetadata` (עם `.catch`), `lookupShortLink`, `createShortLink`
ו-`lookupEventByToken` עטופים כולם ב-try/catch — אפס שגיאות יוצאות מנתיב
ה-OG/שרת, וזרם ההזמנה נופל בחן לקישור הארוך. ללא שינוי סכימה/התנהגות בנתיב התקין.
**תוספת 🅕:** טעינת פונטי ה-OG (`assets/Heebo-*.ttf`) עטופה ב-try/catch —
כשל קריאה מחזיר תמונה ללא פונט מותאם במקום 500; ונוסף
`outputFileTracingIncludes` ב-next.config כדי שה-TTF ייכללו בפועל ב-bundle של
פונקציית ה-OG ב-Vercel (כך שעברית תרונדר). tsc + lint (0 errors) + build (46) ירוקים.

---

## [R28] — 2026-05-17 — הזמנת WhatsApp יוקרתית (OG image + קישור מקוצר)

כל קישור הזמנה מציג עכשיו תצוגה מקדימה יוקרתית ב-WhatsApp במקום URL ארוך ומכוער. 46 ראוטים, כל הבדיקות ירוקות.

### ⚠️ דרושה הרצת מיגרציה לפני deploy
`supabase/migrations/2026-05-17-short-links.sql` (טבלת `short_links`). בלי זה — נפילה חיננית לקישור המלא (כלום לא נשבר).

### תמונת OG דינמית
`/i/[token]/opengraph-image` — כרטיס הזמנה זהוב (לוגו, סוג אירוע, שמות המארחים ענקיים, תאריך, מקום, CTA), עם פונט עברי (Heebo) מוטמע. fallback מעוצב אם הקישור לא נמצא. Cache 24ש׳ ב-CDN.

### קישור מקוצר
`/i/<6 תווים>` (base56, ~30 מיליארד צירופים) → redirect שרת ל-`/rsvp` האמיתי. נתוני האירוע נשלפים מה-payload המוטמע בקישור עצמו (אין צורך בטבלת events — עובד server-side).

### הודעת WhatsApp מלוטשת
מסר עברי נקי עם אימוג'י לפי סוג אירוע + הקישור הקצר בלבד. משולב בזרם השליחה הקיים עם **fallback מלא** לכל כשל.

### תיעוד
README — איך לרענן את ה-preview cache של WhatsApp (FB Sharing Debugger).

3 סטיות מתועדות ב-`docs/tasklists/TASKLIST.R28.md`.

---

## [R27] — 2026-05-17 — Momentum Live שלב 3: מצב חי + חירום + סיכום Wrapped

סוגר את הטריו של Momentum Live. 46 ראוטים, tsc/lint/build ירוקים.

> ⚠️ **לפני deploy** — חובה להריץ ב-Supabase את `supabase/migrations/2026-05-17-event-memories.sql` (טבלת `event_memories` + bucket `event-memories`). בלי זה ה-Memory Album לא יעבוד. **טרם פרוס — ממתין לאישור שהמיגרציה רצה.**

### מצב חי (יום האירוע)
ביום האירוע `/event-day` עובר אוטומטית ל-`LiveModeView` של הזוג: 3 בועות בזמן אמת (הגיעו/אחוז/נותרו) דרך Supabase Realtime (כל צ׳ק-אין → רטט + צליל), כרטיס נוכחות מנהל, פיד פעילות אחרון, פעולות מהירות.

### מצב חירום
חדר בקרה אמיתי ב-`/manage/[eventId]/crisis`: זיהוי קריזות אוטומטי (`lib/crisis.ts` — ספק מאחר / הגעה נמוכה / מקדמה לא מאושרת), כרטיסים עם טיימר "פעיל כבר", כפתורי התקשר/SMS/שידור, `/api/crisis/broadcast` ששולח SMS לכל המנהלים. דחוף אך לא מבהיל.

### סיכום "Wrapped" (רגע השיא)
`/manage/[eventId]/report` הפך ל-מצגת מסך-מלא שמתקדמת אוטומטית (8 שקופיות, פסי התקדמות, tap להחלפה): כתר מסתובב → שעות → אורחים → ריקודים → ספקים → מעטפות → רגעים → תודה + **שיתוף** (קנבס 1080×1920 → Web Share / PNG) + קונפטי. `lib/reportGenerator.ts` חדש. מודאל "הסיכום מוכן!" 24 שעות אחרי האירוע (פעם אחת).

### Memory Album
מיגרציה חדשה מפעילה את מסך ההעלאה (`?mode=upload`, דחיסת תמונה בצד-לקוח) והפיד החי בקיוסק (Realtime) שכבר קיימים בקוד.

5 הערות/סטיות מתועדות ב-`docs/tasklists/TASKLIST.R27.md`.

---

## [R26] — 2026-05-17 — Momentum Live שלב 2: ליטוש חוויית המנהל

עיצוב מחדש של כל מסך שהמנהל רואה — אנימציות, haptic, צליל, קצב יוקרתי. **בלי פיצ'רים חדשים.** 45 ראוטים, כל הבדיקות + 6/6 טסטים ירוקים. כל אנימציה מכבדת `prefers-reduced-motion`, transform/opacity בלבד.

### דף האישור (Accept) — Reveal קולנועי
רקע זהוב עמוק + 3 כדורי זוהר זעירים, כתר 64px שנופל ומסתובב לאט לנצח, רצף הופעה מדורג ("היי {שם} 👋" 56px), כפתור פועם. אחרי אישור: קונפטי זהב, רטט, צליל, "🎉 ברוך הבא לצוות הניהול", הפניה אחרי 1.5 שנ׳.

### דשבורד המנהל
3 "בועות" סטטיסטיקה יוקרתיות עם count-up (הגיעו / אחוז עם טבעת התקדמות / נותרו) + כפתור QR ענק (64px). התראות ה-AI Co-Pilot עכשיו טוסטים שמחליקים מלמעלה, מעוצבים לפי חומרה, החלקה ימינה לסגירה, נעלמים אוטומטית (קריטי נשאר ופועם).

### מסך הצ׳ק-אין
מסגרת סורק עם פינות ציאן וקו-סריקה נע, מונה עם count-up, משוב הצלחה/כשל (רטט + צליל + הבזק ירוק/אדום + טוסט יוקרתי).

### תשתית
`lib/haptic.ts` (רטט עדין), `lib/managerSounds.ts` (צלילים מסונתזים, אופציונלי + מתג בהגדרות), `StatBubble` / `AlertToast` / `ActionSheet` / `Confetti` חדשים.

5 סטיות מתועדות ב-`docs/tasklists/TASKLIST.R26.md` (נתוני RPC לאישור, אין סורק מצלמה אמיתי, צלילים מסונתזים, קונפטי CSS, ActionSheet מוכן לאימוץ).

---

## [R25] — 2026-05-16 — Momentum Live שלב 1: נראות + הזמנה דו-ערוצית

> הספק ביקש "R23" אך ערך R23 כבר תפוס (המחשבונים). נרשם כ-R25. 45 ראוטים, כל הבדיקות ירוקות + 6/6 טסטים.

### נראות
- **בר ניווט תחתון** — הפריט האחרון הוחלף ל-"מצב חי" → /event-day (הגדרות נשארו בתפריט הכותרת).
- **ניווט עליון** — "מצב חי" מופיע אוטומטית כשנותרו ≤21 ימים לאירוע.
- **דשבורד** — כרטיס CTA זוהר חדש (`LiveModeCTA`) כשנותרו ≤14 ימים: "האירוע שלך עוד N ימים. הפעל את Momentum Live".
- **דף יום-האירוע** — באנר ב-3 מצבים: אין מנהל / ממתין לאישור (📤 שלח שוב · ↻ החלף מנהל) / אושר (✅ + קישור לדשבורד הניהולי).

### הזמנה דו-ערוצית (WhatsApp + SMS)
- `buildInviteText` חולץ כמקור-אמת אחד למסר.
- `lib/twilioClient.ts` (server-only) — שליחת SMS דרך Twilio, נופל בחן בלי קרדנציאלס.
- `app/api/manager/invite` — שולח SMS עם אותו מסר, **תמיד מחזיר 200** ו-`waUrl`, כך ש-WhatsApp אף פעם לא נחסם.
- מסך הסיום מציג סטטוס לשני הערוצים.

### בדיקות + תיעוד
- הותקן Vitest + `npm run test`; `tests/managerInvitation.test.ts` (6 מקרים).
- README — סעיף הגדרת Momentum Live (`NEXT_PUBLIC_SITE_URL` חובה, Twilio אופציונלי, 2 מיגרציות).

**Phase 1 בלבד** — לא נגענו ב-/manage/[eventId], Crisis Mode או Auto-Report (Phase 2/3).

---

## [R24] — 2026-05-16 — בקבוקים לפי חברה + העמקת 3 המחשבונים הנותרים

44 ראוטים, כל הבדיקות ירוקות.

### מחשבון אלכוהול — בחירה לפי חברה (התיקון שביקשת)
- ~45 בקבוקים אמיתיים מהשוק בארץ עם **מותג**: יין (ברקן/כרמל/רקנאטי/ירדן/תבור), בירה (גולדסטאר/מכבי/טובורג/קרלסברג/Heineken כולל חביות), אלכוהול חזק (Smirnoff/Absolut/Grey Goose/Johnnie Walker/Chivas/Jameson/Jack/Gordon's/Bombay/Olmeca), קל (קוקה-קולה/פפסי/ספרייט/פריגת/שוופס/נביעות).
- הבורר מוצג **מקובץ לפי חברה**, הכותרת עודכנה והסעיף **נפתח כברירת מחדל** כדי שיהיה גלוי.

### העמקת 3 המחשבונים
- **💎 כמה אורח עולה** — "מה אם יהיו __ מוזמנים?" שמחשב מחדש מחיר לאורח בזמן אמת.
- **🤖 3 הצעות AI** — בחבילה שנבחרה אפשר לערוך כל קטגוריה ידנית; סכום ומחיר לאורח מתעדכנים חי.
- **💌 מעטפה** — פאנל "בדיקת תרחיש": שינוי עלות אירוע / מספר מוזמנים והמלצה מתחשבת — בלי לגעת בתקציב האמיתי.

---

## [R23] — 2026-05-16 — העמקת מחשבון אלכוהול + "מעבדת התקציב"

העמקה ב-2 המחשבונים הראשונים (השאר בסבבים הבאים). 44 ראוטים, כל הבדיקות ירוקות.

### מחשבון אלכוהול — בחירת בקבוקים ספציפית
- קטלוג מוכן של 18 בקבוקים נפוצים בארץ (יין/בירה/אלכוהול חזק/קל) עם מחיר משוער.
- סעיף "🍾 בחירת בקבוקים ספציפית": לכל קטגוריה — פס כיסוי (כמה מנות סופקו מול הצורך, ירוק כשמכוסה), בחירה מהקטלוג, "בקבוק משלי", ו**עריכה ידנית של שם / מחיר / מנות / כמות** לכל שורה.
- מתג "השתמש בבחירה הספציפית לחישוב העלות" — סך העלות מתעדכן לפי הבקבוקים שבחרת.
- הבחירה נשמרת אוטומטית.

### What If Simulator → **מעבדת התקציב**
- שונה השם בכל מקום (טאב + כותרת). קישורי deep-link הקיימים ממשיכים לעבוד.
- 3 בקרות חדשות: עיצוב ופרחים (בסיסי/סטנדרטי/מפואר), הזמנות (דיגיטלי/מודפס/יוקרה), ותוספות צילום (אלבום/רחפן/מגנטים/Same-Day) — כל אחת עם הסבר השפעה.

---

## [R22] — 2026-05-16 — ארגון מחשבונים מחדש + מחשבון AI

ה-4 מחשבונים פוצלו ל-**5 טאבים נפרדים** + נוסף מחשבון חמישי חדש. 44 ראוטים, כל הבדיקות ירוקות.

### חדש
- **🤖 3 הצעות מחיר AI** — אותו תקציב, 3 חבילות שונות לפי 3 עדיפויות שתבחר. כל חבילה: מחיר לאורח, ✓מקבל / ✗מתפשר, מד-וייב, כפתור בחירה. עובד עם OpenAI כשמוגדר, אחרת fallback חכם דטרמיניסטי. נקודת קצה `/api/ai/packages` (Bearer, 503 ללא מפתח, 5/יום).

### ארגון מחדש
- ה-Hub נכתב מחדש לניווט **טאבים** — pills יוקרתיים עם scroll-snap במובייל, glow זהב לפעיל, מעבר fade, שמירת מיקום ב-URL hash + localStorage, נגישות מלאה (role=tab, ניווט בחיצים).
- כל מחשבון בעטיפת עיצוב אחידה (`CalculatorCard` חדש): כותרת + רקע זהב + טיפ 💡.
- מחשבון אלכוהול חולץ לקומפוננטה `<AlcoholCalculator/>` (עמוד /alcohol הפך ל-wrapper, deep link עדיין עובד).
- מחשבון מעטפה + פילוח קרבה חולצו ל-`<EnvelopeCalculator/>`.

### ניקוי
- הוסרו ~385 שורות קוד כפול מ-`budget/page.tsx` (Envelope/Scenario/Relationship), imports ואייקונים לא בשימוש. אין יותר לוגיקה כפולה.

### הערות
- 3 סטיות מכוונות מהספק מתועדות ב-`docs/tasklists/TASKLIST.R22.md` (עטיפת CalculatorCard, rate-limit in-memory, יחידות ₪).

---

## [R21] — 2026-05-16 — מרכז מחשבונים חכמים

טאב **🧮 מחשבונים חכמים** חדש ב-`/budget` שמאחד 4 מחשבונים בעיצוב יוקרתי.
כל הבדיקות ירוקות (`tsc` / `lint` / `build`, 43 ראוטים).

### מחשבונים חדשים
- **💎 כמה אורח באמת עולה לי?** — פירוק עלות ל-7 קטגוריות, מספר ענק עם count-up, פסים אופקיים עם popover, אינסייטים חכמים (חריגות אוכל/אלכוהול/צילום), כפתור שיתוף ל-WhatsApp. משתמש בתקציב האמיתי אם יש ≥3 שורות, אחרת בממוצעים בארץ (4 דרגות).
- **🎚️ What If Simulator** — סליידר מוזמנים (50–400) + 4 קבוצות בחירה (אולם/מנות/בר/צלם), חישוב חי, פלאש זהב/אדום על שינוי, "החיסכון שלך שווה ל:" עם שקילויות, שמירת סימולציה ואיפוס. תמחור אולם **לא-לינארי**.

### איחוד
- מחשבון האלכוהול והמעטפה הקיימים נארזו באותו hub (כרטיס קישור / סיכום חי).
- ליד כל מחשבון — טיפ קצר חכם 💡.

### עיצוב
- סליידר זהב עם thumb זוהר ויעד-מגע 44px, מספרי-ענק `gradient-gold`, רקעי זהב רכים, ריספונסיבי (1 טור במובייל → 2×2 בדסקטופ).

### הערות
- הלוגיקה הותאמה למבנה הנתונים האמיתי (`budget: BudgetItem[]`, לא `budget.total`). פירוט מלא ב-`docs/tasklists/TASKLIST.R21.md`.

---

## [R20] — 2026-05-16 — שיפורי ביצועים שלב 1 (ללא שינוי ויזואלי)

**אופטימיזציות פנימיות בלבד — אפס שינוי בעיצוב, blur, orbs או אנימציות.**
כל הבדיקות ירוקות (`tsc` / `lint` / `build`, 43 ראוטים).

### תמונות → next/image
- `next.config.ts` — נוסף `remotePatterns` ל-`images.unsplash.com` (היקף מצומצם, לא פרוקסי פתוח).
- הומרו ל-`next/image` כל התמונות מבוססות-Unsplash: כרטיס ספק, גלריית ההשראה (8, עם `priority` ל-2 הראשונות), עמוד ההשוואה, ו-VendorQuickLook (×2). תיראה זהה — נטענת חכם (srcset/WebP/lazy).
- תמונות שהושארו ב-`<img>` במכוון: העלאות משתמש (Supabase storage / דומיינים לא-מנוהלים), ו-`data:`/`blob:` — המרה הייתה שוברת אותן או דורשת פרוקסי פתוח. מתועד ב-`docs/tasklists/TASKLIST.R20.md`.

### עמוד ספקים — O(1) במקום O(n)
- `selectedIds` / `compareIds` כ-`Set` ממואיזד; הכרטיסים משתמשים ב-`.has()` במקום `Array.includes()` לכל כרטיס בכל רינדור.

### ScrollProgress — בלי setState בכל frame
- הוחלף `useState` ב-`ref`; ה-transform נכתב ישירות ל-DOM בתוך ה-rAF. אפס רינדורים מחדש בזמן גלילה. הוויזואל זהה.

---

## [R18] — 2026-05-16 — ליטוש חוויית משתמש (Phone OTP, Empty states, Wizards, Polish)

**19 תיקונים על פני 4 בלוקים.** כל בלוק עבר `tsc --noEmit`, `npm run lint`, `npm run build` בנפרד (43 ראוטים).

### הרשמה ו-Onboarding
- **קוד OTP בטלפון** — כפתור "שלח שוב" עם ספירה לאחור של 30 שניות, זהה לזרימת המייל.
- **הסכמה לתנאים** — לחיצה על כפתור התחברות לפני סימון התיבה מפעילה פעימת-תשומת-לב (3×600ms) על תיבת ההסכמה; הכפתורים מעומעמים עד לסימון.
- **טלפון מארח** — מילוי אוטומטי גם בהרשמת Google/מייל (מ-Supabase); שדה חובה עם הסבר "ללא טלפון אורחים לא יוכלו לאשר הגעה".
- **בחירת תאריך** — לא מתאפסת תוך כדי הקלדה; נוסף בורר תאריך native כאופציה ראשית + "או הקלד ידנית".
- **הזמנה קבוצתית** — מעבר אוטומטי למוזמן הבא לאחר חזרה מ-WhatsApp (ניתן לכיבוי).

### Empty states + הצטרפות ספקים
- **רשימת מוזמנים ריקה** — כפתור ראשי "ייבא מאנשי קשר", עם fallback להדבקת רשימה בדפדפנים ללא Contacts API.
- **הצטרפות ספק** — אשף 3 שלבים עם פס התקדמות במקום טופס 13 שדות.
- **כרטיס ספק** — pill בולט "הוסף לרשימה שלי" עד שמירת הספק הראשון.

### עקביות UX
- **דשבורד ספק חדש** — באנר ייעודי עם קישור להעתקה + QR + טיפ, כשעדיין אין תנועה.
- **Toast** — הורם כדי לא לשבת על ה-bottom nav במובייל.
- **רשימת מוזמנים** — וירטואליזציה (`@tanstack/react-virtual`) מעל 80 מוזמנים.
- **רכיבי קלט משותפים** — `MoneyInput` (₪) ו-`PhoneInput` (+972).
- **שגיאות הרשמה** — הודעת fallback אחידה + לוג `[momentum/signup]`.
- **`formatEventDate`** — helper מרכזי לתאריכים (`lib/format.ts`).

### ליטוש
- כפתור "מתחבר..." עם טקסט מפורש.
- כפתורי סגירה אחידים (44×44) בכל המודלים + רכיב `Modal` משותף.
- חימום מוקדם של קישורי WhatsApp; הכפתור disabled עד שהקישור מוכן.
- שדרוג מסלול דרך מודל (`UpgradePlanModal`) במקום ניווט.
- **הוכחה חברתית כנה** — הוסרו מספרים מומצאים ("4,872 אירועים", "4.9★ מ-2,341 ביקורות"); הוצגו רק נתונים אמיתיים/מסומנים כמשוערים.

### הערות
- Commit יחיד (לבקשת המשתמש), אך אומת בלוק-בלוק.
- `<QrCanvas>` / `<Modal>` נוצרו מאפס (לא היו קיימים).
- §L/§N — רכיבים/helper נוצרו וחוברו לנקודות מייצגות; החלפה גורפת נדחתה מכוונת כדי לא לגרום לרגרסיית פורמט (מתועד ב-`docs/tasklists/TASKLIST.R18.md`).

---

## [R12] — 2026-05-13 — security + bugs + UX

**26 fixes across 4 priority blocks.** All blocks green on `tsc --noEmit`, `npm run lint`, `npm run build`.

### Security (P0)
- **JSON-LD XSS** — new `lib/jsonLdSafe.ts` escapes `<`/`>`/`&`/`'` before injecting into the public vendor landing's `<script type="application/ld+json">`. Vendor-controlled names can no longer break out of the script tag.
- **Vendor review RLS** — `vendor_review_responses` insert/update now require the responder to own the vendor (`vendor_landings.owner_user_id`).
- **vendor_cost_reports** — requires auth + dedupes per (user, category, region, guest-band); pollution attack capped at 1 row per bucket.
- **Page-view analytics** — SELECT closed to vendor owner only; INSERT rate-limited via a trigger (50/vendor/hour).
- **vendor_reviews** — INSERT must target a real published landing.
- **API error leakage** — `/api/admin/stats`, `/api/cfo/extract`, and `/auth/callback` no longer leak Postgres/Supabase message text; everything goes to console.
- **/api/cfo/extract hardening** — 5 MB image cap, MIME prefix gate, 20/day quota.
- **CSP** — moved to `middleware.ts` with per-request nonce + `'strict-dynamic'`; `script-src 'unsafe-inline'` removed. `connect-src` pinned to the specific Supabase project.

### P0 bugs
- **Admin dashboard** — no more infinite spinner; full load wrapped in try/catch/finally with AbortController.
- **ShareEventCard** — Object-URL leak fixed via a stable Set ref.
- **theme.ts** — DOM mutation moved out of render into `useEffect`.
- **Transparency tab** — hidden behind a flag until the post-event reporting form ships.

### P1 bugs
- OAuth probe no longer flickers buttons disabled on transient probe failures.
- useEffect deps narrowed in 3 places (event-day, ShareEventCard, onboarding).
- AssistantWidget pops the orphan user message when closed mid-thinking.
- parseFloat/parseInt clamps + comma-stripping in three forms.
- Auth callback has a 12-second hard timeout.
- 6 ad-hoc localStorage keys centralized into `STORAGE_KEYS`; separator unified to `.`.
- Slug fallback in vendor-studio uses `crypto.randomUUID().slice(0,6)`.
- `tel:` links normalized via `normalizeIsraeliPhone` in `VendorLandingClient`.

### UX
- Global `padding-bottom` on `body` clears the mobile bottom nav (pages no longer need `pb-24`).
- Header buttons hit the WCAG 44×44 touch-target floor.
- Admin dashboard "no activity" uses the shared `<EmptyState />` instead of bare text.
- Signup confirmation screen now has a **"שלח שוב"** button with cooldown.
- Submit + resend buttons show their spinner inline (no layout jump).

### Manual Supabase step required before deploy
Run `supabase/migrations/2026-05-13-vendor-review-fixes.sql` in the Supabase SQL Editor.

---

## [Unreleased] — מאי 2026 (pre-launch)

### Added
- **AI Invitations (Premium)** — עיצוב הזמנות ברקע AI (Replicate Flux Schnell) + טקסט עברי ב-Canvas, עם quota של 20/חודש
- **Vendor Onboarding Phase 0** — `/vendors/join` להגשת בקשות, `/admin/vendors` לאישור
- **3 מסלולי ספקים** — חינם / רגיל (199₪) / פרימיום (499₪)
- **Dual-entry flow** — `/start` עם בחירה בין "מתכנן אירוע" ל"ספק"
- **`/vendors/welcome`** — מסך 3 מסלולי תמחור לספקים
- **`/vendors/my`** — CRM אישי לספקים (מחיר סוכם, מקדמה, פגישה, סטטוס, דירוג, הערות)
- **מחשבון אלכוהול** (`/alcohol`) — חישוב כמויות יין/בירה/חזק/מים/קרח לפי קהל
- **`lib/origin.ts`** — single source of truth ל-public origin
- **`lib/phone.ts`** — Israeli phone normalization מאוחד
- **`lib/vendorApplication.ts` + `lib/vendorNotifications.ts`** — תשתית ספקים
- **`scripts/tunnel-and-dev.sh`** — `npm run dev:public` עם cloudflared tunnel + auto-update env
- **Email + WhatsApp notifications** ל-admin (Resend + CallMeBot, optional)
- **`components/Footer.tsx`** — footer חדש
- **`components/PricingTiers.tsx` + `VendorPricingTiers.tsx`** — רכיבים משותפים

### Changed
- **`/vendors/page.tsx`** — כפתור Heart הוחלף ב-"+ הוסף לרשימה שלי" מפורש
- **PROJECT_OVERVIEW.md** — עודכן מקצה לקצה (8/5 → 10/5)
- **00-קרא-אותי-קודם.md** (Desktop) — עדכון סטטוס + פיצ'רים חדשים
- **lib/user.ts** — משתמש ב-`tryGetPublicOrigin()` במקום `window.location.origin`
- **`/start`** — שונה מ-pricing gate ל-מסך בחירה דו-מסלולי

### Deprecated
- **`lib/israeliCalendar.ts`** — DISABLED 10/5/2026. שמור כ-stubs נטרליים. להחזיר: `git restore` מהיסטוריה.

### Removed
- **`.env.local.example`** — נמחק (כפילות של `.env.example`)
- **`lib/israeliCalendar.ts`** functionality — הקובץ נשאר אבל הפונקציות מחזירות defaults

### Fixed (R6 — 10/5)
- **P0**: redirect loop ב-`/onboarding` כשלמשתמש כבר יש אירוע
- **P1**: `/auth/callback` מדלג על `/start` ויוצר loop
- **P1**: `/start` כפתורי tier כולם מובילים לאותו URL
- **P1**: `mailto:` link שבור ב-PricingTiers
- **P1**: `Footer` `hover:text-white` שובר light mode
- **P1**: `/start` חסר Footer (עקביות)
- **P1**: אישור ספק לא מוסיף לקטלוג (TODO documented)

### Fixed (R5 — 10/5)
- **P0**: RLS חסר על `admin_emails` — כל ה-admin flow היה שבור
- **P0**: `...body` spread ב-vendor apply — ספק יכל לאשר את עצמו
- **P0**: Category enum bypass
- **P0**: RLS ב-`vendor_applications` לא חוסם status מנופח
- **P1**: Phone normalization חסר ב-vendor apply
- **P1**: XSS דרך `javascript:` URLs
- **P1**: NaN עובר את validation של years_in_field
- **P1**: Double-decide race ב-admin
- **P1**: `lib/user.ts` לא השתמש ב-origin.ts
- **P1**: event-day QR מציג path יחסי כש-origin ריק
- **P1**: Notification timeout missing

### Fixed (R4 — 10/5)
- **P0**: `sync.ts` overwrites local edits on login (data loss)
- **P0**: `inbox/page.tsx` useEffect double-import via stale closure
- **P0**: `store.ts` race ב-`mintSigningKeyAtomic` מרובה-טאבים
- **P0**: `eventSlots.ts` BroadcastChannel cross-slot override
- **P0**: `settings/page.tsx` `Notification.requestPermission` תקיעה ב-iOS PWA
- **P0**: `live/[eventId]` CountdownOrLive לא מתעדכן מ-hidden tab
- **P0**: `rsvp/RsvpClient.tsx` respond double-submit
- **P1**: `phone.ts` `+9720...` מייצר 13 ספרות שבורות
- **P1**: `user.ts` שימוש ב-`normalizeIsraeliPhone` במקום inline
- **P1**: Bulk Invite double-tap ב-iOS
- **P1**: vendors page Quick Look effect loop
- **P1**: 4 מודלים ללא Esc-to-close
- **P1**: Find My Table double-submit + case-sensitive

### Fixed (R3 — 9/5, אבטחה)
- 20 פרצות (5 P0, 9 P1, 6 הקשחה) — CSP, HMAC validation, RLS
- 24 באגים תפקודיים — תזכורות בשבת, WhatsApp link, /guests stuck, smart arrangement delay

### Security
- **CSP החדש** מתיר `replicate.delivery` ו-`*.supabase.co` ל-images
- **HMAC tokens** במקום payload-in-URL — לא חושף PII
- **AES-GCM IV** אקראי לכל envelope (no reuse)

---

## [Initial development] — אפריל-מאי 2026

### Added (R1+R2 setup)
- מבנה Next.js 16 + React 19 + TypeScript strict
- Tailwind v4 + design tokens
- Supabase auth + RLS + schema
- 17 מסכים ראשוניים (onboarding, dashboard, guests, RSVP, seating, vendors, etc.)
- Multi-event "slots" — תכנון של כמה אירועים במקביל
- BroadcastChannel sync בין tabs
- Web Crypto (HMAC, AES-GCM, HKDF)
- Israeli halachic calendar (לפני ביטול)
- Hebrew RTL native support
- 9 security headers
- GitHub Actions CI (lint + tsc + audit + build)
- 284 ספקים בקטלוג סטטי

### Fixed (R1+R2)
- 30+ באגים בסבבים הראשוניים (set-state-in-effect, popup blocker, STORAGE_KEYS, escape/unescape, memory leak ב-sync, etc.)

---

## Migration Notes

### לעבור מ-`window.location.origin` ל-`getPublicOrigin()`
היה: `const origin = typeof window !== "undefined" ? window.location.origin : "";`
עכשיו: `const origin = tryGetPublicOrigin();`

→ דורש `NEXT_PUBLIC_SITE_URL` ב-`.env.local` בכדי שיעבוד ב-SSR.

### להחזיר Israeli Calendar
```bash
git log --oneline lib/israeliCalendar.ts
git restore --source=<commit_hash> lib/israeliCalendar.ts
```

### Migration ל-`savedVendorIds[]` → `savedVendors[]`
אם state ישן יש לו `savedVendorIds: string[]`, הוא יומר אוטומטית ל-`savedVendors: SavedVendor[]` עם `status: "lead"` לכל אחד (migration ב-`lib/store.ts`).
