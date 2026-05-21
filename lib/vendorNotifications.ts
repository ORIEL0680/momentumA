// R14.2 — server-only guard. Prevents the RESEND_API_KEY /
// CALLMEBOT_* env-var references from ever appearing in a client
// bundle by accident.
import "server-only";

/**
 * Notification dispatcher for new vendor applications.
 *
 * Tries email (Resend) and WhatsApp (CallMeBot personal API) in parallel.
 * Both are optional — missing env vars degrade to a console warn + DB log
 * row, so the app never crashes on missing config.
 *
 * To enable email: sign up at resend.com, set RESEND_API_KEY in .env.local.
 * To enable WhatsApp: get a CallMeBot key (free for personal use, see
 * https://www.callmebot.com/blog/free-api-whatsapp-messages/) and set
 * CALLMEBOT_PHONE + CALLMEBOT_API_KEY.
 */

import type { VendorApplicationInput } from "./vendorApplication";
import { VENDOR_CATEGORIES } from "./vendorApplication";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "talhemo132@gmail.com";

interface NotifyResult {
  channel: "email" | "whatsapp";
  status: "sent" | "skipped" | "failed";
  error?: string;
}

function categoryLabel(id: string): string {
  return VENDOR_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildMessage(
  app: VendorApplicationInput,
  applicationId: string,
): { subject: string; text: string; html: string } {
  const subject = `🔔 ספק חדש: ${app.business_name} (${categoryLabel(app.category)})`;
  const lines = [
    `התקבלה בקשה חדשה להצטרפות לפלטפורמה.`,
    ``,
    `🏢 שם העסק: ${app.business_name}`,
    `👤 איש קשר: ${app.contact_name}`,
    `📞 טלפון: ${app.phone}`,
    `📧 מייל: ${app.email}`,
    `📍 עיר: ${app.city ?? "לא צוין"}`,
    `📂 קטגוריה: ${categoryLabel(app.category)}`,
    ``,
    `🆔 ת.ז./מס' עוסק: ${app.business_id}`,
    `⏳ ניסיון: ${app.years_in_field} שנים`,
    `🔗 דוגמת עבודה: ${app.sample_work_url}`,
    ``,
  ];
  if (app.website) lines.push(`🌐 אתר: ${app.website}`);
  if (app.instagram) lines.push(`📸 אינסטגרם: ${app.instagram}`);
  if (app.facebook) lines.push(`📘 פייסבוק: ${app.facebook}`);
  if (app.about) lines.push(``, `📝 אודות:`, app.about);
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://moomentum.events";
  const adminUrl = `${baseUrl}/admin/vendors/applications`;
  lines.push(``, `👉 לאישור/דחייה: ${adminUrl}`, ``, `מזהה בקשה: ${applicationId}`);
  return {
    subject,
    text: lines.join("\n"),
    html: buildAdminNotificationHtml(app, adminUrl),
  };
}

/**
 * R80 (R65) — premium admin-notification HTML email.
 *
 * Dark-gold theme, RTL, table-rendered details + CTA button. Every
 * dynamic value passes through escapeHtml so a vendor that types
 * `</body>` into their business name can't break out of the layout.
 */
function buildAdminNotificationHtml(
  app: VendorApplicationInput,
  adminUrl: string,
): string {
  const row = (label: string, value: string | undefined | null) => {
    if (!value) return "";
    return `<tr><td style="opacity:0.6;width:32%;padding:4px 0;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`;
  };
  const linkRow = (label: string, url: string | undefined | null) => {
    if (!url) return "";
    return `<tr><td style="opacity:0.6;width:32%;padding:4px 0;">${escapeHtml(label)}</td><td style="padding:4px 0;"><a href="${escapeHtml(url)}" style="color:#F4DEA9;text-decoration:none;">${escapeHtml(url)}</a></td></tr>`;
  };
  const today = new Date().toLocaleDateString("he-IL");
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;background:#0A0A0F;font-family:-apple-system,'Segoe UI',sans-serif;color:#E8D9B8;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:linear-gradient(170deg,#1A1A1F,#0A0A0F);border:1px solid #D4B068;border-radius:24px;padding:36px 28px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:14px;color:#A8884A;letter-spacing:0.15em;text-transform:uppercase;">בקשה חדשה</div>
      <div style="font-size:24px;font-weight:900;color:#F4DEA9;margin-top:8px;">🔔 ספק חדש מבקש להצטרף</div>
    </div>
    <div style="background:rgba(212,176,104,0.08);border:1px solid rgba(212,176,104,0.2);border-radius:16px;padding:20px;margin-bottom:24px;">
      <div style="font-size:20px;font-weight:700;color:#F4DEA9;margin-bottom:4px;">${escapeHtml(app.business_name)}</div>
      <div style="font-size:13px;color:#A8884A;">${escapeHtml(categoryLabel(app.category))}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#E8D9B8;line-height:1.8;">
      ${row("איש קשר:", app.contact_name)}
      ${row("טלפון:", app.phone)}
      ${row("מייל:", app.email)}
      ${row("עיר:", app.city)}
      ${linkRow("אתר:", app.website)}
      ${row("ח.פ./ע.מ.:", app.business_id)}
      ${row("ותק:", `${app.years_in_field} שנים`)}
      ${linkRow("דוגמת עבודה:", app.sample_work_url)}
      ${row("אינסטגרם:", app.instagram)}
      ${row("פייסבוק:", app.facebook)}
    </table>
    ${
      app.about
        ? `<div style="margin-top:20px;padding-top:18px;border-top:1px solid rgba(212,176,104,0.2);"><div style="font-size:12px;opacity:0.6;margin-bottom:6px;">תיאור:</div><div style="font-size:14px;line-height:1.6;">${escapeHtml(app.about)}</div></div>`
        : ""
    }
    <div style="text-align:center;margin-top:32px;">
      <a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#F4DEA9,#D4B068);color:#0A0A0F;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;">סקירה ואישור באדמין</a>
    </div>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(212,176,104,0.2);font-size:11px;color:#6A5F4A;text-align:center;">Momentum · moomentum.events · התקבל ב-${escapeHtml(today)}</div>
  </div>
</body>
</html>`;
}

/**
 * R80 (R65) — vendor-facing welcome email when an admin approves
 * the application. Triggered from /api/vendors/admin/decide.
 */
export async function sendVendorApprovalEmail(
  app: { email: string; contact_name: string; business_name: string },
): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[vendorNotifications] RESEND_API_KEY not set — vendor approval email skipped",
    );
    return { channel: "email", status: "skipped" };
  }
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://moomentum.events";
  const signinUrl = `${baseUrl}/signup?mode=signin`;
  const dashboardUrl = `${baseUrl}/vendors/dashboard`;
  const subject = `ברוך הבא ל-Momentum 🎉 — החשבון שלך פעיל`;
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;background:#0A0A0F;font-family:-apple-system,'Segoe UI',sans-serif;color:#E8D9B8;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:linear-gradient(170deg,#1A1A1F,#0A0A0F);border:1px solid #D4B068;border-radius:24px;padding:36px 28px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:14px;color:#A8884A;letter-spacing:0.15em;text-transform:uppercase;">החשבון פעיל</div>
      <div style="font-size:24px;font-weight:900;color:#F4DEA9;margin-top:8px;">🎉 ברוך הבא ל-Momentum</div>
    </div>
    <p style="font-size:15px;line-height:1.7;color:#E8D9B8;margin:0 0 16px;">שלום ${escapeHtml(app.contact_name)},</p>
    <p style="font-size:15px;line-height:1.7;color:#E8D9B8;margin:0 0 16px;">הבקשה של <strong style="color:#F4DEA9;">${escapeHtml(app.business_name)}</strong> אושרה. אתם רשמית חלק מהקטלוג של Momentum.</p>
    <div style="background:rgba(212,176,104,0.08);border:1px solid rgba(212,176,104,0.2);border-radius:16px;padding:20px;margin:20px 0;">
      <div style="font-size:13px;color:#A8884A;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">איך נכנסים</div>
      <ol style="margin:0;padding-inline-start:20px;font-size:14px;line-height:1.8;color:#E8D9B8;">
        <li>לוחצים על <strong style="color:#F4DEA9;">"כניסה לחשבון"</strong> למטה.</li>
        <li>מזינים את המייל הזה: <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;color:#F4DEA9;">${escapeHtml(app.email)}</code></li>
        <li>תקבלו קוד למייל — מזינים וכנסים.</li>
        <li>באזור הספק שלכם תוכלו לבנות את הדף, לקבל לידים, ולסגור עסקאות.</li>
      </ol>
    </div>
    <div style="text-align:center;margin-top:28px;">
      <a href="${escapeHtml(signinUrl)}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#F4DEA9,#D4B068);color:#0A0A0F;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;">כניסה לחשבון</a>
    </div>
    <div style="text-align:center;margin-top:14px;">
      <a href="${escapeHtml(dashboardUrl)}" style="color:#A8884A;font-size:13px;text-decoration:underline;">או ישר לאזור הספק שלי →</a>
    </div>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(212,176,104,0.2);font-size:12px;color:#6A5F4A;text-align:center;line-height:1.6;">
      שאלות? משיבים למייל הזה או כותבים ל-<a href="mailto:talhemo132@gmail.com" style="color:#A8884A;">talhemo132@gmail.com</a><br>
      טל · Momentum
    </div>
  </div>
</body>
</html>`;
  const text = `שלום ${app.contact_name},\n\nהבקשה של ${app.business_name} אושרה. ברוך הבא ל-Momentum!\n\nכניסה: ${signinUrl}\nאזור הספק שלי: ${dashboardUrl}\n\nטל · Momentum`;
  return sendEmailTo(app.email, { subject, text, html });
}

/** Generic send-email-to-X used by both admin notification + vendor welcome. */
async function sendEmailTo(
  to: string,
  msg: { subject: string; text: string; html: string },
): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { channel: "email", status: "skipped", error: "no_api_key" };
  }
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Momentum <${fromEmail}>`,
        to: [to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      }),
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`[vendorNotifications] resend ${res.status}: ${err.slice(0, 200)}`);
      return {
        channel: "email",
        status: "failed",
        error: `${res.status}: ${err.slice(0, 200)}`,
      };
    }
    return { channel: "email", status: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[vendorNotifications] resend exception: ${msg}`);
    return { channel: "email", status: "failed", error: msg };
  }
}

/** External providers occasionally hang. We cap each call at NOTIFY_TIMEOUT_MS
 *  so a slow Resend / CallMeBot can't keep the apply request open. */
const NOTIFY_TIMEOUT_MS = 5000;

async function sendEmail(msg: {
  subject: string;
  text: string;
  html: string;
}): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[vendorNotifications] RESEND_API_KEY not set — admin email skipped",
    );
    return { channel: "email", status: "skipped" };
  }
  return sendEmailTo(ADMIN_EMAIL, msg);
}

async function sendWhatsapp(msg: { text: string }): Promise<NotifyResult> {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!phone || !apiKey) {
    console.warn("[vendorNotifications] CALLMEBOT_PHONE/API_KEY not set — skipping WhatsApp");
    return { channel: "whatsapp", status: "skipped" };
  }
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(msg.text)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS) });
    if (!res.ok) {
      return { channel: "whatsapp", status: "failed", error: `${res.status}` };
    }
    return { channel: "whatsapp", status: "sent" };
  } catch (e) {
    return {
      channel: "whatsapp",
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function notifyAdminOfNewApplication(
  app: VendorApplicationInput,
  applicationId: string,
): Promise<NotifyResult[]> {
  const msg = buildMessage(app, applicationId);
  const results = await Promise.all([sendEmail(msg), sendWhatsapp({ text: msg.text })]);
  return results;
}
