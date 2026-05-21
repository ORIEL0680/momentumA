import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";

/**
 * R86 (R68) — admin audit log feed.
 *
 * admin_audit_log RLS lets each admin see only their OWN actions
 * (`admin_email = auth.jwt() ->> 'email'`). Founder/admin oversight
 * needs to see EVERY admin's actions, so this endpoint uses
 * service-role + requireAdmin gate.
 *
 * Returns the most recent 100 events with the metadata jsonb already
 * parsed.
 */
interface AuditRow {
  id: string;
  admin_email: string;
  action: string;
  target_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;
  const { adminClient } = gate;

  const { data, error } = await adminClient
    .from("admin_audit_log")
    .select("id, admin_email, action, target_id, reason, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[admin-audit] fetch failed:", error);
    return NextResponse.json(
      { error: "fetch_failed", message: "טעינת היומן נכשלה." },
      { status: 500 },
    );
  }
  return NextResponse.json({ events: (data ?? []) as AuditRow[] });
}
