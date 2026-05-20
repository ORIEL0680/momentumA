# Momentum — Email templates (R51)

7 paste-ready Hebrew/RTL/brand templates. All styles are inline (Gmail
mobile strips `<style>` blocks). Dark gold-on-black brand, matches the
in-app card-gold language.

## Supabase Auth templates (6 files)

Open **Supabase Dashboard → Authentication → Email Templates**. For
each template below, paste the **Subject** into the Subject field and
the matching file's **entire body** into the Message field.

| # | File | Supabase template | Subject |
|---|---|---|---|
| 1 | `01-confirm-signup.html`   | "Confirm signup"        | `ברוכים הבאים ל-Momentum 💫 אישור הרשמה קצר` |
| 2 | `02-magic-link.html`       | "Magic Link"            | `התחברות מהירה ל-Momentum` |
| 3 | `03-reset-password.html`   | "Reset Password"        | `איפוס סיסמה — Momentum` |
| 4 | `04-change-email.html`     | "Change Email Address"  | `אישור החלפת כתובת מייל — Momentum` |
| 5 | `05-email-otp.html`        | "Magic Link" *or* OTP   | `הקוד שלך ל-Momentum: {{ .Token }}` |
| 6 | `06-reauthentication.html` | "Reauthentication"      | `אישור פעולה רגישה — Momentum` |

Supabase template variables used:
- `{{ .ConfirmationURL }}` — the action link
- `{{ .Token }}` — the 6-digit code (template 5 only)
- `{{ .SiteURL }}` — falls back to env Site URL if needed

> **Note on template 5 (Email OTP):** Supabase calls this template
> "Magic Link" when *Confirm sign up via OTP* is enabled in
> Authentication → Sign In / Up. If you want both flows on one
> project, pick one — the code shows the 6-digit token as the headline.

## Welcome email (sent 1h after signup)

| File | Sent by | Template variables |
|---|---|---|
| `welcome.html` | `/api/send-scheduled` (R51 cron) via Resend | `{{name}}`, `{{site}}` |

This is **not** a Supabase template. It's sent by our own endpoint
when the scheduled row in `public.scheduled_emails` becomes due. See
the migration `supabase/migrations/2026-05-20-scheduled-emails.sql`
and the route `app/api/send-scheduled/route.ts`.

## Manual steps (owner)

1. Paste each Supabase template's HTML + Subject into the dashboard.
2. Confirm the redirect URL whitelist still includes
   `https://moomentum.events` and (during dev) your tunnel URL.
3. Run the scheduled-emails migration (see TASKLIST.R60.md).
4. Set `RESEND_API_KEY` in Vercel env (free tier OK). Without it the
   cron logs a skip and marks rows `sent` so they don't loop.

## Brand tokens (kept consistent across all 7 templates)

- Background: `#0A0A0F`
- Card: `linear-gradient(170deg, #1A1A1F 0%, #0A0A0F 100%)` border `#D4B068`
- Headlines: `#F5E9D0` / gold gradient `linear-gradient(135deg, #F4DEA9, #D4B068)`
- Body text: `#C8B89A`
- CTA button: gold gradient on dark text (`#0A0A0F`)
- Footer text: `#6A5F4A` 11px

Width caps at 540px so every client renders consistently.
