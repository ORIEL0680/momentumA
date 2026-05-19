import { type NextRequest, NextResponse } from "next/server";
import { createClient, type EmailOtpType } from "@supabase/supabase-js";
import { logError } from "@/lib/error-tracker";

/**
 * Email-confirmation route handler (R20 fix).
 *
 * Supabase's default Auth email templates link to `{{SiteURL}}/auth/confirm?
 * token_hash=…&type=signup` — that's the modern PKCE-style verify pattern.
 * If this route doesn't exist, clicking the verification email lands on a
 * 404. (Old templates went through Supabase's own `/auth/v1/verify` and
 * redirected back to our `/auth/callback`; that flow still works, but
 * newer Supabase projects use this one by default.)
 *
 * The handler runs server-side, exchanges the token for a session, then
 * hands off to the client-side `/auth/callback` page so the existing
 * `syncOnLogin` + onboarding-redirect logic stays in one place.
 */
/** Build the canonical public origin for redirects. Behind the cloudflared
 *  tunnel, `request.nextUrl.origin` resolves to `https://localhost:3030`
 *  (Next's internal view), which obviously doesn't resolve for the user
 *  clicking the email link. Honor the forwarded headers first, then the
 *  configured site URL, then the request URL as last resort. */
function publicOrigin(request: NextRequest): string {
  const fwdHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const fwdProto = request.headers.get("x-forwarded-proto");
  if (fwdHost) {
    const proto = fwdProto ?? (fwdHost.includes("localhost") ? "http" : "https");
    return `${proto}://${fwdHost}`;
  }
  const envOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  if (envOrigin) return envOrigin;
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = publicOrigin(request);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // R47 — structured server log for the domain-migration debug. Shows in
  // Vercel → Functions Logs when a user clicks an email-confirm link.
  // No token value is logged (only presence) — tokens are credentials.
  console.log("[auth/confirm]", {
    host: request.headers.get("host"),
    forwarded_host: request.headers.get("x-forwarded-host"),
    origin,
    token_present: !!tokenHash,
    type,
    error: searchParams.get("error"),
    error_description: searchParams.get("error_description"),
  });
  // Some templates pass `next` instead of `redirect_to`; honor both for
  // forwards-compat. Default lands on /auth/callback so the client can run
  // syncOnLogin + decide where to send the user.
  const next =
    searchParams.get("next") ??
    searchParams.get("redirect_to") ??
    "/auth/callback?completed=1";

  if (!tokenHash || !type) {
    // Stale or malformed link — send the user somewhere readable instead
    // of leaving them on a blank screen.
    return NextResponse.redirect(
      `${origin}/auth/callback?error=missing_params`,
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.redirect(
      `${origin}/auth/callback?error=supabase_not_configured`,
    );
  }

  const supabase = createClient(supabaseUrl, anonKey);
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    // The most common failures here are expired tokens (24-hour TTL) and
    // tokens that have already been consumed (re-clicking an old link).
    // R47 — structured error log (Vercel Functions Logs). The friendly
    // Hebrew message is mapped client-side on /auth/callback; we keep
    // redirecting there (richer error mapping) rather than /signup.
    console.error("[auth/confirm] verifyOtp failed", {
      message: error.message,
      status: error.status,
      name: error.name,
      origin,
    });
    await logError(
      {
        type: "auth",
        message: `confirm verifyOtp: ${error.message}`,
        url: `${origin}/auth/confirm`,
      },
      origin,
    );
    return NextResponse.redirect(
      `${origin}/auth/callback?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Honor the next/redirect_to param. We only allow same-origin redirects
  // so a malicious template can't smuggle the user to an arbitrary site.
  //
  // SECURITY: `next.startsWith("/")` alone is NOT enough — browsers treat
  // `//evil.com/path` as a protocol-relative URL, so `${origin}//evil.com`
  // navigates to `https://evil.com`. Same trap with `/\evil.com` on some
  // parsers. Reject both, plus anything that fails URL parsing or whose
  // resolved origin doesn't match.
  const safeNext = isSafeRelativePath(next, origin)
    ? `${origin}${next}`
    : `${origin}/auth/callback?completed=1`;
  return NextResponse.redirect(safeNext);
}

/** A `next` param is safe if it's a proper same-origin path, NOT a
 *  scheme-relative or backslash-protocol URL that would escape the
 *  origin. */
function isSafeRelativePath(next: string, origin: string): boolean {
  if (typeof next !== "string" || next.length === 0) return false;
  // Reject protocol-relative (`//host`), backslash (`/\host`), and any
  // value that doesn't start with a single forward slash.
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//") || next.startsWith("/\\")) return false;
  // Belt-and-suspenders: resolve and assert same origin. URL parsing
  // catches embedded control chars and odd whitespace that browsers
  // sometimes still follow.
  try {
    const resolved = new URL(next, origin);
    return resolved.origin === origin;
  } catch {
    return false;
  }
}
