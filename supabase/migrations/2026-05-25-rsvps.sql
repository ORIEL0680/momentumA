-- ─── R109 — RSVP realtime table ──────────────────────────────────────
-- Powers lib/rsvpSync.ts and app/rsvp/RsvpClient.tsx.
--
-- Before this migration, lib/rsvpSync.ts pushToSupabase() tried to
-- upsert into a `rsvps` table that didn't exist. The error was caught
-- and swallowed silently, so guest confirmations from the public /rsvp
-- page silently failed to propagate to the host dashboard — the only
-- working path was the wa.me hop, which R107 removed.
--
-- This creates the table + RLS that lets:
--   - Anonymous clients (the guest on /rsvp, no Supabase session) upsert
--     their own RSVP. Knowing the (event_id, guest_id) pair is the
--     access token — both are UUIDs delivered only via the signed
--     invitation link, so a stranger can't guess them.
--   - Anonymous clients (the host's dashboard subscriber, when not yet
--     authed in a route) read. The dashboard filters client-side by
--     the events it knows about locally, so the broad SELECT isn't a
--     privacy hole today — tighten later if we ever expose event
--     listings publicly.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  -- Both ids are application-level (UUIDs minted by the host's local
  -- store). Keep them as text so we don't tie the schema to a specific
  -- UUID encoding, and so a legacy non-UUID id doesn't break things.
  event_id text not null,
  guest_id text not null unique,
  status text not null check (status in ('confirmed', 'declined', 'maybe')),
  attending_count int not null default 1 check (attending_count >= 0 and attending_count <= 50),
  notes text,
  responded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rsvps_event_id_idx on public.rsvps(event_id);

-- ─── updated_at trigger ──────────────────────────────────────────────
create or replace function public.rsvps_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists rsvps_touch_updated_at_trg on public.rsvps;
create trigger rsvps_touch_updated_at_trg
  before update on public.rsvps
  for each row
  execute function public.rsvps_touch_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.rsvps enable row level security;

-- Anon can INSERT — the (event_id, guest_id) pair acts as a bearer
-- token. UNIQUE on guest_id means a second insert with the same
-- guest_id will conflict and route through the UPDATE path below
-- (Supabase's upsert uses INSERT ... ON CONFLICT under the hood).
drop policy if exists rsvps_anon_insert on public.rsvps;
create policy rsvps_anon_insert
  on public.rsvps
  for insert
  to anon
  with check (true);

-- Anon can UPDATE their own row (matched by guest_id). Needed so a
-- guest changing their mind ("oops, we're 3 not 2") can resubmit.
drop policy if exists rsvps_anon_update on public.rsvps;
create policy rsvps_anon_update
  on public.rsvps
  for update
  to anon
  using (true)
  with check (true);

-- Anon can SELECT — the host's dashboard subscriber may run before
-- the user is authed (it's wired in a route that doesn't gate on
-- session). The client filters by guest_id locally.
drop policy if exists rsvps_anon_select on public.rsvps;
create policy rsvps_anon_select
  on public.rsvps
  for select
  to anon
  using (true);

-- Same policies for authenticated (Supabase strips the anon role when
-- the request carries an access token).
drop policy if exists rsvps_auth_all on public.rsvps;
create policy rsvps_auth_all
  on public.rsvps
  for all
  to authenticated
  using (true)
  with check (true);

-- ─── Realtime ────────────────────────────────────────────────────────
-- Without this, supabase.channel("rsvps").on("postgres_changes", ...)
-- silently returns 0 events. The host dashboard subscribes via
-- lib/rsvpSync.ts wireSupabaseRealtime().
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rsvps'
  ) then
    alter publication supabase_realtime add table public.rsvps;
  end if;
end $$;
