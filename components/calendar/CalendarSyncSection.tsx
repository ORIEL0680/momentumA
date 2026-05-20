"use client";

import { useEffect, useState } from "react";
import { Calendar, Copy, RefreshCw, Loader2, Check } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";

/**
 * R68 (R57) — settings UI for Google / Apple Calendar sync.
 *
 * Renders a copy-able URL backed by the user's sync token, plus a
 * rotate button that revokes the previous subscription. Rendered
 * inside /settings.
 */
export function CalendarSyncSection() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute the public ICS URL — site-relative so dev/preview hosts
  // produce the right link automatically.
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const url = token ? `${origin}/api/calendar/ics/${token}` : "";

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) {
          setError("Supabase לא מוגדר.");
          setLoading(false);
          return;
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError("יש להתחבר כדי לקבל לינק.");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/calendar/sync-token", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = (await res.json().catch(() => ({}))) as {
          token?: string;
          error?: string;
        };
        if (!active) return;
        if (!res.ok || !data.token) {
          setError(data.error ?? "שגיאה בטעינת לינק");
        } else {
          setToken(data.token);
        }
      } catch {
        if (active) setError("שגיאת רשת");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const copyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast("הלינק הועתק ✓", "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("ההעתקה נכשלה — סמן וגזור ידנית", "error");
    }
  };

  const rotate = async () => {
    if (busy) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "ייצור לינק חדש יבטל את הלינק הקיים — כל מי שיש לו אותו יאבד גישה. להמשיך?",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        showToast("Supabase לא מוגדר", "error");
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showToast("יש להתחבר מחדש", "error");
        return;
      }
      const res = await fetch("/api/calendar/sync-token", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.token) {
        showToast(data.error ?? "שגיאה ביצירת לינק חדש", "error");
        return;
      }
      setToken(data.token);
      showToast("נוצר לינק חדש ✓", "success");
    } catch {
      showToast("שגיאת רשת", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--foreground-soft)" }}
      >
        העתיקו את הלינק הזה והדביקו אותו ביישומון לוח השנה שלכם:
      </p>
      <ul
        className="text-xs space-y-1 ps-5"
        style={{ color: "var(--foreground-muted)", listStyleType: "disc" }}
      >
        <li>
          <strong>Google Calendar:</strong> Settings → Add calendar → From URL
        </li>
        <li>
          <strong>Apple Calendar:</strong> File → New Calendar Subscription
        </li>
      </ul>

      <div
        className="rounded-xl p-3 ltr-num text-xs font-mono break-all"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--border)",
          color: loading || error ? "var(--foreground-muted)" : "var(--foreground)",
          minHeight: "2.5rem",
        }}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" aria-hidden /> טוען…
          </span>
        ) : error ? (
          error
        ) : (
          url
        )}
      </div>

      {!loading && !error && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyUrl}
            className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check size={14} aria-hidden /> הועתק
              </>
            ) : (
              <>
                <Copy size={14} aria-hidden /> העתיקו לינק
              </>
            )}
          </button>
          <button
            type="button"
            onClick={rotate}
            disabled={busy}
            className="text-sm py-2 px-3 inline-flex items-center gap-2 disabled:opacity-50"
            style={{ color: "var(--foreground-muted)" }}
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw size={13} aria-hidden />
            )}
            ייצור לינק חדש
          </button>
        </div>
      )}

      <p
        className="text-xs"
        style={{ color: "var(--foreground-muted)" }}
      >
        ⚠️ הלינק אישי וסודי — אל תשלחו אותו לאף אחד. אם הוא דלף, לחצו
        &quot;ייצור לינק חדש&quot;.
      </p>
    </div>
  );
}

/** Section icon — useful for Settings page mapping. */
export const CalendarSyncSectionIcon = Calendar;
