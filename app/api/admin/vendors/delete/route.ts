import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";

/**
 * R67 (R84) — soft-delete an approved vendor from the catalog.
 *
 * Sets `deleted_at` on the vendor_applications row (NOT a hard DELETE)
 * so we keep an audit trail and can restore. The catalog RPC
 * `list_approved_vendors` filters out rows with `deleted_at is not null`,
 * so the vendor disappears from /vendors immediately. The /vendor/[slug]
 * landing page is unaffected — it lives in a separate table
 * (vendor_landings, owned by the vendor's auth user).
 *
 * Auth: requireAdmin (JWT verified, admin_emails OR founder bypass).
 * Writes: service-role client (bypasses RLS).
 * Audit: every call inserts a row into admin_audit_log.
 */
export async function POST(req: NextRequest) {
  console.log("[admin-vendors-delete] request received");
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { adminClient, email: adminEmail } = gate;

  let body: { vendorId?: string; reason?: string };
  try {
    body = (await req.json()) as { vendorId?: string; reason?: string };
  } catch {
    return NextResponse.json(
      { error: "bad_json", message: "גוף הבקשה לא תקין." },
      { status: 400 },
    );
  }
  const vendorId = body.vendorId?.trim();
  const reason = body.reason?.trim() || null;
  if (!vendorId) {
    return NextResponse.json(
      { error: "missing_vendor_id", message: "חסר vendorId." },
      { status: 400 },
    );
  }

  // Soft-delete + return the business_name so we can log it. Only
  // delete rows that are currently approved and not already deleted
  // (idempotent — second call no-ops).
  const { data: deleted, error: updateErr } = await adminClient
    .from("vendor_applications")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_email: adminEmail,
      deletion_reason: reason,
    })
    .eq("id", vendorId)
    .eq("status", "approved")
    .is("deleted_at", null)
    .select("id, business_name");

  if (updateErr) {
    console.error("[admin-vendors-delete] update failed:", {
      code: updateErr.code,
      message: updateErr.message,
      details: updateErr.details,
      hint: updateErr.hint,
    });
    return NextResponse.json(
      { error: "db_update_failed", message: "מחיקה נכשלה." },
      { status: 500 },
    );
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      { error: "not_found_or_not_approved", message: "ספק לא נמצא או שכבר נמחק." },
      { status: 404 },
    );
  }

  // Audit-log the action.
  try {
    await adminClient.from("admin_audit_log").insert({
      admin_email: adminEmail,
      action: "vendor_delete",
      target_id: vendorId,
      reason,
      metadata: { business_name: deleted[0]?.business_name },
    });
  } catch (e) {
    // Audit failures are non-fatal — the soft-delete already happened.
    console.error("[admin-vendors-delete] audit insert failed:", e);
  }

  console.log(
    `[admin-vendors-delete] soft-deleted ${vendorId} (${deleted[0]?.business_name ?? "?"}) by ${adminEmail}`,
  );
  return NextResponse.json({ success: true, vendorId });
}
