/**
 * R85 (R67 fix) — central normalizer for vendor social handles.
 *
 * Bug we kept hitting: vendors enter their Instagram in every imaginable
 * format and the catalog UI was naive-prepending `https://instagram.com/`.
 * Real entries we found in prod:
 *   • `@some_vendor`                            → handle, with @
 *   • `some_vendor`                              → handle, plain
 *   • `https://www.instagram.com/some_vendor`    → already a URL
 *   • `https://www.instagram.com/some_vendor/`   → URL with trailing /
 *   • `https://instagram.com/some_vendor?hl=he`  → URL with query
 *   • `instagram.com/some_vendor`                → URL without scheme
 *
 * Previous logic only did `raw.replace(/^@/, "")` then prefixed — so
 * URLs got encoded into the path like
 *   `https://instagram.com/https%3A%2F%2Fwww.instagram.com%2Fsome_vendor`
 * which Instagram serves as a "page not found".
 *
 * This module exports one builder per platform that returns either:
 *   • a clean `https://<canonical-host>/<handle>` URL, OR
 *   • `null` if the input is empty / unparseable / unsafe.
 */

const INSTAGRAM_HOST = "instagram.com";
const FACEBOOK_HOST = "facebook.com";

/** Strip whitespace, leading `@`, leading slashes, trailing slashes. */
function cleanHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .trim();
}

/**
 * Pull the handle out of any input string.
 *
 * Accepts handle-only inputs verbatim. If the input looks like a URL
 * (with or without scheme), parses it and returns the FIRST path
 * segment — that's the username/page for IG, FB, TikTok, etc.
 *
 * Returns null if the result is empty or contains characters that
 * can't be a valid social handle (spaces, slashes mid-string, etc.).
 */
function extractHandle(raw: string, expectedHosts: string[]): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // URL-shaped input: starts with http(s), or contains a "." (host).
  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) || /^[\w-]+\.[\w-]+/.test(trimmed);

  let candidate = trimmed;
  if (looksLikeUrl) {
    // Force a scheme so `new URL` can parse host-only entries.
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    try {
      const u = new URL(withScheme);
      const host = u.hostname.toLowerCase().replace(/^www\./, "");
      // Defense: refuse hosts that aren't the expected platform — a
      // vendor that pasted a Google Drive link into the Instagram field
      // shouldn't render as a working Instagram link.
      if (!expectedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
        return null;
      }
      // First path segment is the handle.
      candidate = u.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch {
      return null;
    }
  }

  const handle = cleanHandle(candidate);
  if (!handle) return null;
  // Conservative whitelist: letters, numbers, dots, underscores, hyphens.
  // Matches what IG / FB actually permit; rejects spaces / quotes /
  // anything that would break the URL.
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(handle)) return null;
  return handle;
}

/**
 * Build a canonical, safe Instagram profile URL — or null. Pass the
 * exact value the vendor typed; we'll handle the rest.
 */
export function buildInstagramUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const handle = extractHandle(raw, [INSTAGRAM_HOST]);
  if (!handle) return null;
  return `https://${INSTAGRAM_HOST}/${encodeURIComponent(handle)}`;
}

/** Same idea for Facebook. */
export function buildFacebookUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const handle = extractHandle(raw, [FACEBOOK_HOST]);
  if (!handle) return null;
  return `https://${FACEBOOK_HOST}/${encodeURIComponent(handle)}`;
}

/**
 * Validate a website URL. Vendors sometimes type `www.example.com`
 * (no scheme), so we add `https://` if missing. Returns null for
 * obvious junk (no dot, ftp://, javascript:, mailto:, etc.).
 */
export function buildWebsiteUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    // Allow only http/https — blocks javascript: / data: / mailto: etc.
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Require a hostname with at least one dot — rejects garbage like "foo".
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Convenience: build all three at once for a vendor row. Returns only
 * the platforms that resolved to a real URL.
 */
export interface VendorSocials {
  instagram?: string;
  facebook?: string;
  website?: string;
}
export function buildVendorSocials(input: {
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
}): VendorSocials {
  const out: VendorSocials = {};
  const ig = buildInstagramUrl(input.instagram);
  if (ig) out.instagram = ig;
  const fb = buildFacebookUrl(input.facebook);
  if (fb) out.facebook = fb;
  const web = buildWebsiteUrl(input.website);
  if (web) out.website = web;
  return out;
}

/**
 * Build a WhatsApp deep link given an Israeli phone number (any common
 * format) + optional pre-filled message. Returns null if the phone is
 * unrecognizable.
 */
export function buildWhatsAppUrl(
  rawPhone: string | null | undefined,
  message?: string,
): string | null {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;
  // 0XXXXXXXXX → 972XXXXXXXXX; 972XXXXXXXXX stays as-is.
  let normalized = digits;
  if (normalized.startsWith("0")) normalized = `972${normalized.slice(1)}`;
  if (!normalized.startsWith("972")) {
    // International number that's not Israel — still send to wa.me as-is.
    normalized = digits;
  }
  if (normalized.length < 9) return null;
  const base = `https://wa.me/${normalized}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
