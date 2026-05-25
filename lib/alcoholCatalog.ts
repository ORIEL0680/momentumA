/**
 * R23 — preset bottle catalog for the alcohol calculator.
 *
 * Common bottles on Israeli supermarket / event-supplier shelves with
 * rough 2026 mid-tier prices. The host picks specific bottles, tweaks
 * quantity/price, and the calculator can cost the bar from the *actual*
 * selection instead of the per-category heuristic.
 *
 * Pure data + pure helpers. No React, no DOM.
 */

export type DrinkCategory = "wine" | "beer" | "spirits" | "soft";

export const DRINK_CATEGORY_LABELS: Record<DrinkCategory, string> = {
  wine: "יין",
  beer: "בירה",
  spirits: "אלכוהול חזק",
  soft: "משקאות קלים",
};

export interface CatalogBottle {
  id: string;
  category: DrinkCategory;
  /** Brand / maker — used to group the picker so the host chooses by
   *  company (גולדסטאר, אבסולוט, יקבי ברקן …). */
  brand: string;
  name: string;
  /** Estimated price for one container, ₪. */
  price: number;
  /** Servings the container yields (wine glasses, beer units, spirit
   *  pours, soft "servings" ≈ 0.33L each). */
  servings: number;
  /** Human label for the container. */
  unit: string;
  /** R120 — actual liquid volume of the container in liters. Surfaced
   *  on the picker so the host knows what they're committing to per
   *  click. E.g. a 700ml spirits bottle vs a 30L beer keg look very
   *  different here. */
  volumeLiters: number;
}

/** Curated, realistic Israeli options. Prices are deliberately round
 *  estimates — every one is editable in the UI. */
export const BOTTLE_CATALOG: CatalogBottle[] = [
  // ── Wine — by winery (750ml ≈ 5 glasses) ──
  { id: "wine-barkan-classic-red", category: "wine", brand: "ברקן", name: "ברקן קלאסיק קברנה (אדום)", price: 42, servings: 5, unit: "בקבוק 750 מ״ל", volumeLiters: 0.75 },
  { id: "wine-barkan-classic-white", category: "wine", brand: "ברקן", name: "ברקן קלאסיק שרדונה (לבן)", price: 42, servings: 5, unit: "בקבוק 750 מ״ל", volumeLiters: 0.75 },
  { id: "wine-carmel-selected-red", category: "wine", brand: "כרמל", name: "כרמל סלקטד קברנה", price: 39, servings: 5, unit: "בקבוק 750 מ״ל", volumeLiters: 0.75 },
  { id: "wine-recanati-red", category: "wine", brand: "רקנאטי", name: "רקנאטי אדום", price: 58, servings: 5, unit: "בקבוק 750 מ״ל", volumeLiters: 0.75 },
  { id: "wine-golan-red", category: "wine", brand: "רמת הגולן", name: "יקב רמת הגולן — אדום", price: 62, servings: 5, unit: "בקבוק 750 מ״ל", volumeLiters: 0.75 },
  { id: "wine-yarden-cab", category: "wine", brand: "ירדן", name: "ירדן קברנה סוביניון", price: 95, servings: 5, unit: "בקבוק 750 מ״ל", volumeLiters: 0.75 },
  { id: "wine-tabor-adama", category: "wine", brand: "תבור", name: "תבור אדמה", price: 55, servings: 5, unit: "בקבוק 750 מ״ל", volumeLiters: 0.75 },
  { id: "wine-yarden-brut", category: "wine", brand: "ירדן", name: "ירדן ברוט (מבעבע)", price: 110, servings: 6, unit: "בקבוק 750 מ״ל", volumeLiters: 0.75 },
  { id: "wine-freixenet-cava", category: "wine", brand: "Freixenet", name: "Freixenet קאווה (מבעבע)", price: 60, servings: 6, unit: "בקבוק 750 מ״ל", volumeLiters: 0.75 },

  // ── Beer — by brand ──
  { id: "beer-goldstar-330", category: "beer", brand: "גולדסטאר", name: "גולדסטאר — פחית 330 מ״ל", price: 6, servings: 1, unit: "פחית", volumeLiters: 0.33 },
  { id: "beer-maccabee-330", category: "beer", brand: "מכבי", name: "מכבי — פחית 330 מ״ל", price: 6, servings: 1, unit: "פחית", volumeLiters: 0.33 },
  { id: "beer-tuborg-330", category: "beer", brand: "טובורג", name: "טובורג — פחית 330 מ״ל", price: 7, servings: 1, unit: "פחית", volumeLiters: 0.33 },
  { id: "beer-carlsberg-330", category: "beer", brand: "קרלסברג", name: "קרלסברג — פחית 330 מ״ל", price: 7, servings: 1, unit: "פחית", volumeLiters: 0.33 },
  { id: "beer-heineken-330", category: "beer", brand: "Heineken", name: "Heineken — פחית 330 מ״ל", price: 8, servings: 1, unit: "פחית", volumeLiters: 0.33 },
  { id: "beer-weihenstephan", category: "beer", brand: "Weihenstephan", name: "Weihenstephan — בקבוק 500 מ״ל", price: 16, servings: 1, unit: "בקבוק", volumeLiters: 0.5 },
  { id: "beer-goldstar-keg", category: "beer", brand: "גולדסטאר", name: "גולדסטאר — חבית 30 ליטר", price: 620, servings: 90, unit: "חבית", volumeLiters: 30 },
  { id: "beer-tuborg-keg", category: "beer", brand: "טובורג", name: "טובורג — חבית 30 ליטר", price: 680, servings: 90, unit: "חבית", volumeLiters: 30 },

  // ── Spirits — by brand (700ml; pours ≈ 14 long) ──
  { id: "spirits-smirnoff", category: "spirits", brand: "Smirnoff", name: "וודקה Smirnoff", price: 90, servings: 14, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-absolut", category: "spirits", brand: "Absolut", name: "וודקה Absolut", price: 120, servings: 14, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-stoli", category: "spirits", brand: "Stolichnaya", name: "וודקה Stolichnaya", price: 105, servings: 14, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-greygoose", category: "spirits", brand: "Grey Goose", name: "וודקה Grey Goose", price: 220, servings: 14, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-jw-red", category: "spirits", brand: "Johnnie Walker", name: "Johnnie Walker Red", price: 110, servings: 14, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-jw-black", category: "spirits", brand: "Johnnie Walker", name: "Johnnie Walker Black", price: 180, servings: 14, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-chivas", category: "spirits", brand: "Chivas Regal", name: "Chivas Regal 12", price: 170, servings: 14, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-jameson", category: "spirits", brand: "Jameson", name: "Jameson", price: 130, servings: 14, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-jack", category: "spirits", brand: "Jack Daniel's", name: "Jack Daniel's", price: 150, servings: 14, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-arak-elite", category: "spirits", brand: "עלית", name: "ערק עלית", price: 50, servings: 16, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-gordons-gin", category: "spirits", brand: "Gordon's", name: "ג׳ין Gordon's", price: 95, servings: 14, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-bombay-gin", category: "spirits", brand: "Bombay Sapphire", name: "ג׳ין Bombay Sapphire", price: 140, servings: 14, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-olmeca", category: "spirits", brand: "Olmeca", name: "טקילה Olmeca", price: 130, servings: 16, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },
  { id: "spirits-cuervo", category: "spirits", brand: "Jose Cuervo", name: "טקילה Jose Cuervo", price: 150, servings: 16, unit: "בקבוק 700 מ״ל", volumeLiters: 0.7 },

  // ── Soft — by brand (1 "serving" ≈ 0.33L) ──
  { id: "soft-cola-1.5", category: "soft", brand: "Coca-Cola", name: "קוקה-קולה 1.5 ל׳", price: 9, servings: 4, unit: "בקבוק 1.5 ל׳", volumeLiters: 1.5 },
  { id: "soft-cola-zero", category: "soft", brand: "Coca-Cola", name: "קוקה-קולה זירו 1.5 ל׳", price: 9, servings: 4, unit: "בקבוק 1.5 ל׳", volumeLiters: 1.5 },
  { id: "soft-pepsi-1.5", category: "soft", brand: "Pepsi", name: "פפסי 1.5 ל׳", price: 8, servings: 4, unit: "בקבוק 1.5 ל׳", volumeLiters: 1.5 },
  { id: "soft-sprite-1.5", category: "soft", brand: "Sprite", name: "ספרייט 1.5 ל׳", price: 8, servings: 4, unit: "בקבוק 1.5 ל׳", volumeLiters: 1.5 },
  { id: "soft-prigat-juice", category: "soft", brand: "פריגת", name: "פריגת מיץ טבעי 1.5 ל׳", price: 13, servings: 4, unit: "בקבוק 1.5 ל׳", volumeLiters: 1.5 },
  { id: "soft-schweppes", category: "soft", brand: "Schweppes", name: "שוופס סודה 1.5 ל׳", price: 8, servings: 4, unit: "בקבוק 1.5 ל׳", volumeLiters: 1.5 },
  { id: "soft-neviot-1.5", category: "soft", brand: "נביעות", name: "מים מינרליים נביעות 1.5 ל׳", price: 5, servings: 4, unit: "בקבוק 1.5 ל׳", volumeLiters: 1.5 },
  { id: "soft-mei-eden", category: "soft", brand: "מי עדן", name: "מי עדן 1.5 ל׳", price: 6, servings: 4, unit: "בקבוק 1.5 ל׳", volumeLiters: 1.5 },
];

/** R120 — pretty-print the bottle's volume. Sub-1L shows as ml (less
 *  visual clutter for 330/500/700ml bottles); ≥1L shows as L (1.5 ל׳,
 *  30 ליטר). Keeps the picker pill compact even with the new column. */
export function formatVolume(liters: number): string {
  if (!Number.isFinite(liters) || liters <= 0) return "";
  if (liters < 1) return `${Math.round(liters * 1000)} מ״ל`;
  // Use ל׳ for typical small bottles, ליטר for kegs (≥ 5L).
  const suffix = liters >= 5 ? "ליטר" : "ל׳";
  // Avoid "1.50 ל׳" — trim trailing zeros.
  const value = Number.isInteger(liters)
    ? String(liters)
    : liters.toFixed(2).replace(/\.?0+$/, "");
  return `${value} ${suffix}`;
}

export function catalogByCategory(cat: DrinkCategory): CatalogBottle[] {
  return BOTTLE_CATALOG.filter((b) => b.category === cat);
}

/** Catalog for a category, grouped by brand (ordered, brands preserve
 *  first-seen order) — drives the brand-grouped picker UI. */
export function catalogByBrand(
  cat: DrinkCategory,
): Array<{ brand: string; bottles: CatalogBottle[] }> {
  const groups: Array<{ brand: string; bottles: CatalogBottle[] }> = [];
  for (const b of catalogByCategory(cat)) {
    let g = groups.find((x) => x.brand === b.brand);
    if (!g) {
      g = { brand: b.brand, bottles: [] };
      groups.push(g);
    }
    g.bottles.push(b);
  }
  return groups;
}

/** A line the user committed to: a catalog (or custom) bottle + qty +
 *  possibly edited price. */
export interface SelectedBottle {
  id: string;
  category: DrinkCategory;
  brand?: string;
  name: string;
  price: number; // editable
  servings: number; // editable
  unit: string;
  qty: number;
  /** R120 — volume per container in liters. Optional because legacy
   *  rows persisted in localStorage before this field existed; the UI
   *  treats `undefined` as "unknown — hide the badge". */
  volumeLiters?: number;
}

export interface CategoryCoverage {
  category: DrinkCategory;
  /** Servings the host needs for this category (from the heuristic). */
  needed: number;
  /** Servings the chosen bottles provide. */
  provided: number;
  /** ₪ of the chosen bottles. */
  cost: number;
  covered: boolean;
}

/** Coverage + cost per category from the user's explicit bottle picks. */
export function summarizeSelection(
  selected: SelectedBottle[],
  needByCategory: Record<DrinkCategory, number>,
): { byCategory: CategoryCoverage[]; totalCost: number } {
  const cats: DrinkCategory[] = ["wine", "beer", "spirits", "soft"];
  let totalCost = 0;
  const byCategory = cats.map((category) => {
    const lines = selected.filter((s) => s.category === category && s.qty > 0);
    const provided = lines.reduce((a, s) => a + s.servings * s.qty, 0);
    const cost = lines.reduce((a, s) => a + s.price * s.qty, 0);
    totalCost += cost;
    const needed = Math.ceil(needByCategory[category] || 0);
    return {
      category,
      needed,
      provided: Math.round(provided),
      cost: Math.round(cost),
      covered: provided >= needed,
    };
  });
  return { byCategory, totalCost: Math.round(totalCost) };
}
