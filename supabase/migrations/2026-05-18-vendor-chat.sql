-- R43 — vendor ↔ couple chat (Hybrid 2+3).
-- Builds on vendor_leads / vendor_landings (verified present).
-- Idempotent — safe to re-run.

create table if not exists vendor_chat_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references vendor_leads(id) on delete cascade not null,
  sender_role text not null check (sender_role in ('couple', 'vendor')),
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  ai_summary text,
  ai_tags text[] default '{}',
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists vcm_lead_idx
  on vendor_chat_messages(lead_id, created_at desc);
create index if not exists vcm_unread_idx
  on vendor_chat_messages(lead_id, is_read) where is_read = false;

alter table vendor_chat_messages enable row level security;

-- Couple sees messages on their leads
drop policy if exists "couple reads own chat" on vendor_chat_messages;
create policy "couple reads own chat" on vendor_chat_messages
  for select using (
    exists (
      select 1 from vendor_leads l
      where l.id = vendor_chat_messages.lead_id
        and l.couple_user_id = auth.uid()
    )
  );

-- Vendor sees messages on leads where they own the vendor
drop policy if exists "vendor reads own chat" on vendor_chat_messages;
create policy "vendor reads own chat" on vendor_chat_messages
  for select using (
    exists (
      select 1 from vendor_leads l
      join vendor_landings vl on vl.slug = l.vendor_id
      where l.id = vendor_chat_messages.lead_id
        and vl.owner_user_id = auth.uid()
    )
  );

-- Insert: must be either couple or vendor on that lead
drop policy if exists "parties send messages" on vendor_chat_messages;
create policy "parties send messages" on vendor_chat_messages
  for insert with check (
    (sender_role = 'couple' and exists (
      select 1 from vendor_leads l
      where l.id = vendor_chat_messages.lead_id and l.couple_user_id = auth.uid()
    ))
    or
    (sender_role = 'vendor' and exists (
      select 1 from vendor_leads l
      join vendor_landings vl on vl.slug = l.vendor_id
      where l.id = vendor_chat_messages.lead_id and vl.owner_user_id = auth.uid()
    ))
  );

-- Update is_read flag — own side only
drop policy if exists "parties mark own read" on vendor_chat_messages;
create policy "parties mark own read" on vendor_chat_messages
  for update using (
    exists (
      select 1 from vendor_leads l
      where l.id = vendor_chat_messages.lead_id
        and (l.couple_user_id = auth.uid()
          or exists (select 1 from vendor_landings vl
                     where vl.slug = l.vendor_id and vl.owner_user_id = auth.uid()))
    )
  );

-- Rate limit: max 20 messages per lead per hour
create or replace function check_chat_rate()
returns trigger language plpgsql as $$
declare cnt int;
begin
  select count(*) into cnt from vendor_chat_messages
  where lead_id = new.lead_id and created_at > now() - interval '1 hour';
  if cnt > 20 then return null; end if;
  return new;
end $$;
drop trigger if exists chat_rate_check on vendor_chat_messages;
create trigger chat_rate_check before insert on vendor_chat_messages
  for each row execute function check_chat_rate();

-- Realtime
do $$
begin
  alter publication supabase_realtime add table vendor_chat_messages;
exception when duplicate_object then null;
end $$;
