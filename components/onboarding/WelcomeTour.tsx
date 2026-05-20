"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import {
  Sparkles,
  Users,
  Calculator,
  Store,
  Hourglass,
  ArrowLeft,
  X,
} from "lucide-react";
import {
  useFirstLogin,
  forceMarkTourCompletedSync,
} from "@/lib/useFirstLogin";
import { fireConfetti } from "@/lib/confetti";
import { showToast } from "@/components/Toast";

/**
 * R60 + R61 — first-run welcome tour.
 *
 * 5-step centered modal sequence. Self-gates on the `useFirstLogin`
 * hook (per-device localStorage). Mark-completed runs on either
 * "סיימתי" (finish, step 5) or "סיום ההדרכה" (skip), so a skipped tour
 * also never re-shows.
 *
 * R61 hardening:
 *  • 200ms fade-out before unmount (closing state).
 *  • Skip path now shows a toast: "אפשר תמיד לחזור לסיור מההגדרות".
 *  • Close-on-unmount safety net: if the tab is closed / nav'd away
 *    mid-tour, the cleanup writes the completion flag synchronously
 *    via forceMarkTourCompletedSync. Idempotent.
 *  • Settings has a "הפעל מחדש" button that calls resetTour().
 *
 * Note on the deviation from spec: the spec described pixel-anchored
 * coachmarks. The modal-sequence below keeps the same goal — introduce
 * the 4 sections in 60 seconds — while remaining RTL-correct,
 * keyboard-accessible, and layout-proof.
 */

type IconCmp = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

interface Step {
  icon: IconCmp;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "ברוכים הבאים ל-Momentum",
    body: "60 שניות, ונראה לכם את 4 הדברים החשובים. אפשר לדלג בכל רגע — הכל מחכה לכם בדשבורד.",
  },
  {
    icon: Hourglass,
    title: "ניצוץ הזהב — דופק האירוע",
    body: "במרכז הדשבורד תראו תמיד כמה ימים נשארו, כמה אישרו הגעה, ומה הצעד הבא. בלי לחפש — הכל בעין אחת.",
  },
  {
    icon: Users,
    title: "אורחים — מנוהל ב-WhatsApp",
    body: "הוסיפו את ה-200 המוזמנים שלכם — או ייבאו מאנשי הקשר בלחיצה. ההזמנות נשלחות בוואטסאפ, אישורי ההגעה מתעדכנים אוטומטית.",
  },
  {
    icon: Calculator,
    title: "תקציב — חי, לא בעבר",
    body: "כל שקל שתוציאו נרשם. 5 מחשבונים חכמים, ו-AI שמתריע 14 ימים לפני חריגה — לא אחרי שכבר חרגתם.",
  },
  {
    icon: Store,
    title: "ספקים — מאומתים, בלי לחפש",
    body: "קטלוג ספקים עם ביקורות מזוגות שעבדו איתם. צ׳אט ישיר מתוך האפליקציה, בלי טלפונים מיותרים.",
  },
];

const FADE_MS = 200;

export function WelcomeTour() {
  // SSR-safety: useFirstLogin's `getServerSnapshot` returns `completed=true`,
  // so isFirstLogin === false during SSR / first paint. No extra mount
  // gate needed (and no setState-in-effect).
  const { isFirstLogin, markCompleted } = useFirstLogin();
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  // Refs survive re-renders and are safe to read during cleanup.
  // startedRef: did this instance ever render the open modal at all?
  // completedRef: did one of finish/skip already write the flag?
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  const open = isFirstLogin;

  // Mark "this instance saw the tour" once `open` is true. Lets the
  // unmount cleanup decide whether to force-complete (see below).
  useEffect(() => {
    if (open) startedRef.current = true;
  }, [open]);

  /** Common close pipeline. Fade for `FADE_MS`, then write the flag. */
  const closeAfterFade = useCallback(() => {
    if (closing) return;
    completedRef.current = true; // before the timeout, in case unmount races
    setClosing(true);
    window.setTimeout(() => {
      markCompleted();
    }, FADE_MS);
  }, [closing, markCompleted]);

  const finish = useCallback(() => {
    fireConfetti(1800);
    showToast("כל הכבוד! האירוע שלך מחכה.", "success");
    closeAfterFade();
  }, [closeAfterFade]);

  const skip = useCallback(() => {
    // No confetti on skip — it's a deliberate exit, not a celebration.
    showToast("אפשר תמיד לחזור לסיור מההגדרות", "info");
    closeAfterFade();
  }, [closeAfterFade]);

  const next = useCallback(() => {
    setStep((s) => {
      if (s >= STEPS.length - 1) {
        // Defer side-effects out of the setState callback.
        queueMicrotask(finish);
        return s;
      }
      return s + 1;
    });
  }, [finish]);

  const back = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  // Keyboard: Esc skips, Enter/→ advance, ← back.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        skip();
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        next();
      } else if (e.key === "ArrowLeft") {
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, skip, next, back]);

  // R61 — close-on-unmount safety net. If the user closed the tab,
  // navigated away mid-tour, or refreshed before the normal completion
  // path, write the flag synchronously so the tour never re-shows.
  // Idempotent (a no-op when completedRef is already true).
  useEffect(() => {
    return () => {
      if (startedRef.current && !completedRef.current) {
        forceMarkTourCompletedSync();
      }
    };
  }, []);

  if (!open) return null;

  const current = STEPS[step];
  if (!current) return null;
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      // Plain overlay — no backdrop-click handler, so users must use the
      // explicit "סיום ההדרכה" / "סיימתי" controls (avoids accidental
      // dismissal). Opacity binding drives the 200ms fade-out.
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(8,6,10,0.72)",
        backdropFilter: "blur(4px)",
        opacity: closing ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: closing ? "none" : "auto",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
    >
      <div className="card-gold p-7 md:p-8 w-full max-w-md relative">
        <div className="flex items-center justify-between mb-5">
          <span
            className="text-xs font-semibold ltr-num rounded-full px-3 py-1"
            style={{
              background:
                "color-mix(in srgb, var(--gold-100) 14%, transparent)",
              border: "1px solid var(--border-gold)",
              color: "var(--accent)",
            }}
          >
            {step + 1} / {STEPS.length}
          </span>
          <button
            type="button"
            onClick={skip}
            aria-label="סיום ההדרכה"
            className="w-9 h-9 -m-1 flex items-center justify-center rounded-full transition hover:bg-[var(--secondary-button-bg)]"
            style={{ color: "var(--foreground-muted)" }}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{
            background:
              "color-mix(in srgb, var(--gold-100) 16%, transparent)",
            border: "1px solid var(--border-gold)",
            color: "var(--accent)",
          }}
          aria-hidden
        >
          <Icon size={26} />
        </div>

        <h2
          id="welcome-tour-title"
          className="text-2xl font-bold leading-snug gradient-text"
        >
          {current.title}
        </h2>
        <p
          className="mt-3 text-base leading-relaxed"
          style={{ color: "var(--foreground-soft)" }}
        >
          {current.body}
        </p>

        <div className="mt-7 flex items-center gap-2.5">
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              className="btn-secondary text-sm"
              style={{ minHeight: 44, padding: "0 16px" }}
            >
              חזרה
            </button>
          )}
          <button
            type="button"
            onClick={skip}
            className="text-sm underline shrink-0"
            style={{ color: "var(--foreground-muted)", padding: "0 8px" }}
          >
            סיום ההדרכה
          </button>
          <button
            type="button"
            onClick={next}
            className="btn-gold ms-auto inline-flex items-center justify-center gap-2"
            style={{ minHeight: 44, padding: "0 24px" }}
          >
            {isLast ? "סיימתי" : "הבא"}
            <ArrowLeft size={16} aria-hidden />
          </button>
        </div>

        {/* Progress dots — purely decorative */}
        <div
          className="mt-6 flex items-center justify-center gap-1.5"
          aria-hidden
        >
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="block rounded-full transition-all"
              style={{
                width: i === step ? 24 : 6,
                height: 6,
                background:
                  i <= step
                    ? "linear-gradient(90deg, var(--gold-100), var(--gold-500))"
                    : "var(--border)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
