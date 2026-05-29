-- R134 — anonymous WhatsApp-click leads.
--
-- Host requested: every WhatsApp click on a vendor card in the public
-- catalog should appear in the vendor's leads dashboard, not just in
-- analytics. Anonymous visitors (the bulk of catalog browsers) have no
-- auth.users row, so the vendor_leads table needs to accept a NULL
-- couple_user_id.
--
-- Pre-R134: `couple_user_id uuid not null` blocked anonymous inserts at
-- the column level. R14's RLS policy also gates on
-- `auth.uid() = couple_user_id` — anonymous calls go through the
-- service-role client which bypasses RLS, so the column nullability is
-- the only change the migration needs.
--
-- Existing rows are unaffected; new anonymous leads will show
-- `couple_user_id = NULL` and `couple_name = NULL` (the leads page
-- handles that by labelling the row as "אורח אנונימי").

alter table vendor_leads
  alter column couple_user_id drop not null;

-- R134 — the original partial unique index prevented a couple from
-- creating two open leads against the same vendor. With NULL allowed,
-- the index still works (Postgres treats NULL as distinct in unique
-- constraints), so multiple anonymous clicks against the same vendor
-- all get separate rows — which is what we want for analytics. Each
-- anonymous click = one inbound interest signal.
--
-- (No DROP / CREATE needed — the existing partial index just keeps
-- doing the right thing.)
