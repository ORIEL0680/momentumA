"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * R64 (R54) — PWA install prompt.
 *
 * Three render paths:
 *   1. Android / Chromium → catches `beforeinstallprompt`, shows
 *      a card with an explicit "התקן" button that calls .prompt().
 *   2. iOS Safari (no BIP event) → manual "Add to Home Screen" hint.
 *   3. Already installed (`display-mode: standalone`) → render null.
 *
 * Dismissal is sticky for 7 days via localStorage so we don't nag.
 * Designed to be mounted on /dashboard only (the spec gates this to
 * signed-in users), so anonymous landing-page visitors never see it.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "momentum.install.dismissed.v1";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function readStandalone(): boolean {
  if (typeof window === "undefined") return true; // SSR — never render
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ?? false
    );
  } catch {
    return false;
  }
}

function readIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Bare-bones iOS detection. Excludes Chrome/Firefox on iOS (they use
  // the system WebView and don't get the standalone install path).
  return /iPhone|iPad|iPod/.test(ua) && !/(CriOS|FxiOS)/.test(ua);
}

function readDismissed(): boolean {
  if (typeof window === "undefined") return true; // SSR — don't render
  try {
    const at = window.localStorage.getItem(DISMISS_KEY);
    if (!at) return false;
    return Date.now() - Number(at) < DISMISS_MS;
  } catch {
    return false;
  }
}

export function InstallPWA() {
  // All three flags are derivable synchronously at construction → lazy
  // init keeps us off the setState-in-effect lint rule, and there's no
  // hydration mismatch because the server snapshots all say "don't
  // render" (SSR returns true for standalone/dismissed → null).
  const [standalone] = useState(readStandalone);
  const [ios] = useState(readIOS);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      // Block Chrome's default mini-infobar; we render our own.
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (standalone || dismissed) return null;

  const handleDismiss = () => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      }
    } catch {
      /* private mode / quota — fall back to in-memory dismissal only */
    }
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        track("pwa_installed", { platform: "android" });
      }
    } catch {
      /* user closed the system dialog; nothing to do */
    }
    setPromptEvent(null);
    handleDismiss();
  };

  // iOS doesn't fire beforeinstallprompt; show a manual hint.
  if (ios && !promptEvent) {
    return (
      <div
        className="fixed bottom-4 inset-x-4 z-50 card-gold p-4 shadow-2xl"
        role="dialog"
        aria-labelledby="install-pwa-title"
      >
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="סגור"
          className="absolute top-2 end-2 w-9 h-9 -m-1 flex items-center justify-center rounded-full transition hover:bg-[var(--secondary-button-bg)]"
          style={{ color: "var(--foreground-muted)" }}
        >
          <X size={16} aria-hidden />
        </button>
        <div className="flex items-center gap-3 pe-8">
          <div className="text-3xl shrink-0" aria-hidden>
            💍
          </div>
          <div className="flex-1 min-w-0">
            <div id="install-pwa-title" className="font-bold text-sm">
              התקינו את Momentum על האייפון
            </div>
            <div
              className="text-xs mt-1 leading-relaxed"
              style={{ color: "var(--foreground-soft)" }}
            >
              לחצו על{" "}
              <span className="font-bold" aria-hidden>
                ⬆️
              </span>{" "}
              בתחתית ה-Safari → &quot;הוסף למסך הבית&quot;.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android / Chromium: only show once we caught the BIP event.
  if (!promptEvent) return null;

  return (
    <div
      className="fixed bottom-4 inset-x-4 z-50 card-gold p-4 shadow-2xl"
      role="dialog"
      aria-labelledby="install-pwa-title-cta"
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl shrink-0" aria-hidden>
          💍
        </div>
        <div className="flex-1 min-w-0">
          <div id="install-pwa-title-cta" className="font-bold text-sm">
            התקינו את Momentum על הטלפון
          </div>
          <div
            className="text-xs mt-1"
            style={{ color: "var(--foreground-soft)" }}
          >
            גישה מהירה ועובד גם כשהקליטה חלשה.
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs px-3 py-2 opacity-70 shrink-0"
        >
          לא עכשיו
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="btn-gold inline-flex items-center gap-1.5 shrink-0"
          style={{ padding: "0.5rem 0.9rem", fontSize: "0.85rem" }}
        >
          <Download size={14} aria-hidden /> התקן
        </button>
      </div>
    </div>
  );
}
