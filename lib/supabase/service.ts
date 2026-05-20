import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * R68 (R57) — shared service-role Supabase client constructor.
 *
 * Centralized so future API routes don't have to re-implement the same
 * boilerplate. Older routes (admin/stats, admin/users, admin/errors,
 * log-error, send-scheduled, seed-brain) still inline the construction
 * inside `lib/admin/server.ts#requireAdmin` or their own files; they
 * keep working as-is and can migrate to this helper opportunistically.
 *
 * NEVER import this from a "use client" file — the service-role key
 * must stay on the server. The `server-only` import enforces that at
 * build time (Next will refuse to bundle this for the client).
 *
 * Throws if either required env var is missing — the typical caller is
 * a route handler that should respond 503 with a clear message; let
 * the route's try/catch convert this into an HTTP error.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service-role client unavailable: " +
        "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
