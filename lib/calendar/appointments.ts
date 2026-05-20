"use client";

/**
 * R67 (R56) — client-side CRUD for the `appointments` table.
 *
 * The `appointments` RLS policy lets a user manage their own rows, so
 * we use the browser Supabase client directly instead of round-tripping
 * through a service-role API. (Server routes still exist for seed-brain
 * because that one needs the user's JWT context but writes 20+ rows
 * atomically — easier in a single trip.)
 *
 * All functions accept/return JS Date objects; conversion to/from
 * Postgres `timestamptz` happens via toISOString.
 */

import { getSupabase } from "@/lib/supabase";
import type { AppointmentCategory } from "./wedding-brain";

export interface Appointment {
  id: string;
  user_id: string;
  event_id: string | null;
  vendor_id: string | null;
  title: string;
  description: string | null;
  start_at: string; // ISO
  end_at: string; // ISO
  location: string | null;
  color: string;
  category: AppointmentCategory;
  source: "manual" | "ai_suggestion";
  ai_status: "pending" | "accepted" | "dismissed" | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentInput {
  title: string;
  description?: string | null;
  start_at: Date;
  end_at: Date;
  location?: string | null;
  color?: string;
  category: AppointmentCategory;
  vendor_id?: string | null;
  event_id?: string | null;
}

/**
 * List appointments owned by the current user, optionally restricted to
 * a date range. Excludes dismissed AI suggestions by default.
 */
export async function listAppointments(opts?: {
  from?: Date;
  to?: Date;
  includeDismissed?: boolean;
}): Promise<Appointment[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let q = supabase
    .from("appointments")
    .select("*")
    .order("start_at", { ascending: true });
  if (opts?.from) q = q.gte("start_at", opts.from.toISOString());
  if (opts?.to) q = q.lte("start_at", opts.to.toISOString());
  if (!opts?.includeDismissed) {
    // Hide rows whose ai_status is dismissed; show everything else
    // (manual rows have NULL ai_status; pending/accepted suggestions
    // should both appear).
    q = q.or("ai_status.is.null,ai_status.neq.dismissed");
  }
  const { data, error } = (await q) as {
    data: Appointment[] | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error("[calendar/listAppointments]", error.message);
    return [];
  }
  return data ?? [];
}

export async function createAppointment(
  input: AppointmentInput,
): Promise<Appointment | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return null;
  const { data, error } = (await supabase
    .from("appointments")
    .insert({
      user_id: uid,
      title: input.title.trim(),
      description: input.description ?? null,
      start_at: input.start_at.toISOString(),
      end_at: input.end_at.toISOString(),
      location: input.location ?? null,
      color: input.color ?? "#D4B068",
      category: input.category,
      source: "manual",
      vendor_id: input.vendor_id ?? null,
      event_id: input.event_id ?? null,
    })
    .select("*")
    .single()) as { data: Appointment | null; error: { message: string } | null };
  if (error) {
    console.error("[calendar/createAppointment]", error.message);
    return null;
  }
  return data;
}

export async function updateAppointment(
  id: string,
  patch: Partial<AppointmentInput> & { is_completed?: boolean },
): Promise<Appointment | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title.trim();
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.start_at !== undefined) updates.start_at = patch.start_at.toISOString();
  if (patch.end_at !== undefined) updates.end_at = patch.end_at.toISOString();
  if (patch.location !== undefined) updates.location = patch.location;
  if (patch.color !== undefined) updates.color = patch.color;
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.vendor_id !== undefined) updates.vendor_id = patch.vendor_id;
  if (patch.event_id !== undefined) updates.event_id = patch.event_id;
  if (patch.is_completed !== undefined)
    updates.is_completed = patch.is_completed;

  const { data, error } = (await supabase
    .from("appointments")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single()) as { data: Appointment | null; error: { message: string } | null };
  if (error) {
    console.error("[calendar/updateAppointment]", error.message);
    return null;
  }
  return data;
}

export async function deleteAppointment(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) {
    console.error("[calendar/deleteAppointment]", error.message);
    return false;
  }
  return true;
}

/**
 * Accept an AI suggestion: flip to manual + ai_status=accepted so it
 * stops showing the ✨ marker and behaves like a normal appointment.
 */
export async function acceptSuggestion(id: string): Promise<Appointment | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = (await supabase
    .from("appointments")
    .update({ source: "manual", ai_status: "accepted" })
    .eq("id", id)
    .select("*")
    .single()) as { data: Appointment | null; error: { message: string } | null };
  if (error) {
    console.error("[calendar/acceptSuggestion]", error.message);
    return null;
  }
  return data;
}

/** Dismiss an AI suggestion permanently (kept in DB; filtered out of lists). */
export async function dismissSuggestion(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("appointments")
    .update({ ai_status: "dismissed" })
    .eq("id", id);
  if (error) {
    console.error("[calendar/dismissSuggestion]", error.message);
    return false;
  }
  return true;
}
