import { NextResponse } from "next/server";

/**
 * R140 — Public auth-config diagnostic.
 *
 * Many users reported "I signed up but never received the email/SMS
 * code". The signup code itself is correct (supabase.auth.signUp /
 * signInWithOtp), so the failure is almost always a configuration
 * issue in the Supabase project:
 *   • Email — SMTP not customized (Supabase's default sender hits a
 *     4-email-per-HOUR free-tier limit + lands in Gmail spam), or the
 *     Site URL / Redirect URL list doesn't include the live origin so
 *     the confirmation link 404s.
 *   • Phone — phone provider not enabled, or enabled without a Twilio
 *     account connected, or the Twilio account ran out of credit.
 *
 * This endpoint calls Supabase's public /auth/v1/settings endpoint
 * (returns the project's enabled-provider config without any auth)
 * and surfaces a JSON diagnostic the host can read in their browser
 * to immediately see what's enabled vs. what isn't.
 *
 * No auth on this route — the data we return is the same data
 * supabase-js fetches itself on every page load. Caching it through
 * us also avoids a CORS round-trip for the in-app diagnostic UI.
 *
 * Returns:
 *   200 + {
 *     ok: true,
 *     supabaseConfigured: boolean,
 *     siteUrlConfigured: boolean,
 *     deployedOrigin: string,
 *     providers: {
 *       email: boolean,           // is email auth enabled?
 *       emailAutoconfirm: boolean,// mailer_autoconfirm — if true, no email is sent
 *       phone: boolean,           // is phone auth enabled?
 *       phoneAutoconfirm: boolean,// sms_autoconfirm — if true, no SMS is sent
 *       google: boolean,
 *       apple: boolean,
 *     },
 *     issues: string[],           // human-readable problems we detected
 *     checklist: { id: string; label: string; ok: boolean | "unknown" }[],
 *   }
 *   503 when Supabase env vars are missing — same shape with ok:false.
 */

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 6000;

interface SupabaseAuthSettings {
  external?: Record<string, boolean | undefined>;
  // /auth/v1/settings exposes these toggles flat at root. Names match the
  // Supabase Auth GoTrue config:
  mailer_autoconfirm?: boolean;
  phone_autoconfirm?: boolean;
  sms_provider?: string;
  disable_signup?: boolean;
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const supabaseConfigured = !!(url && key);

  if (!supabaseConfigured) {
    return NextResponse.json(
      {
        ok: false,
        supabaseConfigured: false,
        siteUrlConfigured: !!siteUrl,
        deployedOrigin: siteUrl,
        error: "supabase_env_missing",
        issues: [
          "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set in the deployed environment. Without them no auth endpoint can possibly work — the app falls back to local-only mode.",
        ],
        checklist: [
          { id: "supabase_env", label: "Supabase env vars present", ok: false },
          { id: "site_url_env", label: "NEXT_PUBLIC_SITE_URL set", ok: !!siteUrl },
        ],
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Fetch the public Auth settings document. Supabase-js does this on
  // boot itself; we can hit it directly with just the anon key.
  let settings: SupabaseAuthSettings | null = null;
  let fetchError: string | null = null;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: {
        apikey: key,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      fetchError = `Supabase /auth/v1/settings returned HTTP ${res.status}`;
    } else {
      settings = (await res.json()) as SupabaseAuthSettings;
    }
  } catch (e) {
    fetchError =
      e instanceof Error ? e.message : "Failed to reach Supabase auth settings";
  }

  const issues: string[] = [];
  if (fetchError) issues.push(fetchError);

  // External provider toggles — the shape Supabase returns is
  // { external: { email: bool, phone: bool, google: bool, apple: bool, ... } }
  const ext = settings?.external ?? {};
  const emailEnabled = ext.email !== false; // default true if absent
  const phoneEnabled = ext.phone === true;
  const googleEnabled = ext.google === true;
  const appleEnabled = ext.apple === true;

  // mailer_autoconfirm:true is REQUIRED to be FALSE for users to ever
  // see a confirmation email. When it's true Supabase silently skips
  // sending and immediately marks the user confirmed — the user never
  // gets the "click this link" mail. This is the #1 cause of "signed
  // up but no email".
  const mailerAutoconfirm = settings?.mailer_autoconfirm === true;
  const phoneAutoconfirm = settings?.phone_autoconfirm === true;
  const smsProvider = settings?.sms_provider ?? "";
  const signupDisabled = settings?.disable_signup === true;

  if (signupDisabled) {
    issues.push(
      "Supabase Auth has `disable_signup: true` — no new users can register. Toggle off in Auth → Sign Ups.",
    );
  }
  if (!emailEnabled) {
    issues.push(
      "Email provider is disabled in Supabase Auth → Providers → Email. Enable it (it's on by default for new projects).",
    );
  }
  if (mailerAutoconfirm) {
    issues.push(
      "`mailer_autoconfirm` is TRUE — Supabase will NOT send confirmation emails (it auto-confirms users instead). If hosts report not receiving codes, this is almost certainly why. Toggle off in Auth → Email → 'Confirm email'.",
    );
  }
  if (!phoneEnabled) {
    issues.push(
      "Phone provider is OFF in Supabase Auth → Providers → Phone. Users will see a 'phone signups disabled' error when they try the phone tab. Enable it AND connect a Twilio account.",
    );
  } else if (!smsProvider) {
    issues.push(
      "Phone provider is enabled but no SMS provider (Twilio/MessageBird/Vonage) is configured. Supabase accepts the OTP request but no SMS goes out. Connect Twilio under Auth → Phone.",
    );
  }
  if (phoneAutoconfirm) {
    issues.push(
      "`phone_autoconfirm` is TRUE — Supabase will NOT send SMS codes. Toggle off in Auth → Phone.",
    );
  }

  // Site-URL configuration — when this doesn't match the live origin
  // the confirmation link redirects to a domain that doesn't serve our
  // /auth/callback page, the session is never finalized, and the user
  // sees a broken landing after clicking the email link.
  const siteUrlConfigured = !!siteUrl;
  if (!siteUrlConfigured) {
    issues.push(
      "NEXT_PUBLIC_SITE_URL is not set in the deployed environment. Email confirmation links will fall back to whatever Supabase has configured as Site URL — make sure they match.",
    );
  }

  const checklist = [
    { id: "supabase_env", label: "Supabase URL + anon key in Vercel env", ok: true as const },
    {
      id: "site_url_env",
      label: "NEXT_PUBLIC_SITE_URL set in Vercel",
      ok: siteUrlConfigured,
    },
    { id: "auth_settings_reachable", label: "Supabase /auth/v1/settings reachable", ok: !fetchError },
    { id: "signup_enabled", label: "Sign-up enabled in Supabase Auth", ok: !signupDisabled },
    { id: "email_enabled", label: "Email provider enabled", ok: emailEnabled },
    {
      id: "mailer_not_autoconfirm",
      label: "mailer_autoconfirm OFF (so confirmation email is actually sent)",
      ok: !mailerAutoconfirm,
    },
    { id: "phone_enabled", label: "Phone provider enabled", ok: phoneEnabled },
    {
      id: "phone_provider_set",
      label: "SMS provider (Twilio) connected",
      ok: phoneEnabled ? !!smsProvider : ("unknown" as const),
    },
    {
      id: "phone_not_autoconfirm",
      label: "phone_autoconfirm OFF (so SMS is actually sent)",
      ok: !phoneAutoconfirm,
    },
    { id: "google_enabled", label: "Google OAuth enabled (optional)", ok: googleEnabled },
    { id: "apple_enabled", label: "Apple OAuth enabled (optional)", ok: appleEnabled },
  ];

  return NextResponse.json(
    {
      ok: issues.length === 0,
      supabaseConfigured: true,
      siteUrlConfigured,
      deployedOrigin: siteUrl,
      providers: {
        email: emailEnabled,
        emailAutoconfirm: mailerAutoconfirm,
        phone: phoneEnabled,
        phoneAutoconfirm: phoneAutoconfirm,
        smsProvider: smsProvider || null,
        google: googleEnabled,
        apple: appleEnabled,
      },
      issues,
      checklist,
    },
    {
      // Cache for 30s so the diagnostic page can refresh quickly
      // without DoSing Supabase on every render.
      headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
    },
  );
}
