/**
 * R67 (R56) — quick-pick templates for the AppointmentSheet dropdown.
 *
 * Picking a template auto-fills title, category, duration, icon. The
 * "custom" entry leaves all fields empty so the user can fill freely.
 *
 * Categories MUST match the CHECK constraint in
 * `supabase/migrations/2026-05-20-calendar-appointments.sql`.
 */

import type { AppointmentCategory } from "./wedding-brain";

export interface AppointmentTemplate {
  id: string;
  label: string;
  title: string;
  category: AppointmentCategory;
  /** Default duration in minutes. */
  duration: number;
  icon: string;
}

export const APPOINTMENT_TEMPLATES: AppointmentTemplate[] = [
  {
    id: "venue-tasting",
    label: "טעימה באולם",
    title: "טעימה באולם",
    category: "catering",
    duration: 120,
    icon: "🥂",
  },
  {
    id: "dj-meeting",
    label: "פגישה עם DJ",
    title: "פגישה עם DJ",
    category: "dj",
    duration: 60,
    icon: "🎵",
  },
  {
    id: "photographer-meeting",
    label: "פגישה עם צלם",
    title: "פגישה עם צלם",
    category: "photo",
    duration: 90,
    icon: "📸",
  },
  {
    id: "makeup-trial",
    label: "פגישה עם מאפרת",
    title: "פגישה עם מאפרת",
    category: "hair",
    duration: 90,
    icon: "💄",
  },
  {
    id: "dress-fitting",
    label: "מדידת שמלה",
    title: "מדידת שמלה",
    category: "dress",
    duration: 60,
    icon: "👗",
  },
  {
    id: "catering-meeting",
    label: "פגישת קייטרינג",
    title: "פגישת קייטרינג",
    category: "catering",
    duration: 90,
    icon: "🍽",
  },
  {
    id: "venue-closing",
    label: "סגירת אולם",
    title: "סגירת אולם",
    category: "venue",
    duration: 120,
    icon: "🏛",
  },
  {
    id: "florist-meeting",
    label: "פגישת מעצב פרחים",
    title: "פגישת מעצב פרחים",
    category: "flowers",
    duration: 60,
    icon: "🌹",
  },
  {
    id: "custom",
    label: "מותאם אישית…",
    title: "",
    category: "other",
    duration: 60,
    icon: "📝",
  },
];

/** Stable color per category — kept in sync with the calendar legend. */
export const CATEGORY_COLORS: Record<AppointmentCategory, string> = {
  venue: "#D4B068",
  catering: "#FFB05E",
  photo: "#9BC8E8",
  dj: "#C29BE8",
  flowers: "#E8889B",
  dress: "#E8A4C5",
  hair: "#E8BE6E",
  personal: "#9BE8B0",
  milestone: "#F4DEA9",
  other: "#A8A8B8",
};
