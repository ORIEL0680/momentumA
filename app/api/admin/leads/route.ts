import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";

/**
 * R86 (R68) — global leads view for admin.
 *
 * vendor_leads has tight RLS (a vendor sees only leads addressed to
 * THEIR landing, a couple sees only leads they sent). Admin needs a
 * cross-tenant view — the service-role client bypasses RLS.
 *
 * Returns the leads joined with the vendor's display name so the admin
 * doesn't need a second round trip per row. Capped at 200 — anything
 * older paginates manually for now (we'll add cursor params when a
 * production catalog actually needs it).
 */
interface LeadRow {
  id: string;
  vendor_id: string; // slug of vendor_landings
  couple_user_id: string;
  couple_name: string | null;
  couple_email: string | null;
  couple_phone: string | null;
  message: string | null;
  status: string;
  source: string | null;
  created_at: string;
  updated_at: string;
}

interface LandingRow {
  slug: string;
  name: string;
  category: string | null;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { adminClient } = gate;

  const { data: leads, error: leadsErr } = await adminClient
    .from("vendor_leads")
    .select(
      "id, vendor_id, couple_user_id, couple_name, couple_email, couple_phone, message, status, source, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (leadsErr) {
    console.error("[admin-leads] fetch failed:", leadsErr);
    return NextResponse.json(
      { error: "fetch_failed", message: "טעינת לידים נכשלה." },
      { status: 500 },
    );
  }
  const rows = (leads ?? []) as LeadRow[];

  // Resolve vendor slugs → names in one batch. Empty list → skip.
  let vendorBySlug = new Map<string, LandingRow>();
  if (rows.length > 0) {
    const slugs = Array.from(new Set(rows.map((r) => r.vendor_id)));
    const { data: landings } = await adminClient
      .from("vendor_landings")
      .select("slug, name, category")
      .in("slug", slugs);
    vendorBySlug = new Map(
      (landings ?? []).map((l: LandingRow) => [l.slug, l]),
    );
  }

  // Compute open-too-long flag: leads still pending/contacted for >3 days
  // are worth flagging to the admin — vendor likely hasn't responded.
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const enriched = rows.map((r) => ({
    ...r,
    vendor_name: vendorBySlug.get(r.vendor_id)?.name ?? null,
    vendor_category: vendorBySlug.get(r.vendor_id)?.category ?? null,
    stale:
      (r.status === "pending" || r.status === "contacted") &&
      new Date(r.created_at).getTime() < threeDaysAgo,
  }));

  return NextResponse.json({ leads: enriched, total: enriched.length });
}
