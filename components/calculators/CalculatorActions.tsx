"use client";

import { useState } from "react";
import { Save, Share2, GitCompare, Printer } from "lucide-react";
import { ScenariosCompare } from "./ScenariosCompare";
import { actions } from "@/lib/store";
import { showToast } from "@/components/Toast";
import type { BreakdownItem } from "./CalculatorResults";
import type { BudgetCategory } from "@/lib/types";

interface Props {
  result: { total: number; breakdown: BreakdownItem[] };
  calculatorName: string;
  /** Pass the event id if available; the save button is still shown but will
   *  show an info toast if empty (not all users have set up an event yet). */
  eventId?: string;
}

interface SavedScenario {
  id: number;
  total: number;
  breakdown: BreakdownItem[];
  savedAt: string;
}

/** Best-effort category mapping — keeps the breakdown aligned with the
 *  budget category enum so the budget page can group items correctly. */
const NAME_TO_CATEGORY: Record<string, BudgetCategory> = {
  // Hebrew labels from breakdowns
  "אולם": "venue",
  "קייטרינג": "catering",
  "צילום": "photography",
  "מוזיקה": "music",
  "DJ": "music",
  "פרחים": "flowers",
  "עיצוב": "decoration",
  "לבוש": "attire",
  "הזמנות": "invitations",
  "הסעות": "transportation",
  // English fallbacks
  venue: "venue",
  catering: "catering",
  photography: "photography",
  music: "music",
  flowers: "flowers",
  decoration: "decoration",
  attire: "attire",
  invitations: "invitations",
  transportation: "transportation",
};

function mapCategory(name: string): BudgetCategory {
  return NAME_TO_CATEGORY[name] ?? "other";
}

export function CalculatorActions({ result, calculatorName }: Props) {
  const [showCompare, setShowCompare] = useState(false);
  const storageKey = `momentum.scenarios.${calculatorName}`;

  const handleSaveToBudget = () => {
    const items = result.breakdown.filter((b) => b.value > 0);
    if (items.length === 0) {
      showToast("אין נתונים לשמירה — מלאו ערכים קודם", "info");
      return;
    }
    items.forEach((b) => {
      actions.addBudgetItem({
        category: mapCategory(b.category),
        title: b.category,
        estimated: b.value,
      });
    });
    showToast(`✓ ${items.length} סעיפים נוספו לתקציב`, "success");
  };

  const handleShare = async () => {
    const text =
      `🎯 חישבתי את ${calculatorName} עבור האירוע שלנו:\n\n` +
      `סה"כ משוער: ₪${result.total.toLocaleString("he-IL")}\n\n` +
      `פירוט מלא ב-Momentum: https://moomentum.events`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "החישוב שלי", text });
      } catch {
        // user cancelled — silent
      }
    } else {
      const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank", "noopener,noreferrer");
    }
  };

  const handleCompare = () => {
    let saved: SavedScenario[] = [];
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      /* corrupt data — start fresh */
    }
    saved.push({
      id: Date.now(),
      total: result.total,
      breakdown: result.breakdown,
      savedAt: new Date().toISOString(),
    });
    const trimmed = saved.slice(-3); // keep last 3
    try {
      localStorage.setItem(storageKey, JSON.stringify(trimmed));
    } catch {
      /* private mode / quota — ignore */
    }
    showToast(
      trimmed.length > 1
        ? `✓ תרחיש נשמר — ${trimmed.length}/3 תרחישים בהשוואה`
        : "✓ תרחיש ראשון נשמר — הוסיפו עוד אחד להשוואה",
      "success",
    );
    // Open comparison modal
    setShowCompare(true);
  };

  const handlePrint = () => window.print();

  return (
    <>
      <div
        className="grid grid-cols-2 gap-3 mt-8 pt-6 no-print"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button onClick={handleSaveToBudget} className="action-btn primary">
          <Save className="w-4 h-4" aria-hidden />
          שמור לתקציב
        </button>
        <button onClick={handleShare} className="action-btn">
          <Share2 className="w-4 h-4" aria-hidden />
          שלח לבן/בת זוג
        </button>
        <button onClick={handleCompare} className="action-btn">
          <GitCompare className="w-4 h-4" aria-hidden />
          השווה תרחישים
        </button>
        <button onClick={handlePrint} className="action-btn">
          <Printer className="w-4 h-4" aria-hidden />
          הדפס PDF
        </button>
      </div>
      {showCompare && (
        <ScenariosCompare
          storageKey={storageKey}
          onClose={() => setShowCompare(false)}
        />
      )}
    </>
  );
}
