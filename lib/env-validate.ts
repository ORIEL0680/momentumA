/**
 * R47 — startup sanity check for the public-origin env var, so a
 * mis-set or stale value after the moomentum.events migration shows up
 * loudly in Vercel build/Function logs instead of silently breaking
 * auth redirects.
 *
 * Pure logging only — never throws (a hard crash at import time would
 * take the whole app down for a non-fatal misconfig). Server-side only.
 */
export function validateEnv(): void {
  const url = process.env.NEXT_PUBLIC_SITE_URL;

  if (!url) {
    console.error("[env] ❌ NEXT_PUBLIC_SITE_URL is missing!");
    return;
  }

  if (url.includes("momentum-psi-ten")) {
    console.warn(
      "[env] ⚠️ NEXT_PUBLIC_SITE_URL still points to the old domain:",
      url,
    );
  }

  if (!url.startsWith("https://")) {
    console.warn("[env] ⚠️ NEXT_PUBLIC_SITE_URL should use https://:", url);
  }
}
