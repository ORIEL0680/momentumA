"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";

/**
 * R140 — "Didn't get the code?" diagnostic panel.
 *
 * Renders below the signup steps when the user clicks "לא הגיע המייל / SMS?".
 * Calls /api/auth/diagnose (public — same data supabase-js itself fetches
 * on boot, no secrets exposed) and shows:
 *   • A red banner with the top 1-2 issues if any are detected
 *   • A collapsible checklist of every check we ran
 *   • The most actionable next step in Hebrew
 *
 * Why this is here rather than just printing to console: hosts who hit
 * "no code arrived" generally aren't going to open DevTools. Surfacing
 * the misconfiguration directly in the signup card means the founder
 * can also use this panel to verify their Supabase config without
 * leaving the app.
 */

interface DiagnoseResponse {
  ok: boolean;
  supabaseConfigured: boolean;
  siteUrlConfigured: boolean;
  deployedOrigin: string;
  providers?: {
    email: boolean;
    emailAutoconfirm: boolean;
    phone: boolean;
    phoneAutoconfirm: boolean;
    smsProvider: string | null;
    google: boolean;
    apple: boolean;
  };
  issues: string[];
  checklist: { id: string; label: string; ok: boolean | "unknown" }[];
}

export function DeliveryDiagnosticPanel({
  channel,
}: {
  /** Which delivery channel the user is currently waiting on. We show
   *  channel-specific actionable hints when this is set. */
  channel: "email" | "phone";
}) {
  // Initial state is loading=true / null data — the effect runs once
  // on mount and only writes state from the (already-async) fetch
  // callbacks, satisfying react-hooks/set-state-in-effect.
  const [data, setData] = useState<DiagnoseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/diagnose", { cache: "no-store" })
      .then(async (r) => {
        const json = (await r.json()) as DiagnoseResponse;
        if (cancelled) return;
        setData(json);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "השירות לא זמין כרגע.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="mt-4 rounded-2xl p-3 text-xs text-center inline-flex items-center justify-center gap-2 w-full"
        style={{
          background: "var(--input-bg)",
          border: "1px dashed var(--border)",
          color: "var(--foreground-muted)",
        }}
      >
        <Loader2 size={14} className="animate-spin" />
        בודק את הגדרות האימות...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="mt-4 rounded-2xl p-3 text-xs"
        style={{
          background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.3)",
          color: "rgb(252 165 165)",
        }}
      >
        לא הצלחנו לבדוק את הגדרות האימות. {error ?? "נסה לרענן את העמוד."}
      </div>
    );
  }

  // Pick the most-actionable hint for the user's current channel.
  const channelHint = pickChannelHint(channel, data);
  const hasIssues = data.issues.length > 0;

  return (
    <div
      className="mt-4 rounded-2xl p-3.5 text-start"
      style={{
        background: hasIssues
          ? "rgba(248,113,113,0.06)"
          : "rgba(52,211,153,0.05)",
        border: `1px solid ${
          hasIssues ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.25)"
        }`,
      }}
    >
      <div className="flex items-start gap-2.5">
        {hasIssues ? (
          <AlertTriangle
            size={16}
            className="shrink-0 mt-0.5"
            style={{ color: "rgb(252 165 165)" }}
          />
        ) : (
          <CheckCircle2
            size={16}
            className="shrink-0 mt-0.5"
            style={{ color: "rgb(110 231 183)" }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div
            className="text-xs font-bold"
            style={{
              color: hasIssues ? "rgb(252 165 165)" : "rgb(110 231 183)",
            }}
          >
            {hasIssues
              ? "מצאנו בעיה בהגדרות האימות"
              : "הגדרות האימות נראות תקינות"}
          </div>
          {channelHint && (
            <div
              className="mt-1.5 text-xs leading-relaxed"
              style={{ color: "var(--foreground-soft)" }}
            >
              {channelHint}
            </div>
          )}
          {hasIssues && data.issues.length > 0 && (
            <ul
              className="mt-2 space-y-1.5 text-[11px] leading-relaxed list-disc list-inside"
              style={{ color: "var(--foreground-soft)" }}
            >
              {data.issues.slice(0, 3).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 w-full text-[11px] inline-flex items-center justify-center gap-1 py-1.5 rounded-lg"
        style={{
          color: "var(--foreground-muted)",
          background: "rgba(0,0,0,0.18)",
        }}
        aria-expanded={expanded}
      >
        <ChevronDown
          size={12}
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 200ms ease",
          }}
        />
        {expanded ? "הסתר פירוט" : "הראה רשימת בדיקות מלאה"}
      </button>

      {expanded && (
        <ul
          className="mt-2.5 space-y-1.5 text-[11px]"
          style={{ color: "var(--foreground-muted)" }}
        >
          {data.checklist.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span
                className="inline-flex w-4 h-4 rounded-full items-center justify-center shrink-0"
                style={{
                  background:
                    c.ok === true
                      ? "rgba(52,211,153,0.15)"
                      : c.ok === false
                        ? "rgba(248,113,113,0.15)"
                        : "rgba(255,255,255,0.05)",
                  color:
                    c.ok === true
                      ? "rgb(110 231 183)"
                      : c.ok === false
                        ? "rgb(252 165 165)"
                        : "var(--foreground-muted)",
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {c.ok === true ? "✓" : c.ok === false ? "✕" : "?"}
              </span>
              <span className="flex-1">{c.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Channel-specific actionable hint. Reads the diagnostic flags and
 * returns the single sentence the host should act on first — picking
 * from a small set of well-known failure modes.
 */
function pickChannelHint(
  channel: "email" | "phone",
  data: DiagnoseResponse,
): string | null {
  if (!data.providers) return null;
  const p = data.providers;
  if (channel === "email") {
    if (!p.email) {
      return "ספק האימות במייל סגור ב-Supabase. הפעל אותו בלוח הבקרה תחת Auth → Providers → Email.";
    }
    if (p.emailAutoconfirm) {
      return "Supabase מוגדר ב-mailer_autoconfirm — הוא לא שולח מייל אישור בכלל. כבה את האפשרות תחת Auth → Email.";
    }
    return "המייל אמור להיות בדרך. אם לא הגיע תוך 2 דקות — בדוק תיקיית ספאם / קידום מכירות. רוב הבעיות בקבלת המייל קשורות ל-SMTP ברירת המחדל של Supabase (4 מיילים לשעה בלבד) — מומלץ לחבר Resend או SendGrid תחת Project Settings → Auth → SMTP.";
  }
  if (channel === "phone") {
    if (!p.phone) {
      return "אימות בטלפון לא מופעל ב-Supabase. הפעל אותו תחת Auth → Providers → Phone.";
    }
    if (!p.smsProvider) {
      return "אימות בטלפון מופעל אבל ללא ספק SMS (Twilio). חבר חשבון Twilio תחת Auth → Phone כדי שה-SMS באמת יישלח.";
    }
    if (p.phoneAutoconfirm) {
      return "Supabase מוגדר ב-phone_autoconfirm — הוא לא שולח SMS בכלל. כבה את האפשרות תחת Auth → Phone.";
    }
    return "ה-SMS אמור להיות בדרך. אם לא הגיע — ודא שיש יתרה בחשבון Twilio שלך והמספר תקין (+972...).";
  }
  return null;
}
