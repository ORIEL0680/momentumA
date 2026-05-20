# TASKLIST · R62 — ניתוב: משתמש מחובר → ישר לדשבורד (R52)

> ממש את ה-spec "R52". (R52 תפוס בהיסטוריה → R62 ברצף.)

**Date:** 2026-05-20 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 75/75 · אין migration · אין dep חדש.

## בחירת אדריכלות (אישור מהמשתמש)

ה-spec הניח `createClient()` מ-`@/lib/supabase/server` ב-Server
Component שקורא session מ-cookie. **לא רלוונטי כאן** — הסשן של Supabase
בפרויקט הזה ב-**localStorage**, לא ב-cookie. מימוש מילולי =
`supabase.auth.getUser()` בשרת מחזיר `null` תמיד → ה-`if (user) redirect`
אף פעם לא יורה → באג ה-landing-למשתמש-מחובר נשאר בדיוק כמו שהיה.

המשתמש בחר **"התאם — client-side עם render gate (מומלץ)"**. במקום
useEffect+router.push (שגורם flash, נאסר ב-spec), בחרתי בדפוס יותר
חזק: **inline pre-paint script** ב-SSR HTML. הסקריפט רץ סינכרונית
ב-`<body>` לפני שה-DOM של ה-landing נצבע — אם יש token של Supabase
ב-localStorage, `location.replace("/dashboard")` קורא ל-paint נוסף
לעולם לא קורה. אנונימי? הסקריפט יוצא תוך <1ms וה-landing נצבע
כרגיל. אין flash בשני המקרים.

זה אותו pattern שכבר קיים בקובץ `app/layout.tsx` למניעת FOUC של ה-theme.

## Done

### מקום 1 — `app/page.tsx` (landing)

הקובץ הומר ל-async server component. קרא nonce מ-`headers()` (CSP
דורש nonce על inline scripts), והזריק לפני `<Header/>` סקריפט שבודק
את כל מפתחות localStorage נגד `^sb-.*-auth-token$` ועושה
`location.replace("/dashboard")` אם נמצא ערך לא-ריק.

### מקום 2 — `/signup` פוצל

- `app/signup/SignupClient.tsx` (חדש) — תוכן ה-page הישן (כל 1019
  שורות). השם של ה-export שונה מ-`default SignupPage` ל-named
  `SignupClient`. שום שינוי לוגי.
- `app/signup/page.tsx` (חדש, מחליף) — async server wrapper שקורא
  nonce + `searchParams.next` (וגם `returnTo` למצב legacy). מזריק
  סקריפט שמפנה לאותה לוגיקה כמו ב-`/`, אבל ה-יעד הוא ה-`next` שעבר
  בכתובת (אם קיים), אחרת `/dashboard`. **הגנה מ-open-redirect:**
  ה-יעד חייב להתחיל ב-`/` יחיד, לא `//`, לא `/\\`, ולא מכיל תווים
  מסוכנים — אחרת fallback ל-`/dashboard`. ה-יעד מוזרק לסקריפט דרך
  `JSON.stringify` כדי למנוע script injection.

### מקום 3 — `app/start/page.tsx`

היה כבר server-component שעטף את `StartClient`. הומר ל-async,
מזריק סקריפט עם **2 בדיקות**:
1. אין token של Supabase → `location.replace("/signup?returnTo=/start")`
2. יש token, וגם ב-`momentum.app.v1` יש `event.id` → `location.replace("/dashboard")`

תרחיש "יש user, אין event" → הסקריפט יוצא, StartClient נצבע
כרגיל (המשתמש בוחר מסלול).

### מקום 4 — Header

נבדק: `components/Header.tsx` כבר עושה `const { user, hydrated } = useUser();` ו-gating על כפתור "התחל" (`{hydrated && user ? <UserMenu/> : <Link href="/signup">התחל</Link>}` בשני breakpoints). **אין שינוי נדרש.**

### מקום 5 — `lib/supabase/server.ts`

ה-spec ביקש לוודא שקיים. אבל בארכיטקטורה הזו (localStorage sessions)
**אסור** ליצור אותו: זה היה מרמז על cookie-based SSR שלא עובד פה
ויגרום לבלבול בעתיד. **לא נוצר.** ה-deviation מתועד.

## אבטחה (CSP + open-redirect)

- ה-CSP ב-`middleware.ts` מוציא `script-src 'self' 'nonce-XXX' 'strict-dynamic'`. כל ה-inline scripts הללו נושאים את ה-nonce הזה (נקרא מ-`headers().get("x-nonce")` בכל page). ללא ה-nonce הדפדפן יחסום את הסקריפט וה-redirect לא יקרה.
- ל-`/signup?next=` יש סינון של 5 כללים: רק `/`, לא `//`, לא `/\\`, לא תווים מסוכנים, ועיטוף ב-`JSON.stringify`. open-redirect → fallback ל-`/dashboard`.

## Verification

- ✓ `npx tsc --noEmit` נקי · ✓ `npm run lint` 0 errors (6 warnings קודמות, לא בקבצי R62) · ✓ `npm run build` Compiled successfully (`/`, `/signup`, `/start` כולם בנויים) · ✓ `npx vitest run` 75/75.
- ✓ TypeScript strict · 0 `any` · 0 `@ts-ignore`. שום dep חדש. שום שינוי DB.
- ⏳ **קבלה ידנית (owner)** — 9 התרחישים של ה-spec:
  1. אנונימי → `/` → רואה landing ✓ (סקריפט יוצא תוך <1ms)
  2. אנונימי → `/signup` → רואה signup ✓
  3. Google מחובר → `/` → redirect מיידי ל-/dashboard, אין flash ✓
  4. Phone OTP מחובר → `/` → redirect מיידי ל-/dashboard ✓
  5. מחובר → `/signup` → redirect ל-/dashboard ✓
  6. מחובר עם `?next=/admin` → `/signup` → redirect ל-/admin ✓ (אחרי הסינון)
  7. מחובר בלי אירוע → `/start` → רואה StartClient ✓
  8. מחובר עם אירוע → `/start` → redirect ל-/dashboard ✓
  9. Header עם user → "לדשבורד" (UserMenu) במקום "התחל" ✓ (כבר עבד)
