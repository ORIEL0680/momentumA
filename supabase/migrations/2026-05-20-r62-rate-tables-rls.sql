-- ─────────────────────────────────────────────────────────────────────────────
-- R62 §Cat1 — RLS hardening: rate-limit counter tables.
--
-- Five "*_rate" tables (event_memories_rate, short_links_rate,
-- vendor_leads_rate, vendor_page_actions_rate, vendor_page_views_rate)
-- were created in earlier rounds without ROW LEVEL SECURITY because they
-- are written to exclusively by BEFORE-INSERT trigger functions. Without
-- RLS, however, an authenticated client can still SELECT / INSERT /
-- DELETE rows directly via the Supabase REST API — which would let a
-- user reset their own per-hour bucket and bypass the rate limit, or
-- read another tenant's bucket counts (low-value, but still a leak).
--
-- Fix: enable RLS on each *_rate table with no policies (= deny-all for
-- regular clients) AND mark the trigger functions SECURITY DEFINER so
-- they keep working under the locked-down RLS. The functions are owned
-- by the migration author (postgres) — the standard owner — so they
-- already have full table access.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1 — promote the trigger functions to SECURITY DEFINER so they can
-- keep writing to their target tables after RLS is locked down.
alter function check_short_link_rate()   security definer;
alter function check_event_memory_rate() security definer;
alter function check_page_view_rate()    security definer;
alter function check_page_action_rate()  security definer;
alter function check_vendor_lead_rate()  security definer;

-- Step 2 — lock down the *_rate tables. Empty policy set under RLS =
-- regular clients get back zero rows / cannot mutate. Triggers still
-- run because they execute with the function owner's privileges.
alter table public.event_memories_rate     enable row level security;
alter table public.short_links_rate        enable row level security;
alter table public.vendor_leads_rate       enable row level security;
alter table public.vendor_page_actions_rate enable row level security;
alter table public.vendor_page_views_rate  enable row level security;

-- Idempotency: re-running this migration is a no-op (security definer
-- promotion + RLS enable are both idempotent).
