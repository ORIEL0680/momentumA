"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";

/**
 * R113 — host-side diagnostic panel for "did Momentum actually deliver
 * my invitations?".
 *
 * Collapsed by default — doesn't shout at the host when things are
 * fine. Expand to fetch the last 20 messages this Twilio account
 * sent on the whatsapp: channel, then renders each with the real
 * Twilio delivery status (queued / sent / delivered / read /
 * undelivered / failed) and the Twilio error code when present.
 *
 * Why we need this: Twilio's REST messages.create() resolves with
 * status="queued" the moment the API call succeeds. That looks like
 * success in the bulk-send modal, but the message might never reach
 * the recipient — most commonly because the WhatsApp template hasn't
 * been approved by Meta yet, or the recipient hasn't opted into
 * marketing templates. Both fail silently from the client's POV.
 */

interface MessageStatus {
  sid: string;
  to: string;
  from: string;
  body?: string;
  status: string;
  errorCode?: number | null;
  errorMessage?: string | null;
  dateCreated?: string;
  dateUpdated?: string;
}

export function WhatsAppDeliveryPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageStatus[]>([]);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setError("supabase_not_configured");
        return;
      }
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setError("auth");
        return;
      }
      const res = await fetch("/api/whatsapp/status?limit=20", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        messages?: MessageStatus[];
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "fetch_failed");
        return;
      }
      setMessages(body.messages ?? []);
      setLastFetched(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "network");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      // First open → auto-fetch so the host doesn't need a second click.
      if (next && messages.length === 0 && !loading) {
        void fetchStatus();
      }
      return next;
    });
  };

  // Derive a quick summary so even before the user expands the panel
  // they can spot trouble (3 failed / 17 OK, e.g.).
  const summary = summarize(messages);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "color-mix(in srgb, var(--gold-100) 4%, var(--surface-2))",
        border: "1px solid var(--border-gold)",
      }}
    >
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center gap-3 px-4 py-3 text-start transition hover:bg-white/[0.03]"
        aria-expanded={open}
      >
        <div
          className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0"
          style={{
            background: "rgba(212,176,104,0.12)",
            border: "1px solid var(--border-gold)",
            color: "var(--accent)",
          }}
        >
          <Activity size={16} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">סטטוס מסירת WhatsApp</div>
          <div
            className="text-xs mt-0.5"
            style={{ color: "var(--foreground-muted)" }}
          >
            {messages.length === 0
              ? "לחץ כדי לבדוק מה קרה ל-20 ההזמנות האחרונות"
              : summary.headline}
          </div>
        </div>
        {messages.length > 0 && (
          <SummaryDots summary={summary} />
        )}
        <ChevronDown
          size={16}
          className="transition-transform shrink-0"
          style={{
            color: "var(--foreground-muted)",
            transform: open ? "rotate(180deg)" : undefined,
          }}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className="border-t px-4 py-3 space-y-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div
              className="text-xs"
              style={{ color: "var(--foreground-muted)" }}
            >
              {lastFetched
                ? `עודכן ב-${lastFetched.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`
                : "לא נטען עדיין"}
            </div>
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold transition disabled:opacity-50"
              style={{ color: "var(--accent)" }}
            >
              <RefreshCw
                size={12}
                className={loading ? "animate-spin" : undefined}
              />
              {loading ? "טוען..." : "רענן"}
            </button>
          </div>

          {error && (
            <ErrorBanner error={error} />
          )}

          {!error && !loading && messages.length === 0 && lastFetched && (
            <div
              className="text-sm text-center py-6"
              style={{ color: "var(--foreground-muted)" }}
            >
              לא נמצאו הודעות שנשלחו מ-Momentum.
            </div>
          )}

          {!error && messages.length > 0 && (
            <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {messages.map((m) => (
                <MessageRow key={m.sid} m={m} />
              ))}
            </ul>
          )}

          {!error && messages.length > 0 && summary.failed > 0 && (
            <FailureHint summary={summary} messages={messages} />
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────── Helpers ──────────────────────────

interface Summary {
  total: number;
  delivered: number;
  sent: number;
  queued: number;
  failed: number;
  headline: string;
}

function summarize(messages: MessageStatus[]): Summary {
  const total = messages.length;
  const delivered = messages.filter(
    (m) => m.status === "delivered" || m.status === "read",
  ).length;
  const sent = messages.filter((m) => m.status === "sent").length;
  const queued = messages.filter(
    (m) => m.status === "queued" || m.status === "accepted",
  ).length;
  const failed = messages.filter(
    (m) => m.status === "failed" || m.status === "undelivered",
  ).length;
  const headline =
    failed > 0
      ? `⚠️ ${failed} נכשלו · ${delivered} נמסרו · ${queued} בתור`
      : `✓ ${delivered}/${total} נמסרו · ${sent} בדרך`;
  return { total, delivered, sent, queued, failed, headline };
}

function SummaryDots({ summary }: { summary: Summary }) {
  return (
    <div
      className="flex items-center gap-1 shrink-0"
      style={{ direction: "ltr" }}
      aria-hidden
    >
      {summary.failed > 0 && (
        <Dot count={summary.failed} color="rgb(252,165,165)" />
      )}
      {summary.queued > 0 && (
        <Dot count={summary.queued} color="rgb(252,211,77)" />
      )}
      {summary.delivered > 0 && (
        <Dot count={summary.delivered} color="rgb(110,231,183)" />
      )}
    </div>
  );
}

function Dot({ count, color }: { count: number; color: string }) {
  return (
    <span
      className="ltr-num text-[10px] font-bold rounded-full px-1.5 py-0.5"
      style={{
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        minWidth: 22,
        textAlign: "center",
      }}
    >
      {count}
    </span>
  );
}

function MessageRow({ m }: { m: MessageStatus }) {
  const visual = STATUS_VISUAL[m.status] ?? STATUS_VISUAL.unknown;
  const phone = m.to.replace(/^whatsapp:/, "");
  const time = m.dateUpdated
    ? new Date(m.dateUpdated).toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <li
      className="rounded-xl px-3 py-2 flex items-start gap-2.5 text-sm"
      style={{
        background: visual.bg,
        border: `1px solid ${visual.border}`,
      }}
    >
      <span className="shrink-0 mt-0.5" style={{ color: visual.color }}>
        {visual.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="ltr-num text-xs font-mono truncate"
            style={{ color: "var(--foreground-soft)" }}
            dir="ltr"
          >
            {phone}
          </span>
          <span
            className="text-[11px] font-semibold uppercase shrink-0"
            style={{ color: visual.color }}
          >
            {visual.label}
          </span>
        </div>
        {(m.errorCode || m.errorMessage) && (
          <div
            className="text-[11px] mt-1 leading-relaxed"
            style={{ color: "rgb(252,165,165)" }}
          >
            {m.errorCode ? `[${m.errorCode}] ` : ""}
            {m.errorMessage ?? ""}
          </div>
        )}
        {time && (
          <div
            className="text-[10px] mt-0.5 ltr-num"
            style={{ color: "var(--foreground-muted)" }}
            dir="ltr"
          >
            {time}
          </div>
        )}
      </div>
    </li>
  );
}

function FailureHint({
  summary,
  messages,
}: {
  summary: Summary;
  messages: MessageStatus[];
}) {
  // Pick the most common Twilio error code to drive the hint.
  const failed = messages.filter(
    (m) => m.status === "failed" || m.status === "undelivered",
  );
  const codes = failed.map((m) => m.errorCode).filter(Boolean) as number[];
  const topCode = codes[0]; // most-recent failure for simplicity

  let title = "ההודעות נשלחו ל-Twilio אבל לא נמסרו לוואטסאפ";
  let body = "הסיבה הנפוצה: התבנית שלך עוד לא אושרה על-ידי Meta. תאשרי קודם את התבנית ב-Twilio Console ואז תנסי שוב.";

  if (topCode === 63016) {
    title = "מחוץ לחלון 24 שעות + אין תבנית מאושרת";
    body = "WhatsApp מאפשר הודעה ראשונה לאורח רק עם תבנית מאושרת. הגישי את momentum_guest_invitation_v1 לאישור Meta ב-Twilio Console.";
  } else if (topCode === 63007) {
    title = "תבנית לא נמצאה או לא אושרה";
    body = "ה-Content SID שמופיע בקוד לא מתאים לתבנית מאושרת. ודאי שב-Vercel מוגדר NEXT_PUBLIC_TWILIO_TEMPLATE_INVITATION_SID לערך התבנית שלך, וש-status שלה ב-Twilio הוא APPROVED.";
  } else if (topCode === 21408 || topCode === 21610) {
    title = "המספר לא נמצא בוואטסאפ או חסם הודעות עסקיות";
    body = "האורחים שמופיעים ככשלים כנראה ללא חשבון WhatsApp פעיל או שהם חסמו הודעות עסקיות. נסי לשלוח אליהם דרך הכפתור הירוק (wa.me) במקום.";
  }

  return (
    <div
      className="rounded-xl p-3 text-sm leading-relaxed"
      style={{
        background: "rgba(248,113,113,0.06)",
        border: "1px solid rgba(248,113,113,0.25)",
        color: "var(--foreground-soft)",
      }}
    >
      <div
        className="font-bold mb-1 inline-flex items-center gap-2"
        style={{ color: "rgb(252,165,165)" }}
      >
        <AlertTriangle size={14} aria-hidden />
        {title}
      </div>
      <p className="text-xs mt-1">{body}</p>
      <p
        className="text-[10px] mt-2 ltr-num"
        style={{ color: "var(--foreground-muted)" }}
      >
        {summary.failed} נכשלו מתוך {summary.total} הודעות אחרונות
      </p>
    </div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  const map: Record<string, string> = {
    auth: "התחבר/י מחדש ונסה/י שוב",
    not_configured: "Twilio WhatsApp לא הוגדר ב-Vercel — חסר TWILIO_ACCOUNT_SID או TWILIO_AUTH_TOKEN או TWILIO_WHATSAPP_FROM",
    supabase_not_configured: "Supabase לא הוגדר",
    rate_limited: "יותר מדי בקשות — חכי דקה",
    twilio_error: "Twilio סירב לבקשה — בדוק/י credentials",
    fetch_failed: "השליחה נכשלה",
    network: "אין חיבור לאינטרנט",
  };
  return (
    <div
      className="rounded-xl p-3 text-sm"
      style={{
        background: "rgba(248,113,113,0.08)",
        border: "1px solid rgba(248,113,113,0.25)",
        color: "rgb(252,165,165)",
      }}
    >
      ⚠️ {map[error] ?? error}
    </div>
  );
}

// Visual mapping per Twilio status. See:
// https://www.twilio.com/docs/messaging/api/message-resource#message-status-values
const STATUS_VISUAL: Record<
  string,
  {
    icon: React.ReactNode;
    label: string;
    color: string;
    bg: string;
    border: string;
  }
> = {
  delivered: {
    icon: <CheckCircle2 size={14} />,
    label: "נמסר",
    color: "rgb(110,231,183)",
    bg: "rgba(52,211,153,0.06)",
    border: "rgba(52,211,153,0.20)",
  },
  read: {
    icon: <CheckCircle2 size={14} />,
    label: "נקרא",
    color: "rgb(110,231,183)",
    bg: "rgba(52,211,153,0.10)",
    border: "rgba(52,211,153,0.30)",
  },
  sent: {
    icon: <CheckCircle2 size={14} />,
    label: "נשלח",
    color: "rgb(125,211,252)",
    bg: "rgba(56,189,248,0.06)",
    border: "rgba(56,189,248,0.20)",
  },
  queued: {
    icon: <Clock size={14} />,
    label: "בתור",
    color: "rgb(252,211,77)",
    bg: "rgba(251,191,36,0.06)",
    border: "rgba(251,191,36,0.20)",
  },
  accepted: {
    icon: <Clock size={14} />,
    label: "מקובל",
    color: "rgb(252,211,77)",
    bg: "rgba(251,191,36,0.06)",
    border: "rgba(251,191,36,0.20)",
  },
  failed: {
    icon: <XCircle size={14} />,
    label: "נכשל",
    color: "rgb(252,165,165)",
    bg: "rgba(248,113,113,0.06)",
    border: "rgba(248,113,113,0.25)",
  },
  undelivered: {
    icon: <AlertTriangle size={14} />,
    label: "לא נמסר",
    color: "rgb(252,165,165)",
    bg: "rgba(248,113,113,0.06)",
    border: "rgba(248,113,113,0.25)",
  },
  unknown: {
    icon: <Activity size={14} />,
    label: "?",
    color: "var(--foreground-muted)",
    bg: "var(--input-bg)",
    border: "var(--border)",
  },
};
