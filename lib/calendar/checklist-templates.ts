/**
 * R68 (R57) — vendor-meeting checklists.
 *
 * Each appointment category gets a curated list of questions to ask
 * the vendor + things to bring. Stored on `appointments.checklist`
 * (jsonb, R68 migration). Default checklist is generated when the
 * appointment is first saved; the user can tick items off and add
 * custom rows.
 *
 * Pure data + helpers. No IO. Categories MUST match the CHECK
 * constraint in `2026-05-20-calendar-appointments.sql`.
 */

import type { AppointmentCategory } from "./wedding-brain";

export type ChecklistItemType = "question" | "bring";

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  type: ChecklistItemType;
}

export interface ChecklistTemplate {
  questions: string[];
  bring: string[];
}

/**
 * `personal` + `milestone` deliberately fall through to the `other`
 * template — they're not vendor meetings, so the generic "what's
 * included?" + bring-your-questions list is more honest than
 * pretending we know what should be on the list.
 */
export const CHECKLIST_TEMPLATES: Record<string, ChecklistTemplate> = {
  venue: {
    questions: [
      "מה מחיר סופי לאורח, וכמה זה כולל?",
      "האם יש חניה לאורחים? כמה מקומות?",
      "עד איזו שעה אפשר לרקוד?",
      "האם מותרים זיקוקים/מטאורים?",
      "מה תנאי הביטול והדחייה?",
      "האם יש מקדמה? כמה ומתי?",
      "מה כלול: כיסאות, שולחנות, מפות, צלחות?",
      "האם יש איש קשר ביום עצמו?",
    ],
    bring: [
      "תקציב מקסימום שאתם מוכנים לחתום עליו",
      "רשימת תאריכים פנויים שלכם",
      "תוכנית גרפית של איך אתם מדמיינים את האירוע",
    ],
  },
  catering: {
    questions: [
      "מה כלול במחיר ומה תוספת?",
      "האם יש אופציה כשרה/טבעונית/ילדים?",
      "כמה מנות לאורח (איכות > כמות)?",
      "מי המלצרים — מספר לאורח?",
      "האם יש איש קשר ביום עצמו?",
      "מה מדיניות עודפים?",
      "האם אפשר לטעום בלי תשלום?",
    ],
    bring: [
      "רשימת אלרגיות / הגבלות תזונה של אורחים",
      "סטייל אווירה (פורמלי/חגיגי/אינטימי)",
    ],
  },
  photo: {
    questions: [
      "כמה שעות כלולות ביום עצמו?",
      "כמה תמונות נקבל בסוף, ומה הפורמט?",
      "תוך כמה זמן נקבל את החומר?",
      "האם יש 2 צלמים? וידאו?",
      "האם אפשר תיק תמונות / אלבום מודפס?",
      "מה תנאי הביטול?",
      "האם יש backup במידה והוא חולה?",
    ],
    bring: [
      "Pinterest board / דוגמאות לסטייל שאתם אוהבים",
      "תוכנית מיוחדת ל-first look או חופה",
    ],
  },
  dj: {
    questions: [
      "כמה שעות כלולות ומה תוספת לאחר?",
      "האם יש 2 סטים שונים (חופה + ערב)?",
      "מה ציוד הסאונד והתאורה?",
      "האם יש דרישות מיוחדות מהאולם?",
      "מי האיש על המיקרופון לסעיף לפני החופה?",
      "האם הוא יכול ללמוד שירים מיוחדים?",
    ],
    bring: [
      "פלייליסט של 20 שירים שאתם חייבים שיהיו",
      "שיר ראשון לריקוד",
      "שיר כניסה לחופה",
    ],
  },
  flowers: {
    questions: [
      "מה כלול: זר כלה? עיטורי שולחנות? קישוט חופה?",
      "אילו פרחים בעונה ומתאימים לתקציב?",
      "תוך כמה זמן לפני האירוע מגיעים לאולם?",
      "האם יש backup אם פרח מסוים לא בעונה?",
    ],
    bring: [
      "תמונות סטייל / צבעוניות",
      "תוכנית האולם — איפה יהיו שולחנות",
    ],
  },
  dress: {
    questions: [
      "כמה זמן לוקח להזמין שמלה כזו?",
      "כמה תיקונים כלולים?",
      "האם יש קופון לחזרה למדידות?",
      "מה תנאי החזרה / החלפה?",
    ],
    bring: [
      "תמונות סטייל",
      "תחתונים והנעליים שתכננתם לחתונה",
    ],
  },
  hair: {
    questions: [
      "כמה זמן לוקח הסטיילינג ביום עצמו?",
      "האם יש חזרה אחת לטעימה?",
      "האם הם מגיעים אליכם או אתם אליהם?",
      "מה התשלום אם יש איחור מהצד שלכם?",
    ],
    bring: [
      "תמונות look שאתם אוהבים",
      "ההילה / אקססוריז שתלבשו",
    ],
  },
  other: {
    questions: ["מה כלול בשירות?", "מה התנאים והמחיר?"],
    bring: ["שאלות אישיות שלכם"],
  },
};

/**
 * Generate the default checklist for a fresh appointment of `category`.
 * Returns a fresh array (callers can mutate without leaking state).
 */
export function buildChecklist(category: AppointmentCategory): ChecklistItem[] {
  const template =
    CHECKLIST_TEMPLATES[category] ?? CHECKLIST_TEMPLATES.other;
  return [
    ...template.questions.map((q, i) => ({
      id: `q-${i}`,
      label: q,
      checked: false,
      type: "question" as const,
    })),
    ...template.bring.map((b, i) => ({
      id: `b-${i}`,
      label: b,
      checked: false,
      type: "bring" as const,
    })),
  ];
}

/** Return { done, total } for a progress UI. */
export function checklistProgress(items: ChecklistItem[] | undefined | null): {
  done: number;
  total: number;
} {
  if (!Array.isArray(items)) return { done: 0, total: 0 };
  return {
    done: items.filter((i) => i.checked).length,
    total: items.length,
  };
}

/** Stable random id for user-added rows. */
export function newChecklistItemId(prefix: ChecklistItemType): string {
  return `${prefix === "question" ? "q" : "b"}-${Math.random().toString(36).slice(2, 8)}`;
}
