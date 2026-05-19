/**
 * R59 (R49) — admin realtime channel.
 *
 * Subscribes to INSERTs on the tables that actually exist in this app's
 * schema (no `events`/`user_profiles` table — events live as a JSON
 * blob in `app_states`). Returns an unsubscribe fn; never throws.
 */
"use client";

import { getSupabase } from "@/lib/supabase";

export type ActivityKind = "state" | "vendor" | "review";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  label: string;
  at: string; // ISO
}

interface InsertPayload {
  new: Record<string, unknown>;
}

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * @param onItem called for every new row. Returns a cleanup that
 * removes the channel (safe to call even if subscription failed).
 */
export function subscribeAdminActivity(
  onItem: (item: ActivityItem) => void,
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  let seq = 0;
  const stamp = (kind: ActivityKind, label: string, at: unknown) => {
    seq += 1;
    onItem({
      id: `${kind}-${Date.now()}-${seq}`,
      kind,
      label,
      at: s(at) || new Date().toISOString(),
    });
  };

  const channel = supabase
    .channel("admin-activity")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "app_states" },
      (p) => {
        const row = (p as unknown as InsertPayload).new;
        stamp("state", "משתמש חדש סנכרן אירוע", row.updated_at);
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "vendor_applications" },
      (p) => {
        const row = (p as unknown as InsertPayload).new;
        stamp(
          "vendor",
          `בקשת ספק חדשה: ${s(row.business_name) || "ללא שם"}`,
          row.created_at,
        );
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "vendor_reviews" },
      (p) => {
        const row = (p as unknown as InsertPayload).new;
        stamp(
          "review",
          `ביקורת חדשה: ${s(row.vendor_name) || "ספק"}`,
          row.created_at,
        );
      },
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      /* noop */
    }
  };
}
