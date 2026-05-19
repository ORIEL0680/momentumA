# TASKLIST · R58 — שכתוב מלא של עמוד הנחיתה (קופי + פיצ׳רים + יוקרה)

> ממש את ה-spec "R48". (R48 כבר תפוס בהיסטוריה → R58 ברצף.)

**Date:** 2026-05-19 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 75/75 · no new deps / no migration.

## Done (12 חלקים)

1. **קופי קריטי (fraud-prevention):** הוסרו כל "ללא/בלי כרטיס אשראי"
   / "ללא חתימת אשראי לחינם" (Stripe Q3 2026 — טענה מוקדמת).
   הוחלפו ל-"התחלה חינמית · ללא התחייבות". קבצים: `Hero.tsx`,
   `PricingSection.tsx`, `FinalCTA.tsx`.
2. **תיקוני עברית/אחידות:** וואצפ→וואטסאפ; פנייה אחידה בלשון רבים
   (התחל→התחילו בכל ה-CTAs); משפטי Pain/Solution/HonestStats/FAQ
   נוסחו מחדש לפי ה-spec.
3. **`FeatureGrid.tsx` (חדש):** 12 פיצ׳רים, grid 1/2/3 עמודות,
   אייקון lucide בצ׳יפ זהב (color-mix על `--gold-100` — בלי hex),
   hover translate-y + gold glow. כותרת+סאב+פסקת "24 פיצ׳רים נוספים".
4. **`AppShowcase.tsx` (שכתוב):** 3 mockup-טלפונים CSS בלבד
   (דשבורד/מוזמנים/Momentum-Live), notch, gold edge-reflection,
   רקע נקודות-זהב, 6 callouts עם מוטיב SVG connector, bottom-nav.
5. **`TrustSection.tsx` (חדש):** "תשתית של בנק. חוויה של רויאלטי."
   + 3 עמודים (Shield/Server/Heart) — אבטחה / תשתית / תמיכה אנושית.
6. **FAQ:** תוקנו 2 ניסוחים + נוספו 4 שאלות (סוגי אירועים, פרטיות,
   PWA/native, מה כלול ב-100 הראשונים).
7. **Hero:** badge "Israeli Startup", 2 orbs עדינים (rose/emerald,
   opacity 0.15), שורת social-proof (4 avatars + "27 זוגות"),
   h1 → `gradient-gold-shimmer`.
8. **PricingSection:** "73 מקומות נשארו מתוך 100" מתחת לתווית
   ההשקה; שורת "מאובטח על ידי:" Supabase/Twilio/OpenAI/Vercel
   (font-mono, opacity 60→100 ב-hover); trust-row →
   ביטול/החזר/תמיכה אנושית.
9. **אנימציה:** `@keyframes goldShimmer` + `.gradient-gold-shimmer`
   ב-`globals.css` (טוקני `--gold-*`, לא hex), הוחל על Hero h1 +
   FinalCTA h2; `prefers-reduced-motion` → `animation:none` (הטקסט
   נשאר זהב סטטי, לא נעלם); נוסף לרשימת ה-print override.
10. **`app/page.tsx`:** `<FeatureGrid/>` אחרי SolutionSection;
    `<TrustSection/>` אחרי PricingSection (לפני HonestStats).
11. **orbs:** `.glow-orb-rose` / `.glow-orb-emerald` ב-`globals.css`
    (rgba — תואם לקונבנציית ה-orbs הקיימת, לא hex inline).
12. וידוא + commit + push.

## סטיות מתועדות

- **AppShowcase:** ה-spec ביקש "carousel-like" + SVG connectors
  מעוגנים לחלקים ספציפיים במסך. כל הסקציות חייבות להיות Server
  Components (חוק ה-spec) → אין JS לקרוסלה ולעיגון פיקסלי רספונסיבי.
  מימשתי 3 טלפונים בשורה (המרכזי מודגש/מורם בדסקטופ, stacked
  במובייל) + callouts עם מוטיב connector ב-SVG כאלמנט עיצובי
  (לא מעוגן-פיקסל) — שומר zero-JS ויציב בכל רוחב. הכוונה (premium
  multi-screen + connector motif) מולאה.
- "מעל ה-grid"/"מתחת ל-grid" ב-FeatureGrid מומשו ככותרת+סאב מעל
  ופסקה מרוכזת מתחת, כפי שבוקש.

## חוקים שנשמרו

- כל הסקציות Server Components (אין `"use client"`).
- TypeScript strict · 0 `any` · 0 `@ts-ignore`.
- אפס תמונות חיצוניות — CSS/SVG inline בלבד.
- אפס hex hardcoded בקומפוננטות — `var(--*)` / `color-mix` /
  rgba-בקלאסים-של-globals (כמו שאר ה-orbs). כל ה-CTAs → `/signup`
  (ספק → `/vendors/join`, ללא שינוי).

## Verification

- ✓ `npx tsc --noEmit` נקי · ✓ `npm run lint` 0 errors (6 warnings
  קודמות ב-`app/terms/page.tsx`, לא קשורות) · ✓ `npm run build`
  Compiled successfully · ✓ `npx vitest run` 75/75.
- ✓ אפס תלויות חדשות · אפס מיגרציה.
- ⏳ **owner-side:** ביקורת ויזואלית במכשיר (360/768/1280),
  Lighthouse mobile >90, חלקות ה-shimmer/reduced-motion — לא ניתן
  headless.
