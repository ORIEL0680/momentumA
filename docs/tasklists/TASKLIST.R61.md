# TASKLIST · R61 — R51-תוספת: WelcomeTour hardening + reset-from-settings

> תוספת ל-R60 (שמימש את R51). 3 דרישות חדשות:
>  1. כפתור "סיום ההדרכה" בכל שלב (היה "דלג" — שונה הטקסט + יש toast).
>  2. עיגון "לעולם לא שוב" עם safety net על unmount.
>  3. אפשרות להפעיל מחדש מההגדרות.

**Date:** 2026-05-20 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 75/75 · אין migration · אין dep חדש.

## Done

### דרישה 1 — "סיום ההדרכה" + "סיימתי"

- `components/onboarding/WelcomeTour.tsx`:
  - `"דלג"` → **`"סיום ההדרכה"`** (אותו underlined-text משני, רק טקסט אחר).
  - הכפתור הראשי בצעד האחרון: `"סיים"` → **`"סיימתי"`**.
  - aria-label של ה-X בפינה: `"דלג על הסיור"` → `"סיום ההדרכה"`.
  - לחיצה על "סיום ההדרכה" / X / Esc → toast `"אפשר תמיד לחזור לסיור מההגדרות"` (info), **בלי confetti** (זה דילוג מודע, לא חגיגה).
  - לחיצה על "סיימתי" (צעד 5) → confetti + toast הצלחה כקודם.

### דרישה 2 — מעולם לא שוב (3 עוגנים)

- **(א) close-on-unmount safety net** — `useEffect(() => { return () => { if (startedRef && !completedRef) forceMarkTourCompletedSync(); }, [])` ב-WelcomeTour. אם המשתמש סוגר את הטאב / refresh / מנווט באמצע הסיור, הflag נכתב סינכרונית ל-localStorage לפני הunmount. Idempotent.
- **(ב) Optimistic + persisted** — כבר היה כך מ-R60: `useFirstLogin` מבוסס על localStorage עם `useSyncExternalStore`. הקריאה סינכרונית, אין flash, אין roundtrip. ה-spec המקורי הניח Supabase + localStorage cache; אצלנו localStorage הוא ה-source-of-truth (אין `user_profiles.onboarding_completed`).
- **(ג) Race-condition protection** — אין race: `useSyncExternalStore` מחזיר את הערך הסופי כבר ברנדור הראשון של הלקוח. ה-server snapshot מחזיר `completed=true` כך ש-SSR לעולם לא מציג modal. `if (loading) return null` של ה-spec לא רלוונטי — אין שלב טעינה. ברנדור הראשון: או isFirstLogin=true (modal מוצג מיד) או false (לעולם לא מוצג).

נוסף `FADE_MS = 200` עם binding על `opacity` ו-`pointerEvents` של ה-overlay → fade-out חלק לפני unmount. `completedRef` נקבע *לפני* setTimeout שכותב את הflag, כך שcleanup בזמן race לא כותב פעמיים (גם זה idempotent, אבל קוד נקי).

### דרישה 3 — הפעלה מחדש מההגדרות

- `lib/useFirstLogin.ts` — נחשף:
  - `TOUR_COMPLETED_KEY` (constant)
  - `forceMarkTourCompletedSync()` — כתיבה סינכרונית, idempotent, בטוחה ל-unmount cleanup
  - `resetTour()` — מסירה את ה-flag + מודיעה ל-listeners באותו טאב
- `app/settings/page.tsx` — נוסף `<Section icon={<HelpCircle/>} title="עזרה והדרכה">` מעל סקציית "פרטיות ונתונים". כפתור `"הפעל מחדש"` (`<RefreshCw size={14}/>`) קורא `resetTour()`, מציג toast `"הסיור יקפוץ עוד רגע…"`, ועושה `router.push("/dashboard")` — הסיור קופץ אוטומטית כי `useSyncExternalStore` מעורר re-render ב-WelcomeTour.

## סטיות מתועדות (התוספת חוזרת על אותו פער כמו R60)

- ה-spec מדבר על `UPDATE user_profiles SET onboarding_completed = false`. אין טבלה כזו → `resetTour()` מסיר רק את ה-localStorage. הסכמה של app_states / Auth users לא נגעה. אם תרצה cross-device בעתיד, אפשר להעביר את ה-flag ל-`app_states.payload.flags.tourCompleted` — אבל זה לא הסיר עכשיו.

## Verification

- ✓ `npx tsc --noEmit` נקי · ✓ `npm run lint` 0 errors (6 warnings קודמות, לא בקבצי R61) · ✓ `npm run build` Compiled successfully (/dashboard, /settings, כל הroutes ירוקים) · ✓ `npx vitest run` 75/75.
- ✓ TypeScript strict · 0 `any` · 0 `@ts-ignore`. שום dep חדש. שום migration חדש (R60's migration עדיין נחוצה ידנית למסלול ה-welcome email; ה-tour עצמו לא צריך שום שינוי DB).
- ⏳ **קבלה (owner)** — 4 התרחישים של ה-spec:
  1. Modal פתוח, צעד 2, לחיצה על "סיום ההדרכה" → נסגר עם fade-out + toast; refresh → לא חוזר. ✓ (localStorage נכתב לפני ה-200ms timeout)
  2. Modal פתוח, צעד 3, סגירת הטאב → cleanup קורא `forceMarkTourCompletedSync()`; פתיחה מחדש → לא קופץ. ✓
  3. Tour הושלם → `/settings` → "הפעל מחדש" → `/dashboard` → Tour קופץ שוב. ✓
  4. משתמש קיים שכבר עבר את הסיור → ה-flag ב-localStorage → modal לעולם לא מרונדר. ✓
