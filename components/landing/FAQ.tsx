/**
 * R42 — FAQ. Native <details>/<summary> accordion → zero client JS,
 * fully accessible, works without "use client".
 */
const QA: Array<{ q: string; a: string }> = [
  {
    // R121 — pricing tiers paused during launch. All features open
    // for free for 60 days. Honest, calm answer.
    q: "כמה זה עולה?",
    a: "כרגע — שום דבר. לרגל ההשקה, כל מי שמצטרף מקבל את הפלטפורמה המלאה בחינם לחודשיים — כל הפיצ'רים, ללא הגבלות, ללא כרטיס אשראי. כשהמבצע ייגמר, לא נחייב אתכם אוטומטית — תוכלו לבחור להמשיך עם מסלול בתשלום או לעצור.",
  },
  {
    q: "כמה זמן לוקח להגדיר אירוע?",
    a: "פחות מ-5 דקות. רוב הזוגות סיימו את ה-onboarding ושלחו הזמנה ראשונה תוך 10 דקות.",
  },
  {
    q: "האם הנתונים שלי בטוחים?",
    a: "כן — הצפנה ברמה בנקאית, RLS על כל טבלה, GDPR מלא. הנתונים שלכם אצלכם, לא נמכרים ולא משותפים.",
  },
  {
    // R121 — was "what if I regret after paying" which assumes
    // paid tier exists today. Reframed for launch: nothing to
    // regret since you didn't pay. Still leaves room for the
    // future paid tier without over-promising.
    q: "מה קורה בסוף שני החודשים?",
    a: "כשהמבצע ייגמר, נציג לכם את המסלולים בתשלום שייפתחו עם פתיחת הסליקה. אתם בוחרים: להמשיך עם המסלול שמתאים לכם, או לעצור. אין חיוב אוטומטי, אין הפתעות, אין כרטיס שמור במערכת. כל מי שהצטרף בתקופת ההשקה מקבל הטבה קבועה במחיר.",
  },
  {
    // R121 — explicit "vendors also free during launch" answer.
    q: "אני ספק — גם בשבילי זה חינם?",
    a: "כן — כל מי שמצטרף בתקופת ההשקה מקבל את כל הפיצ׳רים בחינם, גם ספקים. Vendor Studio, דף נחיתה, לידים בזמן אמת, אנליטיקות — הכל פתוח לחודשיים בלי חיוב. אחרי המבצע נציג מסלול מנוי לספקים, ותוכלו להחליט אם להמשיך.",
  },
  {
    q: "האפליקציה עובדת בלי חיבור לאינטרנט?",
    a: "כן — האפליקציה היא PWA. תוכלו לעבוד באירוע בלי קליטה, והנתונים יסתנכרנו כשתחזרו לרשת.",
  },
  {
    q: "מה עם הסבתא שלי שלא מבינה באפליקציות?",
    a: "האורחים שלכם לא צריכים להוריד שום דבר. הם פשוט לוחצים על קישור בוואטסאפ ועונים — פשוט וברור גם לסבא וסבתא.",
  },
  {
    q: "איך זה שונה מ-Excel + WhatsApp?",
    a: "Excel = רישום. Momentum = ניהול חי: RSVP אוטומטי, חישוב תקציב חי, AI שמתריע, ספקים בלחיצה אחת. החיסכון במתח לבד שווה את הזמן שתשקיעו פעם אחת.",
  },
  {
    q: "האם זה מתאים גם לבר/בת מצווה או ברית?",
    a: "כן — Momentum תומך ב-9 סוגי אירועים: חתונה, בר מצווה, בת מצווה, ברית, יום הולדת מרכזי, אירוסין, חינה, מסיבת רווקים/רווקות, ואירועי חברה. הקופי, המחשבונים והממשק מתאימים אוטומטית.",
  },
  {
    q: "מי רואה את הנתונים שלי?",
    a: "רק אתם. הספקים שאתם בוחרים לפנות אליהם רואים את הסטייל והתקציב — ולא את הזהות, השם, או הטלפון — עד שאתם מאשרים. אנחנו לא מוכרים נתונים, נקודה.",
  },
  {
    q: "האם יש אפליקציה ל-iOS / Android?",
    a: "Momentum היא PWA — מותקנת ישירות מהדפדפן (Safari/Chrome) לתפריט הראשי של הטלפון. נראית ופועלת בדיוק כמו אפליקציה רגילה, בלי App Store. גרסה native ל-iOS/Android בדרך — Q4 2026.",
  },
  {
    q: "מה מקבלים מי שמצטרפים בתקופת ההשקה?",
    a: "כל הפיצ׳רים בחינם לחודשיים, שיחת onboarding אישית עם המייסד, גישה מוקדמת לפיצ׳רים חדשים, ושם אישי בקרדיטים של האפליקציה. וגם — הטבה קבועה במחיר כשהמסלולים בתשלום ייפתחו.",
  },
];

export function FAQ() {
  return (
    <section className="py-24 md:py-32 relative">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <h2
          className="text-center font-bold gradient-text"
          style={{ fontSize: "clamp(2rem, 6vw, 3rem)" }}
        >
          שאלות נפוצות
        </h2>

        <div className="mt-12 space-y-3">
          {QA.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl overflow-hidden"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <summary
                className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 font-bold"
                style={{ minHeight: 56 }}
              >
                <span>{item.q}</span>
                <span
                  className="text-[--accent] transition-transform group-open:rotate-45 text-2xl leading-none shrink-0"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <div
                className="px-5 pb-5 leading-relaxed"
                style={{ color: "var(--foreground-soft)", fontSize: "1.02rem" }}
              >
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
