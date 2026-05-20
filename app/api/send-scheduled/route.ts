import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * R60 (R51) — outbound scheduled email cron.
 *
 * Vercel Cron pings this on a schedule (see vercel.json crons). We:
 *   1. Verify the call (CRON_SECRET, if set).
 *   2. Pull due rows from public.scheduled_emails (service-role).
 *   3. Look up each user's email via the Auth admin API + best-effort
 *      name from their app_states JSON.
 *   4. Send via Resend (same pattern as lib/vendorNotifications.ts).
 *   5. Stamp sent_at on success, bump attempts + last_error on failure.
 *
 * Graceful degradation:
 *   - Missing RESEND_API_KEY → mark rows sent_at=now with last_error
 *     'resend-not-configured' so we don't busy-loop. Lets you ship the
 *     migration without a Resend key wired and turn it on later.
 *   - Missing SUPABASE_SERVICE_ROLE_KEY → 503, same as /api/admin/stats.
 *
 * The HTML body lives inline below; the human-editable reference is
 * emails/welcome.html (keep them in sync if you tweak copy).
 */

interface ScheduledRow {
  id: string;
  user_id: string;
  email_type: "welcome";
  send_at: string;
  attempts: number;
}

const RESEND_FROM = "Momentum <onboarding@resend.dev>"; // verified-domain swap noted in TASKLIST.R60.md
const SEND_TIMEOUT_MS = 8000;
const BATCH_LIMIT = 50;
const MAX_ATTEMPTS = 5;

/** Single source of truth for the welcome HTML. Mirrors emails/welcome.html. */
function welcomeHtml(name: string, site: string): string {
  const safeName = name.replace(/[<>&"']/g, ""); // light scrub — names go in a body, not an attr
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Heebo',sans-serif;color:#E8D9B8;-webkit-font-smoothing:antialiased;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0F;padding:40px 20px;"><tr><td align="center"><table role="presentation" width="540" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;width:100%;"><tr><td style="background:#1A1A1F;background:linear-gradient(170deg,#1A1A1F 0%,#0A0A0F 100%);border:1px solid #D4B068;border-radius:24px;padding:40px 32px;text-align:right;"><div style="text-align:center;font-size:32px;font-weight:900;background:linear-gradient(135deg,#F4DEA9,#D4B068);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#F4DEA9;margin-bottom:8px;letter-spacing:-0.02em;">Momentum</div><div style="text-align:center;font-size:12px;color:#8A7A5A;margin-bottom:32px;">תכננו את האירוע. חיו את הרגעים.</div><h1 style="font-size:24px;color:#F5E9D0;margin:0 0 20px;font-weight:700;line-height:1.3;text-align:right;">שלום ${safeName}, האירוע שלך כבר מתעצב</h1><p style="font-size:15px;line-height:1.75;color:#C8B89A;margin:0 0 18px;">תודה שבחרת ב-Momentum לתכנן את האירוע הכי חשוב שלך.</p><p style="font-size:15px;line-height:1.75;color:#C8B89A;margin:0 0 18px;">אני טל — הקמתי את Momentum כי ראיתי איך 12 כלים שונים הופכים חודשי תכנון לסיוט. בנינו את המקום האחד שמרכז הכל: אורחים, תקציב, ספקים, ויום האירוע עצמו.</p><p style="font-size:15px;line-height:1.75;color:#C8B89A;margin:0 0 28px;">בעמוד הראשון תמצא 4 צעדים מהירים — סיום שלהם לוקח 5 דקות. אחר כך אתה בדרך.</p><div style="text-align:center;"><a href="${site}/dashboard" style="display:inline-block;padding:14px 36px;background:#D4B068;background:linear-gradient(135deg,#F4DEA9,#D4B068);color:#0A0A0F;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;margin:8px 0;">התחל את האירוע שלך</a></div><p style="font-size:13px;line-height:1.7;color:#8A7A5A;margin:28px 0 0;padding-top:20px;border-top:1px solid rgba(212,176,104,0.18);">יש שאלה? תכתוב לי ישירות ל-<a href="mailto:talhemo132@gmail.com" style="color:#D4B068;text-decoration:none;">talhemo132@gmail.com</a> — אני עונה אישית, בדרך כלל תוך 4 שעות.</p><p style="font-size:13px;line-height:1.6;color:#A89878;margin:16px 0 0;font-weight:600;">טל חמו · מייסד · Momentum</p></td></tr><tr><td style="padding-top:24px;text-align:center;"><div style="font-size:11px;color:#6A5F4A;line-height:1.6;">Momentum · moomentum.events</div></td></tr></table></td></tr></table></body></html>`;
}

interface AppStatePayload {
  event?: { hostName?: unknown } | null;
}

function firstName(payload: unknown): string {
  const p = payload as AppStatePayload | null;
  const raw = p?.event?.hostName;
  if (typeof raw !== "string" || !raw.trim()) return "";
  // Take the first space-separated token so the greeting reads naturally.
  return raw.trim().split(/\s+/)[0] ?? "";
}

export async function GET(req: NextRequest) {
  // 1. Auth — Vercel sets Authorization: Bearer ${CRON_SECRET} when env is set.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase service role not configured" },
      { status: 503 },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2. Pull due rows.
  const nowIso = new Date().toISOString();
  const { data: dueRows, error: dueErr } = (await admin
    .from("scheduled_emails")
    .select("id, user_id, email_type, send_at, attempts")
    .lte("send_at", nowIso)
    .is("sent_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("send_at", { ascending: true })
    .limit(BATCH_LIMIT)) as {
    data: ScheduledRow[] | null;
    error: { message: string } | null;
  };

  if (dueErr) {
    console.error("[/api/send-scheduled] select due rows", dueErr.message);
    return NextResponse.json({ error: "select failed" }, { status: 500 });
  }

  const due = dueRows ?? [];
  if (due.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, failed: 0, due: 0 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://moomentum.events").replace(/\/+$/, "");

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of due) {
    try {
      const userRes = await admin.auth.admin.getUserById(row.user_id);
      const email = userRes.data?.user?.email ?? null;
      if (!email) {
        // No email on the auth row (phone-only signup, deleted user). Mark
        // sent so we don't busy-loop on this row; record the reason.
        await admin
          .from("scheduled_emails")
          .update({
            sent_at: new Date().toISOString(),
            last_error: "no-email-on-user",
          })
          .eq("id", row.id);
        skipped += 1;
        continue;
      }

      // Best-effort name (greeting reads better with a first name).
      const { data: stateRow } = (await admin
        .from("app_states")
        .select("payload")
        .eq("user_id", row.user_id)
        .maybeSingle()) as { data: { payload: unknown } | null };
      const name = firstName(stateRow?.payload) || "וברוכים הבאים";

      if (!resendKey) {
        await admin
          .from("scheduled_emails")
          .update({
            sent_at: new Date().toISOString(),
            last_error: "resend-not-configured",
          })
          .eq("id", row.id);
        skipped += 1;
        continue;
      }

      const html = welcomeHtml(name, site);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [email],
          subject: "שלום מטל — האירוע שלך כבר מתעצב",
          html,
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        await admin
          .from("scheduled_emails")
          .update({
            attempts: row.attempts + 1,
            last_error: `resend ${res.status}: ${errText.slice(0, 400)}`,
          })
          .eq("id", row.id);
        failed += 1;
        continue;
      }

      await admin
        .from("scheduled_emails")
        .update({
          sent_at: new Date().toISOString(),
          attempts: row.attempts + 1,
          last_error: null,
        })
        .eq("id", row.id);
      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin
        .from("scheduled_emails")
        .update({
          attempts: row.attempts + 1,
          last_error: msg.slice(0, 400),
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  return NextResponse.json({ sent, skipped, failed, due: due.length });
}
