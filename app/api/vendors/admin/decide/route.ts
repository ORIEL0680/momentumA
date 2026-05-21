import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isFounderEmail } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/service";
import { sendVendorApprovalEmail } from "@/lib/vendorNotifications";

export async function POST(req: NextRequest) {
  console.log("[vendors-decide] request received");
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("[vendors-decide] missing env vars");
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 503 },
      );
    }

    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userToken = auth.slice(7);

    // R83 (R65 follow-up) — TWO clients now:
    //   • userClient (anon + JWT) — proves identity ONLY.
    //   • adminClient (service role) — does the actual UPDATE.
    //
    // The earlier single-client approach used the user JWT for BOTH the
    // identity check and the UPDATE. Under RLS, the UPDATE would
    // silently filter to 0 rows if the founder's email row in
    // admin_emails was missing or RLS got confused, and the admin would
    // see "הבקשה כבר אושרה/נדחתה" — or worse, the row.id would be
    // missing from the .select() return and the route would 409.
    // Symptom: status stuck at 'pending' even after clicking אשר.
    //
    // Service-role for the UPDATE bypasses RLS entirely. The admin
    // gate stays in app code (isFounderEmail OR admin_emails check
    // via the user-bound client), so non-admins still can't reach it.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Admin gate (in-app — not RLS).
    // R64 (R79) — founder bypass before the DB lookup so the admin
    // surface is reachable even if admin_emails was wiped.
    if (!isFounderEmail(user.email)) {
      const { data: adminCheck } = await userClient
        .from("admin_emails")
        .select("email")
        .eq("email", user.email)
        .maybeSingle();
      if (!adminCheck) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
    }

    // Service-role client for the UPDATE.
    const adminClient = createServiceClient();

    const { applicationId, decision, rejectionReason } = (await req.json()) as {
      applicationId: string;
      decision: "approved" | "rejected";
      rejectionReason?: string;
    };

    if (!applicationId || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      status: decision,
      reviewed_at: new Date().toISOString(),
    };
    if (decision === "rejected" && rejectionReason) {
      updates.rejection_reason = rejectionReason;
    }
    // R38 — the catalog is now table-backed: /vendors reads approved
    // applications via the list_approved_vendors RPC and maps each to a
    // Vendor with id `app-<application id>`. Stamp that id here so the
    // application is marked "synced to catalog" (clears the admin
    // "approved but not in catalog" warning) — no separate vendors
    // table needed; the row IS the catalog source.
    if (decision === "approved") {
      updates.approved_vendor_id = `app-${applicationId}`;
    }

    // Catalog integration — Phase 0 quirk:
    //
    // The customer-facing catalog (`lib/vendors.ts`) is a STATIC TypeScript
    // array, not a Supabase table. There's nothing to insert into at the
    // moment of approval. We:
    //   1. Mark the application as approved.
    //   2. Leave `approved_vendor_id` null until the catalog moves to a
    //      table-backed source. When that happens, the admin route will
    //      insert into the new table here and stamp the resulting id.
    //
    // TODO(catalog): once a `vendors` table exists, insert here:
    //   const { data: vendorRow } = await supabase.from("vendors").insert({...}).select("id").single();
    //   updates.approved_vendor_id = vendorRow?.id ?? null;
    //
    // Mapping reference (vendorApplication.category → VendorType in
    // lib/types.ts):
    //   "music-dj" → "dj" (band → also dj for now; collapse on import)
    //   "bridal", "groomswear" → "dress"
    //   "makeup-hair" → "makeup"
    //   "invitations" → "stationery"
    //   "transport" → "transportation"
    //   "chuppah" → "designer"
    //   everything else maps 1:1 by id.

    // Race protection: only update rows still pending. Two admins clicking
    // at the same time used to cause the second to silently overwrite the
    // first. The `eq("status", "pending")` clause filters out any row that
    // already moved on, and we treat "0 affected rows" as a 409 conflict.
    // R83 — UPDATE via service-role to bypass RLS. Admin gate already
    // enforced above (isFounderEmail OR admin_emails query).
    const { data: updated, error: updateErr } = await adminClient
      .from("vendor_applications")
      .update(updates)
      .eq("id", applicationId)
      .eq("status", "pending")
      .select("id, email, contact_name, business_name");

    if (updateErr) {
      console.error("[vendors-decide] update failed:", {
        code: updateErr.code,
        message: updateErr.message,
        details: updateErr.details,
        hint: updateErr.hint,
      });
      return NextResponse.json({ error: "פעולה נכשלה" }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "הבקשה כבר אושרה/נדחתה" }, { status: 409 });
    }
    console.log(
      `[vendors-decide] ${decision} application ${applicationId} (${updated[0]?.business_name ?? "?"})`,
    );

    // R80 (R65) — fire the vendor welcome email on approval. Failure
    // does NOT roll the approval back (the DB row is the source of
    // truth); we log so the admin can see it in the notifications log
    // if Resend ever stalled.
    if (decision === "approved") {
      const row = updated[0] as {
        id: string;
        email: string;
        contact_name: string;
        business_name: string;
      };
      try {
        const result = await sendVendorApprovalEmail({
          email: row.email,
          contact_name: row.contact_name,
          business_name: row.business_name,
        });
        // R83 — write the log via the service-role client too. The
        // notifications-log table has a restrictive insert policy; using
        // service role makes the insert bulletproof.
        await adminClient.from("vendor_notifications_log").insert({
          application_id: row.id,
          channel: result.channel,
          status: result.status,
          error: result.error ?? null,
        });
      } catch (mailErr) {
        console.error("[vendors-decide] welcome email failed:", mailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    // R19 security: full error stays in server logs, generic message to client.
    console.error("[/api/vendors/admin/decide]", e);
    return NextResponse.json(
      { error: "פעולה נכשלה" },
      { status: 500 },
    );
  }
}
