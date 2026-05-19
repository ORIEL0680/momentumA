/**
 * R59 (R49) — shared client-side shape of GET /api/admin/stats.
 * Mirrors the JSON the route emits (including the additive R59 fields).
 */
import type { Sparkline, Delta, AdminEventSummary } from "./queries";

export interface AdminStats {
  users: {
    total: number;
    new_today: number;
    new_this_week: number;
    new_this_month: number;
    active_last_24h: number;
  };
  events: { total: number; active: number; new_this_week: number };
  vendors: {
    total_applications: number;
    pending: number;
    approved: number;
    rejected: number;
    paid_tier: number;
    landings_published: number;
  };
  reviews: { total: number; avg_rating: number; new_this_week: number };
  managers: {
    total_invited: number;
    total_accepted: number;
    arrivals_logged: number;
  };
  receipts: { total: number; total_amount_agorot: number };
  assistant: {
    total_messages: number;
    messages_today: number;
    total_cost_cents: number;
  };
  recent_activity: Array<{
    id: string;
    type: string;
    label: string;
    timestamp: string;
  }>;
  series: { users_7d: Sparkline; events_7d: Sparkline };
  deltas: { users_7d: Delta; events_7d: Delta };
  upcoming_events: AdminEventSummary[];
  errors_last_24h: number;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  event_title: string | null;
}

export interface AdminErrorRow {
  id: string;
  type: string;
  message: string;
  stack: string | null;
  user_id: string | null;
  url: string | null;
  user_agent: string | null;
  created_at: string;
  frequency: number;
}
