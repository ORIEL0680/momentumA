import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * R91 (R73 fix) — server-side short-link lookup.
 *
 * The client-side `lookupShortLink` in lib/shortLinks.ts imports the
 * client-only `getSupabase` (via `"use client"`). Next 16 + Turbopack
 * now ENFORCE that boundary — calling it from a Server Component
 * (e.g. /i/[token]/page.tsx#generateMetadata + the page body) throws:
 *
 *   Attempted to call getSupabase() from the server but getSupabase
 *   is on the client.
 *
 * The thrown error was caught silently and the page rendered
 * "ההזמנה לא נמצאה" for EVERY short link. The DB / RPC / RLS were all
 * healthy — it was a code boundary issue.
 *
 * This module is server-only (`import "server-only"` at the top makes
 * Next refuse to bundle it into the client). It uses the anon Supabase
 * client constructed inline so it does NOT touch the `"use client"`
 * boundary. The `lookup_short_link` RPC is `SECURITY DEFINER` and
 * already granted to `anon`, so the anon key is all we need — no
 * service role required for this read.
 */
export async function lookupShortLinkServer(
  shortId: string,
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error(
      "[shortLinks-server] missing env: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    return null;
  }
  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = (await supabase.rpc("lookup_short_link", {
      p_short_id: shortId,
    })) as { data: string | null; error: { message?: string } | null };
    if (error) {
      console.error("[shortLinks-server] RPC failed", error);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (e) {
    console.error("[shortLinks-server] threw", e);
    return null;
  }
}
