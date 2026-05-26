import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";

/**
 * R131 — GET /api/admin/vendors/list
 *
 * Returns every row from `vendor_applications` via the service-role
 * client. Used by the inline VendorControlPanel on /admin/dashboard.
 *
 * Why a dedicated endpoint instead of a client-side
 * `supabase.from("vendor_applications").select("*")` call?
 *
 *   R130 ran the query under the user's anon JWT and hit
 *   "permission denied for table users". The exact RLS rule causing
 *   that error isn't ours to debug — it lives in Postgres and may
 *   reference an internal `users` lookup. Service-role bypasses RLS
 *   entirely, so the panel's data load is no longer at the mercy of
 *   policy drift. The /admin/vendors page hits a different RLS
 *   policy path (older surface predates the offending one); since
 *   we can't be sure which surface will break next, every admin
 *   read in R131+ goes through service-role endpoints.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { adminClient } = gate;

  const { data, error } = await adminClient
    .from("vendor_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin-vendors-list]", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: "db_query_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ vendors: data ?? [] });
}
