import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * R122 — Find an auth user by email, paging through `listUsers()` until
 * we hit them or run out of pages.
 *
 * Why this exists: `supabase.auth.admin.listUsers()` returns at most
 * 50 users per call by default. The vendor-approval route used to call
 * it without pagination and just `.find()` in the result. Any vendor
 * whose auth.users row was beyond entry #50 (sorted by `created_at`,
 * which Supabase uses internally) would be invisible to the lookup,
 * the landing row was never created, and the vendor's dashboard kept
 * showing "no profile" forever.
 *
 * The reported case: "דפוס אומן" — a vendor who applied recently and
 * had been waiting to see their dashboard despite an explicit
 * approval. The list had grown past 50 users, so this fix is the
 * direct unblock.
 *
 * Strategy:
 *   • Page through with `perPage: 200` (caps at 200 per Supabase docs)
 *   • Lowercase both sides before comparison (Supabase normalizes
 *     email on signup but defense in depth)
 *   • Trim whitespace (typo prevention)
 *   • Hard cap at 50 pages = 10,000 users — anything past that and
 *     we have bigger problems (and should switch to a SQL function
 *     that queries auth.users by email directly via service role)
 *
 * Returns the matching user or `null` if exhausted.
 */
export async function findAuthUserByEmail(
  client: SupabaseClient,
  email: string,
): Promise<{ id: string; email: string | null } | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;

  const PER_PAGE = 200;
  const MAX_PAGES = 50;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) {
      console.error(
        `[findAuthUserByEmail] listUsers page ${page} failed:`,
        error.message,
      );
      return null;
    }
    const users = data?.users ?? [];
    if (users.length === 0) return null;
    const found = users.find(
      (u) => u.email && u.email.trim().toLowerCase() === needle,
    );
    if (found) return { id: found.id, email: found.email ?? null };
    // If we got fewer than perPage rows, there are no more pages.
    if (users.length < PER_PAGE) return null;
  }
  console.warn(
    `[findAuthUserByEmail] exhausted ${MAX_PAGES} pages of ${PER_PAGE} users without finding ${needle}`,
  );
  return null;
}
