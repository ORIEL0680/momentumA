"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * R101 — internal WhatsApp send test page.
 *
 * One-click test for /api/whatsapp/send. Auth comes from the user's
 * existing Supabase session (you must be signed in). The page is
 * intentionally bare — it's a developer affordance, not a feature.
 *
 * Delete this file once the WhatsApp send is wired into real product
 * flows (guest invitations, vendor messages).
 */

type Status = "idle" | "loading" | "success" | "error";

interface Result {
  status: number;
  body: unknown;
}

export default function WhatsAppTestPage() {
  const [phone, setPhone] = useState("+972535319891");
  const [message, setMessage] = useState(
    "🎉 בדיקה ראשונה מ-Momentum WhatsApp API!\n\nאם קיבלת את ההודעה — האינטגרציה עובדת ✅",
  );
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<Result | null>(null);
  // Lazy initial — synchronous check so we don't setState-in-effect on
  // the supabase-missing branch. The async auth check still happens in
  // useEffect because supabase.auth.getUser() is genuinely async.
  const [signedIn, setSignedIn] = useState<boolean | null>(() =>
    getSupabase() ? null : false,
  );

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return; // already set to false via lazy init
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setSignedIn(!!data.user);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = async () => {
    setStatus("loading");
    setResult(null);

    const supabase = getSupabase();
    if (!supabase) {
      setStatus("error");
      setResult({ status: 0, body: { error: "supabase_not_configured" } });
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setStatus("error");
      setResult({ status: 0, body: { error: "not_signed_in" } });
      return;
    }

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, message }),
      });
      const body = await res.json().catch(() => ({}));
      setResult({ status: res.status, body });
      setStatus(res.ok ? "success" : "error");
    } catch (e) {
      setStatus("error");
      setResult({
        status: 0,
        body: { error: "network", detail: String(e) },
      });
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-lg space-y-6">
        <header className="text-center">
          <div className="text-4xl mb-2">📱</div>
          <h1 className="text-2xl font-bold gradient-gold">
            בדיקת WhatsApp API
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--foreground-muted)" }}
          >
            דף בדיקה פנימי — שולח הודעה דרך /api/whatsapp/send
          </p>
        </header>

        {signedIn === false && (
          <div
            className="card p-4 text-sm"
            style={{
              background: "rgba(248,113,113,0.10)",
              border: "1px solid rgba(248,113,113,0.30)",
              color: "rgb(252,165,165)",
            }}
          >
            ⚠️ אתה לא מחובר. <a href="/signup" className="underline">היכנס כאן</a> ואז חזור לדף הזה.
          </div>
        )}

        <div className="card p-6 space-y-4">
          <label className="block">
            <span
              className="text-xs block mb-1.5"
              style={{ color: "var(--foreground-soft)" }}
            >
              מספר טלפון (E.164)
            </span>
            <input
              dir="ltr"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input ltr-num"
              placeholder="+972501234567"
            />
            <span
              className="text-xs mt-1 block"
              style={{ color: "var(--foreground-muted)" }}
            >
              💡 שלח קודם הודעה ב-WhatsApp מהמספר הזה אל{" "}
              <strong className="ltr-num">+972 53-362-5007</strong> כדי לפתוח
              חלון 24 שעות (אחרת תקבל שגיאת template required).
            </span>
          </label>

          <label className="block">
            <span
              className="text-xs block mb-1.5"
              style={{ color: "var(--foreground-soft)" }}
            >
              הודעה
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1600}
              className="input"
              style={{ resize: "vertical" }}
            />
          </label>

          <button
            type="button"
            onClick={send}
            disabled={status === "loading" || !phone || !message}
            className="btn-gold w-full inline-flex items-center justify-center gap-2"
            style={{ minHeight: 52, opacity: status === "loading" ? 0.6 : 1 }}
          >
            {status === "loading" ? "שולח..." : "📤 שלח הודעת WhatsApp"}
          </button>
        </div>

        {result && (
          <div
            className="card p-5 space-y-2"
            style={{
              background:
                status === "success"
                  ? "rgba(52,211,153,0.08)"
                  : "rgba(248,113,113,0.08)",
              border:
                status === "success"
                  ? "1px solid rgba(52,211,153,0.3)"
                  : "1px solid rgba(248,113,113,0.3)",
            }}
          >
            <div className="font-bold text-lg">
              {status === "success" ? "✅ הצלחה!" : "❌ שגיאה"}
            </div>
            <div className="text-sm ltr-num">
              HTTP Status: <strong>{result.status}</strong>
            </div>
            <pre
              className="text-xs p-3 rounded-lg overflow-x-auto ltr-num"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                direction: "ltr",
                textAlign: "left",
              }}
            >
              {JSON.stringify(result.body, null, 2)}
            </pre>
            {status === "success" && (
              <p
                className="text-sm"
                style={{ color: "var(--foreground-soft)" }}
              >
                ההודעה בדרך לוואטסאפ — בדוק את הטלפון בעוד כמה שניות 📱
              </p>
            )}
            {status === "error" &&
              typeof result.body === "object" &&
              result.body !== null &&
              "error" in result.body && (
                <ErrorHint code={String((result.body as { error: string }).error)} />
              )}
          </div>
        )}
      </div>
    </main>
  );
}

function ErrorHint({ code }: { code: string }) {
  const hints: Record<string, string> = {
    auth: "התחבר באפליקציה ונסה שוב",
    not_configured: "חסרים TWILIO_* ב-Vercel Environment Variables",
    invalid_phone: "המספר לא בפורמט תקין — נסה +972501234567",
    rate_limited: "חרגת מ-30 הודעות לשעה — חכה שעה",
    twilio_error:
      "Twilio סירב — הסיבה הנפוצה: עברו 24 שעות מאז שהמשתמש שלח לך הודעה. שלח הודעה מהטלפון לעסק קודם.",
  };
  const hint = hints[code];
  if (!hint) return null;
  return (
    <p
      className="text-xs mt-2 px-3 py-2 rounded-lg"
      style={{
        background: "rgba(212,176,104,0.10)",
        border: "1px solid var(--border-gold)",
        color: "var(--accent)",
      }}
    >
      💡 {hint}
    </p>
  );
}
