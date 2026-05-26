"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Heart } from "lucide-react";

/**
 * R81-12 — `CompareBar` removed. It was the last consumer of the
 * `/compare` route, which was deleted in R71 (R60-6). Clicking the
 * "פתח השוואה" button rendered a 404. The component was no longer
 * imported anywhere in the app — `app/vendors/page.tsx` only uses
 * `SelectedBar` (the sibling export, kept). Removing CompareBar
 * eliminates the dead route reference and trims the bundle.
 */

interface SelectedBarProps {
  count: number;
}

const SLIDE_TRANSITION = { type: "spring" as const, stiffness: 380, damping: 32 };

export function SelectedBar({ count }: SelectedBarProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      key="selected-bar"
      initial={reducedMotion ? false : { y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reducedMotion ? undefined : { y: 80, opacity: 0 }}
      transition={SLIDE_TRANSITION}
      className="glass-strong rounded-full flex items-center justify-between px-3 py-2 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.7)] border border-white/15"
      role="region"
      aria-label="ספקים שמורים"
    >
      <div className="flex items-center gap-3 px-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F4DEA9] to-[#A8884A] text-black flex items-center justify-center font-bold text-sm ltr-num" aria-hidden>
          {count}
        </div>
        <div className="text-sm">
          <div className="font-semibold inline-flex items-center gap-1.5">
            <Heart size={12} className="text-[--accent]" fill="currentColor" aria-hidden />
            ספקים נבחרו
          </div>
          <div className="text-xs text-white/55">המשך לתקציב כדי לבדוק את העלות</div>
        </div>
      </div>
      <Link
        href="/budget"
        className="btn-gold text-sm py-2 px-5 inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
        aria-label="המשך לעמוד התקציב"
      >
        המשך לתקציב
        <ArrowRight size={14} aria-hidden />
      </Link>
    </motion.div>
  );
}
