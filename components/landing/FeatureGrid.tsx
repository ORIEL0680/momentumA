import {
  Users,
  MessageCircle,
  Calculator,
  Sparkles,
  Map,
  Layout,
  Activity,
  QrCode,
  Camera,
  PiggyBank,
  Store,
  Award,
  type LucideIcon,
} from "lucide-react";

/**
 * R48 — the full feature catalog, presented with respect. 12 core
 * features in a 3-up grid (1-up on mobile). Server component, CSS-only
 * hover. Icons in a gold token chip (no hardcoded hex — color-mix off
 * the --gold-100 token so it tracks the theme).
 */
const FEATURES: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Users,
    title: "ניהול מוזמנים חכם",
    body: "ייבוא אנשי קשר, קבוצות חכמות, פלוסים, אישורי הגעה אוטומטיים — הכל מתעדכן בזמן אמת",
  },
  {
    icon: MessageCircle,
    title: "הזמנות WhatsApp",
    body: "הזמנה מעוצבת עם תמונת תצוגה מקדימה ולינק לאישור הגעה — נשלח לכל אורח בלחיצה אחת",
  },
  {
    icon: Calculator,
    title: "תקציב חי + 5 מחשבונים",
    body: "כמה אורח באמת עולה · סימולטור ׳מה אם׳ · מעטפות · אלכוהול · AI להצעות מחיר",
  },
  {
    icon: Sparkles,
    title: "AI Co-Pilot",
    body: "מתריע 14 יום לפני חריגת תקציב, מציע ספקים לפי הסטייל שלכם, מנתח אישורי הגעה",
  },
  {
    icon: Map,
    title: "ניווט וזיהוי לוקיישן",
    body: "Waze · Google Maps · Apple Maps באוטומציה. האורחים מקבלים את האולם בלחיצה",
  },
  {
    icon: Layout,
    title: "סידור הושבה חכם",
    body: "אלגוריתם שמשבץ אורחים לפי קבוצות, קונפליקטים, ו-VIPs. גרירה ידנית כשרוצים שינויים",
  },
  {
    icon: Activity,
    title: "Momentum Live (ביום עצמו)",
    body: "מנהל-משנה מקבל דשבורד חי: צ׳ק-אין QR, התראות AI, ניהול קריזה, שידור הודעות",
  },
  {
    icon: QrCode,
    title: "Guest Pass + צ׳ק-אין QR",
    body: "כל אורח מקבל QR אישי. סורק בכניסה — יודעים מי הגיע, באיזה שולחן, וקיבל מתנה",
  },
  {
    icon: Camera,
    title: "Memory Album חי",
    body: "אורחים סורקים QR, מעלים תמונות בזמן אמת. אתם מקבלים ספר זיכרונות אוטומטי",
  },
  {
    icon: PiggyBank,
    title: "מאזן רווח/הפסד",
    body: "אחרי האירוע — מי שם מעטפה, כמה, ומי תצטרכו להחזיר לו באירוע שלו. כולל קלט קולי",
  },
  {
    icon: Store,
    title: "ספקים מאומתים",
    body: "קטלוג ספקים עם ביקורות אמיתיות מזוגות שעבדו איתם. צ׳אט ישיר בתוך האפליקציה",
  },
  {
    icon: Award,
    title: "Wrapped Report",
    body: "דוח אוטומטי בסגנון Spotify Wrapped — 8 שקפים שמספרים את סיפור האירוע שלכם",
  },
];

export function FeatureGrid() {
  return (
    <section className="py-24 md:py-32 relative">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center">
          <h2
            className="font-bold gradient-text"
            style={{ fontSize: "clamp(2rem, 6vw, 3rem)" }}
          >
            כל מה שצריך לאירוע מושלם — במקום אחד
          </h2>
          <p
            className="mt-3 text-lg"
            style={{ color: "var(--foreground-soft)" }}
          >
            12 פיצ׳רים שמחליפים 12 כלים שונים
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="card p-6 md:p-7 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_var(--accent-glow)]"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background:
                    "color-mix(in srgb, var(--gold-100) 15%, transparent)",
                  border: "1px solid var(--border-gold)",
                  color: "var(--accent)",
                }}
                aria-hidden
              >
                <Icon size={19} />
              </div>
              <h3
                className="mt-4 font-bold leading-snug"
                style={{ fontSize: "1.125rem" }}
              >
                {title}
              </h3>
              <p
                className="mt-2 leading-relaxed"
                style={{ color: "var(--foreground-soft)", fontSize: "0.875rem" }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>

        <p
          className="mt-12 text-center mx-auto max-w-2xl leading-relaxed text-sm"
          style={{ color: "var(--foreground-muted)" }}
        >
          ועוד 24 פיצ׳רים נוספים — בריתות, בר/בת מצווה, ימי הולדת, אירועי
          חברה. תפריט מלא לכל אירוע, מותאם בעברית.
        </p>
      </div>
    </section>
  );
}
