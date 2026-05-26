import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";

/**
 * R125 — POST /api/admin/vendors/feature
 *
 * Pin / unpin a vendor in the public catalog. The catalog RPC
 * (`list_approved_vendors`) sorts by `featured_at desc nulls last`,
 * so a pinned vendor appears at the very top of every catalog
 * query that includes their category.
 *
 * Body:
 *   { vendorId: string, featured: boolean, rank?: number }
 *
 * featured = true   → stamps featured_at = now() and (optionally)
 *                     sets featured_rank for tie-breaking between
 *                     multiple pinned vendors.
 * featured = false  → clears featured_at + featured_rank, vendor
 *                     returns to chronological order.
 *
 * Audit-logged. Idempotent. Service-role writes only.
 */
export async function POST(req: NextRequest) {
  console.log("[admin-vendors-feature] request received");
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { adminClient, email: adminEmail } = gate;

  let body: { vendorId?: string; featured?: boolean; rank?: number };
  try {
    body = (await req.json()) as {
      vendorId?: string;
      featured?: boolean;
      rank?: number;
    };
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
  if (typeof body.featured !== "boolean") {
    return NextResponse.json(
      {
        error: "missing_featured_flag",
        message: "חסר ערך לפיצ׳ר (true / false).",
      },
      { status: 400 },
    );
  }

  const featured = body.featured;
  const rank =
    featured && typeof body.rank === "number" && Number.isFinite(body.rank)
      ? Math.max(0, Math.min(100, Math.round(body.rank)))
      : null;

  const patch = featured
    ? {
        featured_at: new Date().toISOString(),
        featured_rank: rank,
      }
    : {
        featured_at: null,
        featured_rank: null,
      };

  const { data: updated, error } = await adminClient
    .from("vendor_applications")
    .update(patch)
    .eq("id", vendorId)
    .eq("status", "approved")
    .is("deleted_at", null)
    .select("id, business_name, featured_at, featured_rank");
  if (error) {
    console.error("[admin-vendors-feature] update failed:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: "db_update_failed", message: "הפעולה נכשלה." },
      { status: 500 },
    );
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      {
        error: "not_found_or_not_approved",
        message: "הספק לא נמצא או שאינו מאושר.",
      },
      { status: 404 },
    );
  }

  // Best-effort audit log. Failures don't unwind the update.
  try {
    await adminClient.from("admin_audit_log").insert({
      admin_email: adminEmail,
      action: featured ? "vendor_feature" : "vendor_unfeature",
      target_id: vendorId,
      reason: null,
      metadata: {
        business_name: updated[0]?.business_name,
        rank,
      },
    });
  } catch (e) {
    console.error("[admin-vendors-feature] audit insert failed:", e);
  }

  console.log(
    `[admin-vendors-feature] ${featured ? "pinned" : "unpinned"} ${vendorId} (${updated[0]?.business_name}) by ${adminEmail}`,
  );
  return NextResponse.json({
    success: true,
    vendorId,
    featured,
    featuredAt: updated[0]?.featured_at,
    featuredRank: updated[0]?.featured_rank,
  });
}
