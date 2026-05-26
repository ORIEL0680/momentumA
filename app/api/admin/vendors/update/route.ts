import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";
import { VENDOR_CATEGORIES } from "@/lib/vendorApplication";

/**
 * R130 — POST /api/admin/vendors/update
 *
 * Lets the admin edit core fields on a vendor application: business
 * name, category, city, phone, website, instagram, facebook. Used by
 * the inline "ערוך" button on /admin/dashboard's VendorControlPanel
 * and the full /admin/vendors page.
 *
 * Whitelisted fields only — the admin can't (and shouldn't) overwrite
 * status, deleted_at, featured_at, or any audit/timestamps via this
 * endpoint. Those have their own dedicated routes.
 *
 * Audit logged. Service-role write so RLS can't accidentally block a
 * legitimate admin edit.
 */

// `Set<string>` so the runtime check (line 74) is unconstrained by
// the readonly tuple literal type — categories are validated against
// a plain string set rather than a discriminated union.
const ALLOWED_CATEGORIES: Set<string> = new Set(
  VENDOR_CATEGORIES.map((c) => c.id),
);

interface UpdateBody {
  vendorId?: string;
  business_name?: string;
  category?: string;
  city?: string;
  phone?: string;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  about?: string | null;
}

export async function POST(req: NextRequest) {
  console.log("[admin-vendors-update] request received");
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { adminClient, email: adminEmail } = gate;

  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
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

  // Build the patch object from whitelisted fields. Each field is
  // trimmed + length-capped so the admin can't smuggle huge values
  // past the form-side validation.
  const patch: Record<string, string | null> = {};
  if (typeof body.business_name === "string") {
    const v = body.business_name.trim().slice(0, 200);
    if (!v) {
      return NextResponse.json(
        { error: "empty_business_name", message: "שם עסק לא יכול להיות ריק." },
        { status: 400 },
      );
    }
    patch.business_name = v;
  }
  if (typeof body.category === "string") {
    if (!ALLOWED_CATEGORIES.has(body.category)) {
      return NextResponse.json(
        { error: "bad_category", message: "קטגוריה לא חוקית." },
        { status: 400 },
      );
    }
    patch.category = body.category;
  }
  if (typeof body.city !== "undefined") {
    patch.city = body.city ? body.city.trim().slice(0, 100) : null;
  }
  if (typeof body.phone !== "undefined") {
    patch.phone = body.phone ? body.phone.trim().slice(0, 30) : null;
  }
  if (typeof body.website !== "undefined") {
    patch.website = body.website ? body.website.trim().slice(0, 500) : null;
  }
  if (typeof body.instagram !== "undefined") {
    patch.instagram = body.instagram
      ? body.instagram.trim().slice(0, 100)
      : null;
  }
  if (typeof body.facebook !== "undefined") {
    patch.facebook = body.facebook ? body.facebook.trim().slice(0, 100) : null;
  }
  if (typeof body.about !== "undefined") {
    patch.about = body.about ? body.about.trim().slice(0, 1500) : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "nothing_to_update", message: "אין שום שדה לעדכון." },
      { status: 400 },
    );
  }

  const { data: updated, error } = await adminClient
    .from("vendor_applications")
    .update(patch)
    .eq("id", vendorId)
    .select("id, business_name, category, city, phone, website, instagram, facebook, about");
  if (error) {
    console.error("[admin-vendors-update]", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: "db_update_failed", message: "העדכון נכשל." },
      { status: 500 },
    );
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "not_found", message: "הספק לא נמצא." },
      { status: 404 },
    );
  }

  try {
    await adminClient.from("admin_audit_log").insert({
      admin_email: adminEmail,
      action: "vendor_update",
      target_id: vendorId,
      reason: null,
      metadata: {
        business_name: updated[0]?.business_name,
        changed_fields: Object.keys(patch),
      },
    });
  } catch (e) {
    console.error("[admin-vendors-update] audit insert failed:", e);
  }

  console.log(
    `[admin-vendors-update] updated ${vendorId} fields=[${Object.keys(patch).join(",")}] by ${adminEmail}`,
  );
  return NextResponse.json({ success: true, vendor: updated[0] });
}
