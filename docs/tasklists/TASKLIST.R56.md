# TASKLIST · R56 — מעבר לדומיין moomentum.events (תיקון רפרנסים בקוד)

> ממש את ה-spec "R46 — מעבר לדומיין". (R46 כבר תפוס בהיסטוריה — סבב
> ROOM 3D — לכן הסבב הזה ממוספר R56 ברצף.)

**Date:** 2026-05-19 · deadline: לפני השקה 26.5 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 75/75 · no new deps / no migration.

החלפת כל הופעות הדומיין הישן `momentum-psi-ten.vercel.app` →
`moomentum.events`, והוספת redirects ל-canonical. ללא נגיעה
ב-Vercel/Supabase/Google OAuth (פעולות ידניות של המשתמש).

## Done (קוד בלבד — דטרמיניסטי, מאומת)

1. **`app/layout.tsx`** — `SITE_URL` fallback → `https://moomentum.events`
   (env עדיין מנצח). נוסף `alternates.canonical: SITE_URL` ו-
   `openGraph.url: SITE_URL` (env-driven, לא hardcoded).
2. **`app/terms/page.tsx`** — סעיף הגדרות: `momentum-psi-ten.vercel.app`
   → `moomentum.events`.
3. **`app/manifest.webmanifest/route.ts`** — נוסף `id` יציב
   (`${SITE_URL}/`, env-driven) + `scope: "/"`. `start_url`/`scope`
   נשארו יחסיים (כנדרש — עובד בכל host).
4. **`README.md`** — דוגמת `NEXT_PUBLIC_SITE_URL` → `moomentum.events`.
5. **`.env.example`** — `NEXT_PUBLIC_SITE_URL=https://moomentum.events`
   + נוסף `NEXT_PUBLIC_APP_URL=https://moomentum.events`.
6. **`.env.local`** (gitignored — מקומי בלבד) — אותו עדכון; פרודקשן
   נקבע ב-Vercel UI ע"י המשתמש.
7. **`vercel.json`** — נוסף `redirects` (permanent/301):
   `www.moomentum.events` → apex, `momentum-psi-ten.vercel.app` → apex.
   הדומיין הישן ימשיך לענות אך יפנה לחדש — שומר על קישורים שכבר נשלחו.
8. **`DEPLOYMENT.md`** — שלב 5 עודכן: `moomentum.events` כדומיין
   פרודקשן + צעדי ה-DNS/Vercel/Supabase/OAuth הידניים; הוסר ה-
   placeholder `momentum-tal.vercel.app`.

הקוד כבר היה env-driven דרך `lib/origin.ts` / `NEXT_PUBLIC_SITE_URL`
(invitation/shortLinks/managerInvitation וכו') — אין שם דומיין
hardcoded, ולכן לא נדרש שינוי. אין `app/sitemap.ts` /
`public/robots.txt` / `public/manifest.json` בריפו (לא נוצרו —
מחוץ ל-scope של תיקון רפרנסים).

## נשאר לידני (לא בקוד — פעולות המשתמש, לפי ה-DEPLOY ORDER של ה-spec)

- **Vercel UI:** הוספת `moomentum.events` (+ `www`) ב-Settings →
  Domains, סימון כ-Production domain, ועדכון משתני הסביבה
  `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` ל-`https://moomentum.events`.
- **Supabase:** Auth → Site URL + Redirect URLs לדומיין החדש.
- **Google OAuth:** Authorized redirect URIs לדומיין החדש.
  (אחרת משתמשים ייכנסו בלי auth — לבצע לפני שמפנים תעבורה.)
- **בדיקות פוסט-פריסה (owner):** טעינת moomentum.events, www→apex,
  vercel.app→301, Google OAuth, RSVP מ-WhatsApp, OG preview
  (developers.facebook.com/tools/debug), PWA install, SSL ירוק.

## Verification (headless, ניתן לאימות)

- ✓ `npx tsc --noEmit` נקי · ✓ `npm run lint` 0 errors (6 warnings
  קודמות, לא בקבצים שנגעתי) · ✓ `npm run build` Compiled successfully
  (/layout · /terms · /manifest.webmanifest נבנו) · ✓ `vitest` 75/75.
- ✓ grep מאשר: אפס `momentum-psi-ten` בקוד, פרט לכלל ה-redirect
  ב-`vercel.json` (שחייב להזכיר את ה-host הישן כדי להפנות אותו)
  ושורת התיעוד שלו ב-DEPLOYMENT.md.
- ✓ אפס תלויות חדשות · אפס מיגרציה.
