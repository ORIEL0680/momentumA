import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";
import { findAuthUserByEmail } from "@/lib/supabase/findAuthUserByEmail";

/**
 * R122 — POST /api/admin/vendors/backfill-landing
 *
 * Repairs vendor applications that are `status='approved'` but never
 * got their `vendor_landings` row. Two real-world causes:
 *
 *   1. The original R116 approval flow used `listUsers()` without
 *      pagination → any vendor past auth.users[50] was invisible to
 *      the email match. The fix in `findAuthUserByEmail` solves
 *      future approvals, but doesn't repair vendors already stuck.
 *      "דפוס אומן" was reported as exactly this case.
 *
 *   2. A transient insert failure (network blip, constraint conflict)
 *      while the approval route's landing-insert ran. The approval
 *      was committed but the landing wasn't.
 *
 * This endpoint accepts either:
 *   • `{ applicationId: string }` — backfill one specific application.
 *   • `{}` — sweep mode: find every approved application that's
 *     missing a landing and try to create each. Logs per-vendor result.
 *
 * Idempotent: skips vendors who already have a landing.
 *
 * Returns a per-row report so the admin UI can show exactly which
 * vendors got fixed and which still need attention (no auth user,
 * insert blocked, etc.).
 */

interface ReportRow {
  applicationId: string;
  businessName: string;
  email: string;
  outcome:
    | "created"
    | "already-exists"
    | "no-auth-user"
    | "insert-failed"
    | "skipped-not-approved";
  slug?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const adminClient = gate.adminClient;

  // Parse body once. Empty body = sweep mode.
  let body: { applicationId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  // Fetch the candidate rows: either one specific application or
  // every approved application without a landing.
  let candidates: Array<{
    id: string;
    email: string;
    business_name: string;
    contact_name: string;
    category: string | null;
    city: string | null;
    phone: string | null;
    website: string | null;
    instagram: string | null;
    facebook: string | null;
    about: string | null;
    years_in_field: number | null;
    status: string;
  }>;

  if (body.applicationId) {
    const { data, error } = await adminClient
      .from("vendor_applications")
      .select(
        "id, email, business_name, contact_name, category, city, phone, website, instagram, facebook, about, years_in_field, status",
      )
      .eq("id", body.applicationId)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: "Application lookup failed", details: error.message },
        { status: 500 },
      );
    }
    candidates = data ? [data] : [];
  } else {
    const { data, error } = await adminClient
      .from("vendor_applications")
      .select(
        "id, email, business_name, contact_name, category, city, phone, website, instagram, facebook, about, years_in_field, status",
      )
      .eq("status", "approved")
      .order("created_at", { ascending: true });
    if (error) {
      return NextResponse.json(
        { error: "Sweep query failed", details: error.message },
        { status: 500 },
      );
    }
    candidates = data ?? [];
  }

  const report: ReportRow[] = [];

  for (const row of candidates) {
    if (row.status !== "approved") {
      report.push({
        applicationId: row.id,
        businessName: row.business_name,
        email: row.email,
        outcome: "skipped-not-approved",
      });
      continue;
    }

    // Look up the auth user by email — paginated, robust against
    // the 50-user listUsers default that bit דפוס אומן.
    const authUser = await findAuthUserByEmail(adminClient, row.email);
    if (!authUser) {
      report.push({
        applicationId: row.id,
        businessName: row.business_name,
        email: row.email,
        outcome: "no-auth-user",
      });
      continue;
    }

    // Already have a landing? Skip — the vendor is fine.
    const { data: existing } = await adminClient
      .from("vendor_landings")
      .select("id, slug")
      .eq("owner_user_id", authUser.id)
      .maybeSingle();
    if (existing) {
      report.push({
        applicationId: row.id,
        businessName: row.business_name,
        email: row.email,
        outcome: "already-exists",
        slug: (existing as { id: string; slug: string }).slug,
      });
      continue;
    }

    // Mint the slug + insert. Same logic as the decide route.
    const baseSlug =
      row.business_name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9֐-׿]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "vendor";
    const slug = `${baseSlug}-${row.id.slice(0, 8)}`;
    const { error: insertErr } = await adminClient
      .from("vendor_landings")
      .insert({
        slug,
        owner_user_id: authUser.id,
        name: row.business_name,
        category: row.category ?? null,
        city: row.city ?? null,
        phone: row.phone ?? null,
        email: row.email,
        website: row.website ?? null,
        instagram: row.instagram ?? null,
        facebook: row.facebook ?? null,
        about_long: row.about ?? null,
        years_experience: row.years_in_field ?? null,
        landing_published: true,
      });
    if (insertErr) {
      report.push({
        applicationId: row.id,
        businessName: row.business_name,
        email: row.email,
        outcome: "insert-failed",
        error: insertErr.message,
      });
      console.error(
        `[backfill-landing] insert failed for ${row.business_name}:`,
        insertErr,
      );
      continue;
    }
    report.push({
      applicationId: row.id,
      businessName: row.business_name,
      email: row.email,
      outcome: "created",
      slug,
    });
    console.log(
      `[backfill-landing] created vendor_landings ${slug} for ${row.business_name}`,
    );
  }

  const summary = {
    total: report.length,
    created: report.filter((r) => r.outcome === "created").length,
    alreadyExists: report.filter((r) => r.outcome === "already-exists")
      .length,
    noAuthUser: report.filter((r) => r.outcome === "no-auth-user").length,
    insertFailed: report.filter((r) => r.outcome === "insert-failed").length,
  };

  return NextResponse.json({ summary, report });
}
