/**
 * R64 (R79) — app-wide constants. Keep this file tiny and side-effect free
 * (no imports beyond types) so it can be pulled into client OR server code
 * without dragging extra modules into either bundle.
 */

/**
 * The single founder email that is ALWAYS admin, even if the
 * `admin_emails` table is empty / truncated / migrated away. Used as a
 * bypass in every admin gate (client + server). Do NOT add any other
 * values here — additional admins go via `INSERT INTO admin_emails`
 * in the Supabase SQL editor.
 */
export const FOUNDER_EMAIL = "talhemo132@gmail.com";

/** Lower-cased canonical form for safe comparison. */
export const FOUNDER_EMAIL_CANONICAL = FOUNDER_EMAIL.toLowerCase();

/** Compare a candidate email against the founder, case + whitespace insensitive. */
export function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === FOUNDER_EMAIL_CANONICAL;
}
