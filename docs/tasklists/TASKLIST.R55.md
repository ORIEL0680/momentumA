# TASKLIST · R55 — SMART INPUT למאזן (יום 2: קלט קולי + אישור + אינטגרציה)

> המשך ה-spec "R45 — SMART INPUT". יום 1 = R54 (ספריות טהורות + טסטים).
> יום 2 כאן: רכיב הקול, זרימת האישור, וחיבור לעמוד המאזן.

**Date:** 2026-05-19 · tsc ✅ · lint ✅ (0 err) · build ✅ · test ✅ 75/75 · no new deps / no migration.

## Done (deterministic — נבנה, מתקמפל, נבדק headless)

1. **`lib/useSpeechRecognition.ts`** — hook דק מעל Web Speech API
   (he-IL). זיהוי-אי-תמיכה, start/stop, transcript סופי + interim חי,
   טיפול בשגיאות (חסימת מיקרופון / אין-דיבור / כללי), restart שקוף
   בין sessions קצרים של הדפדפן. **פרטיות:** התמליל נשאר אך ורק
   ב-state של React — אפס רשת, שום דבר לא נשלח. טייפים מינימליים
   ל-Web Speech (אין `any` / `@ts-ignore`). עומד בכללי
   react-hooks (lazy `useState` init, אין setState-in-effect,
   אין קריאת ref ב-render).
2. **`components/balance/VoiceCapture.tsx`** — זרימה דו-שלבית:
   - **capture:** כפתור מיקרופון, חיווי "מקליט…", תמליל חי
     (interim מעומעם), הודעות שגיאה ברורות, fallback כשאין תמיכה.
   - **review (אישור חובה):** כל רשומה = `parseHebrew` →
     `matchName` מול האורחים שהגיעו. הצגת "נשמע: …", שדה סכום
     לעריכה, צ'יפים של עד 3 התאמות + סיבה, "דלג", checkbox הכללה.
     **שום דבר לא נכתב ל-store מהרכיב** — רק `onApply(rows)` אחרי
     שהמשתמש לוחץ "אשר והחל"; שורות בלי התאמה מסומנות לטיפול ידני.
3. **אינטגרציית מאזן** — `app/balance/page.tsx`: כפתור "קלט קולי"
   בסרגל, מודאל `VoiceCapture`, ו-`applyVoiceRows` שקורא
   `actions.setGuestEnvelope` רק לשורות שאושרו (amount>0). הרשימה
   מתעדכנת אוטומטית (`useSyncExternalStore`).

עקרונות אבטחה: כל קלט עובר אישור אנושי מפורש לפני כתיבה; התמליל
client-side בלבד; אין כתיבה אוטומטית.

## Honest deferral — יום 3

- **Edge OCR endpoint** (OpenAI Vision gpt-4o) — דורש מפתח סודי
  בצד-שרת (אסור ב-client bundle).
- **`EnvelopeScan`** (מצלמה) + **`SmartInputFAB`**.

נדחים כי הם דורשים מפתח שרת + חומרת מצלמה + קבלה על מכשיר.

## Verification

- ✓ `npx tsc --noEmit` נקי · ✓ `npm run lint` 0 errors (6 warnings
  קודמות, לא בקבצים החדשים) · ✓ `npm run build` Compiled successfully
  (/balance קיים) · ✓ `npx vitest run` 75/75.
- ✓ אפס תלויות חדשות · אפס מיגרציה.
- ⏳ **owner-side:** בדיקת המיקרופון בפועל (he-IL, דיוק זיהוי,
  הרשאת mic) חייבת מכשיר אמיתי — אי-אפשר לאמת headless. הלוגיקה
  (parse/match), ה-build וה-types מאומתים דטרמיניסטית; חוויית הקול
  עצמה לאישור על מכשיר.
