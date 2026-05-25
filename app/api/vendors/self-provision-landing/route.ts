import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { createVendorLandingForApplication } from "@/lib/supabase/createVendorLanding";

/**
 * R123 — POST /api/vendors/self-provision-landing
 *
 * Vendor-callable endpoint that lazily creates the vendor's landing
 * row the FIRST TIME they open /vendors/dashboard, when:
 *
 *   • Their email has an approved row in `vendor_applications`, AND
 *   • They don't have a `vendor_landings` row yet.
 *
 * Why we need this:
 *   The admin "approve" flow tries to create the landing immediately.
 *   But if a vendor applied to the form BEFORE signing up for the
 *   app (very common — applicants don't always make accounts at
 *   the time they submit the form), there's no `auth.users` row to
 *   set as `owner_user_id`. The approval route logs the case and
 *   moves on; the landing stays unset forever.
 *
 *   Pre-R123 this required the admin to click "תיקון ספקים תקועים"
 *   every time a new vendor signed up. R123 fixes it properly: the
 *   moment the vendor opens their dashboard, useVendorContext sees
 *   "approved application + no landing" and POSTs here. The
 *   endpoint verifies (server-side) that the caller's JWT email
 *   matches an approved application, then service-role creates the
 *   landing. The next dashboard render sees it.
 *
 * Security:
 *   The Authorization header carries the vendor's JWT. We use an
 *   anon client bound to that JWT to call `auth.getUser()` — that
 *   tells us, server-verified, who the caller is. We then look up
 *   the application by THE JWT EMAIL (not by anything the client
 *   sends in the body), and only create a landing for THAT user's
 *   own application. A malicious caller can't trick the endpoint
 *   into creating someone else's landing.
 */

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
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

  // Verify the caller's identity. The anon client + JWT path is the
  // standard pattern in this codebase (see decide route, requireAdmin).
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user?.email || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userEmail = user.email.trim().toLowerCase();
  const userId = user.id;

  const adminClient = createServiceClient();

  // 1. Does this user have an approved application?
  //    We use service role so RLS misconfigurations can't hide an
  //    application the user really owns. ilike makes the match
  //    case-insensitive in case a legacy row was inserted before
  //    the apply route lowercased emails (R122).
  const { data: appRow, error: appErr } = await adminClient
    .from("vendor_applications")
    .select(
      "id, email, business_name, category, city, phone, website, instagram, facebook, about, years_in_field, status",
    )
    .ilike("email", userEmail)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (appErr) {
    console.error("[self-provision-landing] application lookup failed:", appErr);
    return NextResponse.json(
      { error: "Lookup failed" },
      { status: 500 },
    );
  }
  if (!appRow) {
    // Not an eligible vendor (no approved application). Returning
    // 200 with `eligible: false` because this isn't an error — it's
    // the expected response for every regular host.
    return NextResponse.json({ eligible: false });
  }

  // 2. Create or find the landing. The helper handles the "already
  //    exists" branch idempotently so two concurrent dashboard tabs
  //    don't double-insert.
  const outcome = await createVendorLandingForApplication(
    adminClient,
    appRow,
    userId,
  );

  if (outcome.status === "insert-failed") {
    console.error(
      `[self-provision-landing] insert failed for ${userEmail}:`,
      outcome.error,
    );
    return NextResponse.json(
      { eligible: true, status: "insert-failed", error: outcome.error },
      { status: 500 },
    );
  }

  // Created OR already-exists — both are "vendor can see dashboard now".
  console.log(
    `[self-provision-landing] ${outcome.status} ${outcome.slug} for ${userEmail}`,
  );
  return NextResponse.json({
    eligible: true,
    status: outcome.status,
    slug: outcome.slug,
  });
}
