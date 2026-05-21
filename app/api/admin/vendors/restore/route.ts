import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";

/**
 * R67 (R84) — restore a soft-deleted vendor. The mirror of /delete.
 * Sets `deleted_at` back to null so the row reappears in the catalog.
 * Audited just like delete.
 */
export async function POST(req: NextRequest) {
  console.log("[admin-vendors-restore] request received");
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { adminClient, email: adminEmail } = gate;

  let body: { vendorId?: string };
  try {
    body = (await req.json()) as { vendorId?: string };
  } catch {
    return NextResponse.json(
      { error: "bad_json", message: "גוף הבקשה לא תקין." },
      { status: 400 },
    );
  }
  const vendorId = body.vendorId?.trim();
  if (!vendorId) {
    return NextResponse.json(
      { error: "missing_vendor_id", message: "חסר vendorId." },
      { status: 400 },
    );
  }

  const { data: restored, error: updateErr } = await adminClient
    .from("vendor_applications")
    .update({
      deleted_at: null,
      deleted_by_email: null,
      deletion_reason: null,
    })
    .eq("id", vendorId)
    .eq("status", "approved")
    .not("deleted_at", "is", null)
    .select("id, business_name");

  if (updateErr) {
    console.error("[admin-vendors-restore] update failed:", {
      code: updateErr.code,
      message: updateErr.message,
    });
    return NextResponse.json(
      { error: "db_update_failed", message: "שחזור נכשל." },
      { status: 500 },
    );
  }
  if (!restored || restored.length === 0) {
    return NextResponse.json(
      { error: "not_found", message: "הספק לא נמצא או שאינו מחוק." },
      { status: 404 },
    );
  }

  try {
    await adminClient.from("admin_audit_log").insert({
      admin_email: adminEmail,
      action: "vendor_restore",
      target_id: vendorId,
      metadata: { business_name: restored[0]?.business_name },
    });
  } catch (e) {
    console.error("[admin-vendors-restore] audit insert failed:", e);
  }

  console.log(
    `[admin-vendors-restore] restored ${vendorId} (${restored[0]?.business_name ?? "?"}) by ${adminEmail}`,
  );
  return NextResponse.json({ success: true, vendorId });
}
