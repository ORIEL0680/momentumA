/**
 * R67 (R56) — Wedding Brain.
 *
 * Deterministic 18-month timeline of meetings/milestones, anchored on
 * the event date. The seed-brain API generates one DB row per future
 * suggestion (status='pending', source='ai_suggestion'); the user
 * accepts/edits/dismisses each via the calendar UI.
 *
 * Pure module — no IO, SSR-safe, easy to extend (just add another row
 * to WEDDING_TIMELINE). Categories MUST match the CHECK constraint in
 * `supabase/migrations/2026-05-20-calendar-appointments.sql`.
 */

export type AppointmentCategory =
  | "venue"
  | "catering"
  | "photo"
  | "dj"
  | "flowers"
  | "dress"
  | "hair"
  | "personal"
  | "milestone"
  | "other";

export interface BrainSuggestion {
  daysBeforeEvent: number;
  title: string;
  category: AppointmentCategory;
  description: string;
  /** Duration in minutes. 0 = a milestone with no fixed end time. */
  duration: number;
  icon: string;
}

export const WEDDING_TIMELINE: BrainSuggestion[] = [
  // 12 months out
  {
    daysBeforeEvent: 365,
    title: "סגירת אולם",
    category: "venue",
    description: "בקרו ב-3 אולמות, השוו מחירים, סגרו עם פיקדון",
    duration: 120,
    icon: "🏛",
  },
  {
    daysBeforeEvent: 350,
    title: "בחירת תאריך עברי + לועזי",
    category: "milestone",
    description: "בדקו חגים, מועדי משפחה, זמינות אולם",
    duration: 60,
    icon: "📅",
  },

  // 9 months out
  {
    daysBeforeEvent: 270,
    title: "פגישת צלם ראשונה",
    category: "photo",
    description: "ראו פורטפוליו, השוו 3 צלמים, סגרו תאריך",
    duration: 90,
    icon: "📸",
  },
  {
    daysBeforeEvent: 260,
    title: "פגישת מתכנן אירוע (אופציונלי)",
    category: "other",
    description: "אם רוצים מתכנן — זה הזמן",
    duration: 60,
    icon: "👰",
  },

  // 6 months out
  {
    daysBeforeEvent: 180,
    title: "פגישת קייטרינג ראשונה",
    category: "catering",
    description: "ראו תפריטים, השוו 2-3 קייטרינגים",
    duration: 90,
    icon: "🍽",
  },
  {
    daysBeforeEvent: 175,
    title: "פגישת DJ / להקה",
    category: "dj",
    description: "האזינו לסטים, סגרו play list ראשוני",
    duration: 60,
    icon: "🎵",
  },
  {
    daysBeforeEvent: 170,
    title: "פגישת מעצב פרחים",
    category: "flowers",
    description: "סטייל, צבעוניות, תקציב כללי",
    duration: 60,
    icon: "🌹",
  },
  {
    daysBeforeEvent: 160,
    title: "התחלת חיפוש שמלה",
    category: "dress",
    description: "סטודיו ראשון — להבין סטייל אישי",
    duration: 120,
    icon: "👗",
  },

  // 4 months out
  {
    daysBeforeEvent: 120,
    title: "טעימת קייטרינג ראשונה",
    category: "catering",
    description: "תפריט סופי, אורחים מיוחדים (כשר/טבעוני)",
    duration: 120,
    icon: "🥂",
  },
  {
    daysBeforeEvent: 115,
    title: "פגישת מאפר/ת",
    category: "hair",
    description: "ניסיון look ראשון",
    duration: 90,
    icon: "💄",
  },
  {
    daysBeforeEvent: 110,
    title: "הזמנת הזמנות דיגיטליות",
    category: "milestone",
    description: "עיצוב + שליחה ב-Momentum",
    duration: 30,
    icon: "💌",
  },

  // 3 months out
  {
    daysBeforeEvent: 90,
    title: "מדידת שמלה שנייה",
    category: "dress",
    description: "התאמות אחרונות",
    duration: 60,
    icon: "👗",
  },
  {
    daysBeforeEvent: 85,
    title: "פגישת תפאורן",
    category: "other",
    description: "אווירה כללית, פינות צילום",
    duration: 60,
    icon: "✨",
  },

  // 2 months out
  {
    daysBeforeEvent: 60,
    title: "סגירת רשימת מוזמנים",
    category: "milestone",
    description: "מספר סופי לקייטרינג + סידור שולחנות",
    duration: 90,
    icon: "📋",
  },
  {
    daysBeforeEvent: 55,
    title: "פגישת DJ — סט סופי",
    category: "dj",
    description: "חופה, ריקודי טבעת, ערב",
    duration: 60,
    icon: "🎶",
  },

  // 1 month out
  {
    daysBeforeEvent: 30,
    title: "טעימה אחרונה באולם",
    category: "catering",
    description: "אישור תפריט סופי + אלרגיות",
    duration: 90,
    icon: "🍷",
  },
  {
    daysBeforeEvent: 28,
    title: "ניסיון איפור + שיער מלא",
    category: "hair",
    description: "look סופי בדיוק כמו ביום",
    duration: 120,
    icon: "💋",
  },
  {
    daysBeforeEvent: 25,
    title: "מדידת שמלה אחרונה",
    category: "dress",
    description: "הכל מושלם — תיקונים אחרונים",
    duration: 45,
    icon: "👗",
  },

  // 2 weeks out
  {
    daysBeforeEvent: 14,
    title: "אישור סופי עם כל הספקים",
    category: "milestone",
    description: "שעות, מיקומים, אנשי קשר ביום",
    duration: 60,
    icon: "✅",
  },
  {
    daysBeforeEvent: 10,
    title: "סידור שולחנות סופי",
    category: "milestone",
    description: "מי יושב איפה — לאשר באולם",
    duration: 60,
    icon: "🪑",
  },

  // 1 week out
  {
    daysBeforeEvent: 7,
    title: "חזרה כללית",
    category: "milestone",
    description: "ריצה על הסדר עם המנהל-משנה",
    duration: 90,
    icon: "🎯",
  },
  {
    daysBeforeEvent: 5,
    title: "מניקור + פדיקור",
    category: "hair",
    description: "פינוק אחרון",
    duration: 90,
    icon: "💅",
  },
  {
    daysBeforeEvent: 3,
    title: "אריזת ירח דבש",
    category: "personal",
    description: "אל תשכחו: דרכון, מטענים, נוחות",
    duration: 60,
    icon: "✈️",
  },

  // 1-2 days out
  {
    daysBeforeEvent: 2,
    title: "מנוחה מלאה + שתייה",
    category: "personal",
    description: "אסור עיסוקים מתישים",
    duration: 0,
    icon: "😌",
  },
  {
    daysBeforeEvent: 1,
    title: "בוקר רגוע + תספורת/גילוח",
    category: "personal",
    description: "בית מסודר, בגדים מוכנים",
    duration: 0,
    icon: "🌅",
  },
];

export interface GeneratedSuggestion {
  startAt: Date;
  endAt: Date;
  suggestion: BrainSuggestion;
}

/**
 * Given an event date, return all future suggestions anchored at
 * 10:00 local time, `daysBeforeEvent` days before the event. Filters
 * out anything in the past (relative to `todayDate`).
 *
 * The 10:00 default is intentional — Israeli vendors are typically
 * reachable from 10:00 onward, and a clear hour beats "midnight =
 * vague calendar entry" UX.
 */
export function generateBrainSuggestions(
  eventDate: Date,
  todayDate: Date = new Date(),
): GeneratedSuggestion[] {
  const today = new Date(todayDate);
  today.setHours(0, 0, 0, 0);
  return WEDDING_TIMELINE.map((suggestion) => {
    const start = new Date(eventDate);
    start.setDate(start.getDate() - suggestion.daysBeforeEvent);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    // Zero-duration milestones get a 60-minute window so the calendar
    // has something to render; the UI can still mark them as "milestone".
    end.setMinutes(end.getMinutes() + (suggestion.duration || 60));
    return { startAt: start, endAt: end, suggestion };
  }).filter((g) => g.startAt.getTime() > today.getTime());
}
