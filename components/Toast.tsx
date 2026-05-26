"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

/**
 * Minimal in-process toast system.
 *
 * Why local state instead of a library:
 *  - Zero dependencies kept (we already have lucide + framer-motion).
 *  - Renders RTL correctly with the rest of the app.
 *  - Auto-dismisses after 3.5s by default; no provider/context needed
 *    because every invocation goes through the module-level
 *    `showToast` function which fires a CustomEvent that a
 *    `<ToastHost />` instance listens to.
 *
 * R127 — added optional `action` (button label + handler) and
 * `duration` (ms) so destructive one-click flows can offer "Undo"
 * inside the toast. Used by /admin/vendors delete: the modal is
 * gone, the row vanishes immediately, and the admin has a few
 * seconds to undo from the toast.
 *
 * Usage:
 *   import { ToastHost, showToast } from "@/components/Toast";
 *   // mount <ToastHost /> once near the root (already done in app/layout.tsx)
 *   showToast("הנתונים יובאו בהצלחה", "success");
 *   showToast("נמחק", "success", {
 *     duration: 8000,
 *     action: { label: "בטל", onClick: () => restore() },
 *   });
 */

type ToastKind = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  /** Auto-dismiss in ms. Defaults to 3500. */
  duration?: number;
  /** Optional inline action button (e.g. Undo). Toast dismisses when clicked. */
  action?: ToastAction;
}

interface ToastEvent {
  id: string;
  message: string;
  kind: ToastKind;
  duration: number;
  action?: ToastAction;
}

const EVENT_NAME = "momentum:toast";

export function showToast(
  message: string,
  kind: ToastKind = "info",
  opts?: ToastOptions,
) {
  if (typeof window === "undefined") return;
  const detail: ToastEvent = {
    id: crypto.randomUUID(),
    message,
    kind,
    duration: opts?.duration ?? 3500,
    action: opts?.action,
  };
  window.dispatchEvent(new CustomEvent<ToastEvent>(EVENT_NAME, { detail }));
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastEvent[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastEvent>).detail;
      setToasts((prev) => [...prev, detail]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== detail.id));
      }, detail.duration);
    };
    window.addEventListener(EVENT_NAME, onToast);
    return () => window.removeEventListener(EVENT_NAME, onToast);
  }, []);

  if (toasts.length === 0) return null;

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div
      // R125 — was pinned 96px from bottom to clear the MobileBottomNav.
      // Bottom nav removed → toasts now sit 1.5rem from the viewport
      // edge on every breakpoint. Safe-area inset still respected for
      // notched devices.
      className="fixed inset-x-0 mx-auto z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none no-print bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-2xl px-5 py-3 text-sm shadow-2xl flex items-center gap-3 fade-up max-w-md w-full"
          style={{
            background:
              t.kind === "success"
                ? "rgba(52,211,153,0.15)"
                : t.kind === "error"
                  ? "rgba(248,113,113,0.15)"
                  : "var(--input-bg)",
            border: `1px solid ${
              t.kind === "success"
                ? "rgba(52,211,153,0.4)"
                : t.kind === "error"
                  ? "rgba(248,113,113,0.4)"
                  : "var(--border-strong)"
            }`,
            color:
              t.kind === "success"
                ? "rgb(110,231,183)"
                : t.kind === "error"
                  ? "rgb(252,165,165)"
                  : "var(--foreground)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {t.kind === "success" ? (
            <CheckCircle2 size={18} className="shrink-0" />
          ) : t.kind === "error" ? (
            <AlertCircle size={18} className="shrink-0" />
          ) : (
            <Info size={18} className="shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.onClick();
                dismiss(t.id);
              }}
              className="text-xs font-bold px-3 py-1 rounded-full transition hover:bg-white/10"
              style={{
                color: "inherit",
                border: "1px solid currentColor",
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
