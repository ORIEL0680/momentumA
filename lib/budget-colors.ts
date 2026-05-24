import type { BudgetCategory } from "@/lib/types";

/**
 * R76 — unified color palette for all calculator breakdowns.
 * Using design-token-adjacent hex values that sit within the gold/warm palette.
 */
export const BUDGET_CATEGORY_COLORS: Record<BudgetCategory, string> = {
  venue: "#D4B068", // gold
  catering: "#E8B4B8", // rose-gold
  photography: "#A8884A", // deep gold
  music: "#7CB9E8", // sky blue
  flowers: "#FFB6C1", // light rose
  decoration: "#B8784A", // bronze
  attire: "#D89BA0", // rose-cream
  invitations: "#C9A961", // warm gold
  transportation: "#5A7A4A", // green
  other: "#80745A", // neutral warm
};

export function getCategoryColor(cat: string): string {
  return (
    BUDGET_CATEGORY_COLORS[cat as BudgetCategory] ??
    BUDGET_CATEGORY_COLORS.other
  );
}
