-- ─── R114 — let vendor applicants read their OWN application ────────
-- Powers lib/useVendorContext applicationStatus + the pending-state
-- screen on /vendors/dashboard.
--
-- Before this: vendor_applications had ONLY admin SELECT (see
-- 2026-05-10-vendor-applications.sql). A vendor who submitted via
-- /vendors/join couldn't read back the row to learn the status of
-- their own application. They'd log into /vendors/dashboard and see
-- "you have no vendor profile" — same as a user who never applied.
-- "דפוס אומן" hit this exact failure mode.
--
-- After: a user can SELECT vendor_applications rows where the email
-- on the row matches their auth.jwt() email. That's the only piece
-- of identity the application form captured — there's no user_id
-- column today, and adding one retroactively would break older rows.
-- Matching by email is sufficient: a user can't read someone else's
-- application because they can't sign in as a different email.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists "applicant reads own application" on vendor_applications;
create policy "applicant reads own application" on vendor_applications
  for select
  using (
    -- Auth users see rows where email matches their JWT email.
    -- LOWER both sides because the form accepts mixed-case input.
    auth.jwt() ->> 'email' is not null
    and lower(email) = lower(auth.jwt() ->> 'email')
  );
