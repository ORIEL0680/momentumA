-- ─── R123 — vendor_applications (status, email) composite index ──────
--
-- The R122 audit found that useVendorContext now runs an explicit
-- `ilike("email", user_email)` filter on `vendor_applications`, and
-- the new /api/vendors/self-provision-landing endpoint runs an
-- `ilike("email") + eq("status", "approved")` lookup on every first
-- dashboard load. Without an index, those queries fall back to a
-- sequential scan over the whole applications table — fine for the
-- 50-row dev set, slow as the table grows past a few hundred.
--
-- A composite (status, email) index covers both lookups:
--   • self-provision     → eq(status='approved') + ilike(email)
--   • admin sweep        → eq(status='approved')
--   • useVendorContext   → ilike(email)  ← uses the email column alone
--
-- Postgres can use a multi-column index for a leading-column-only
-- query (leftmost-prefix rule), so the single index serves both
-- exact-status queries and the rarer email-only filter. The
-- existing (status, created_at desc) index from the original
-- vendor-applications migration stays as-is — it serves the
-- admin "pending applications, newest first" list.
--
-- Idempotent: `if not exists` makes re-running this migration a no-op.
-- ─────────────────────────────────────────────────────────────────────

create index if not exists vendor_applications_status_email_idx
  on public.vendor_applications (status, lower(email));
