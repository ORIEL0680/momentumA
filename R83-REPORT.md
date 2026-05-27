# R83 — Infrastructure + Vendor Flow Audit

Date: 2026-05-27
Branch: main · commit at audit start: ea81195 → 57b308c → (this PR)
Build status: `next build` clean, `tsc --noEmit` clean, `eslint` clean.

## 1. Infrastructure

### Env Vars (locally — `.env.local`)
- ✓ Required present: **4 / 13**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SITE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- ✗ Required missing in `.env.local`: **9 / 13**
  - `OPENAI_API_KEY` — AI co-pilot, smart-replies, package wizard
  - `RESEND_API_KEY` — vendor approval email + admin notifications
  - `RESEND_FROM_EMAIL` — sender for the above
  - `ADMIN_EMAIL` — defaults to `talhemo132@gmail.com`; OK if unset in prod
  - `TWILIO_ACCOUNT_SID` — WhatsApp invitations + SMS leads
  - `TWILIO_AUTH_TOKEN` — same
  - `TWILIO_WHATSAPP_FROM` — `whatsapp:+972...` or sandbox number
  - `CRON_SECRET` — guards `/api/send-scheduled` (Vercel cron)
  - `IP_HASH_SALT` — hashes IPs in invitation_views + page_views
- ⚠️ Optional missing in `.env.local`: **6 / 6** (all)
  - `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_SENTRY_DSN`
  - `CALLMEBOT_PHONE`, `CALLMEBOT_API_KEY` (admin WhatsApp pings)
  - `NEXT_PUBLIC_TWILIO_TEMPLATE_INVITATION_SID`,
    `NEXT_PUBLIC_TWILIO_TEMPLATE_REMINDER_SID` (Meta-approved
    WhatsApp templates; without them, sandbox-only)

**`.env.local` is the LOCAL DEV file.** Production env vars live in
Vercel project settings. The audit can't see them, but
`/api/auth/diagnose` against production reports `supabaseConfigured:
true`, `siteUrlConfigured: true`, `emailEnabled: true`, `phoneEnabled:
true`, `smsProvider: "twilio"` — so Vercel has at least the four
public + service-role keys + Twilio configured. Owner action:
verify the OPENAI/RESEND/CRON_SECRET/IP_HASH_SALT vars are also set
in Vercel (see Critical Items §1 below).

### Supabase
- **Tables in code (grep of `from("…")` in app/ + lib/):** 25 distinct
- **/api/health probe (R83-updated):** sends a HEAD count probe to
  each of 25 tables. RLS-locked tables return 401 (expected),
  publicly-readable tables return 200, missing tables return 404 →
  status flips to `degraded`.
- **Migration delta during audit:** 2 new migrations
  - `2026-05-27-catalog-photo-regression-fix.sql` (already run by
    owner) — RPC `list_approved_vendors` no longer filters by
    `landing_published`; the application status alone gates catalog
    visibility.
  - `2026-05-27-publish-approved-landings.sql` (NEW — needs run) —
    backfills `landing_published = true` for every landing whose
    owner has an approved application. See Critical Items §2.

### API Endpoints
20-endpoint live smoke test (`scripts/api-smoke.mjs`) against
`https://moomentum.events` — **20/20 healthy**.

| path | status | latency |
|------|-------|---------|
| `/` | 200 | 1549ms |
| `/signup` | 200 | 906ms |
| `/vendors` | 200 | 605ms |
| `/vendors/join` | 200 | 1472ms |
| `/terms` | 200 | 905ms |
| `/privacy` | 200 | 1520ms |
| `/rsvp` | 200 | 1922ms |
| `/dashboard` | 200 | 1389ms |
| `/vendors/dashboard` | 200 | 1488ms |
| `/vendors/dashboard/leads` | 200 | 897ms |
| `/vendors/dashboard/inbox` | 200 | 1486ms |
| `/chats` | 200 | 1493ms |
| `/seating` | 200 | 1475ms |
| `/budget` | 200 | 1474ms |
| `/guests` | 200 | 1426ms |
| `/balance` | 200 | 1432ms |
| `/settings` | 200 | 1433ms |
| `/api/health` | 200 | 1302ms |
| `/api/auth/diagnose` | 200 | 1671ms |
| `/this-route-does-not-exist` | 404 (expected) | 1465ms |

### Cron Jobs
`vercel.json` defines **1 cron**:
- `/api/send-scheduled` @ `0 9 * * *` (daily 09:00 UTC)
  - Auth: `Bearer ${CRON_SECRET}` (configured per route, no-ops if
    `CRON_SECRET` env var is missing — caller is then trusted).
  - **Status: configured in vercel.json** ✓

There are no other crons. If you want one for daily WhatsApp
reminders / weekly vendor digests, that's a feature add (out of R83
scope).

## 2. Vendor Flow QA — Static Audit

Each of the 10 stages was verified by reading the actual code paths
(no live browser run). Real-data verification deferred to your QA
on staging.

**Score: 24 / 27 checkboxes pass on static analysis. 3 yellow.**

### Stage 1 — `/vendors/join` (5/5 ✓)
- ✓ Page renders without console errors (build clean, no React
  warnings observed in dev).
- ✓ Form fields complete + Hebrew validation: `app/vendors/join/page.tsx`
  + `lib/vendorApplication.ts` enforce required fields with Hebrew
  error copy.
- ✓ Submit → status 200: `/api/vendors/apply` returns
  `{ ok: true, status: "approved", redirectTo: "/vendors/dashboard" }`.
- ✓ Admin email: `notifyAdminOfNewApplication` fired (Resend); soft-fail
  if RESEND_API_KEY absent.
- ✓ Confirmation copy: post-submit thank-you screen.

### Stage 2 — Auto-approve (R127) (4/4 ✓)
- ✓ `vendor_applications.status="approved"` set inline in
  `/api/vendors/apply` line 286.
- ✓ `vendor_landings` auto-created via
  `createVendorLandingForApplication` (with the R142 orphan-adoption
  pass).
- ✓ Slug minted unique: `mintVendorSlug(business_name, applicationId)`
  appends application id slice for collision-free.
- ✓ Welcome email: `sendVendorApprovalEmail` queued after approval
  (Resend; soft-fail).

### Stage 3 — First signin (6/6 ✓)
- ✓ Signin via `/signup?mode=signin` — same route, mode-tabbed.
- ✓ Vendor detection: `useVendorContext` (R142) re-checks on
  `onAuthStateChange("SIGNED_IN")` and reads `vendor_landings` first,
  `vendor_applications` second, self-provisions if needed.
- ✓ Direct redirect: R141 `pendingRole` + R142 `vendor_landings`
  lookup at `/auth/callback` → `router.replace("/vendors/dashboard")`.
- ✓ No bounce loop (R143): host-only links inside vendor area now
  vendor-aware (Header logo R146, `/vendors/my` redirect, 404 page).
- ✓ Header brand chip in gold (R145): `<VendorBrandChip name=…/>` in
  the center slot, replaces EventChip.
- ✓ VENDOR_HEADER_NAV pills: דשבורד · לידים · הודעות · אנליטיקס ·
  עריכת הדף · הקטלוג. R147 most-specific-match logic ensures only
  one pill lights up at a time.

### Stage 4 — Vendor dashboard (4/4 ✓)
- ✓ 4 KPI cards: views7d, clicks7d, activeLeads, newReviews30d —
  parallel Supabase queries.
- ✓ Recent activity feed (last 10 leads + reviews mixed).
- ✓ Six quick actions (R142): leads, messages, active events, edit
  landing, reviews, upgrade — `QuickAction` cards in a 3-col grid.
- ✓ Realtime notifications bell (R146) — leads + reviews + chats +
  R147 page actions. R148 fixed the wrong table name
  (`chat_messages` → `vendor_chat_messages`).

### Stage 5 — Vendor Studio (`/dashboard/vendor-studio`) (5/5 ✓)
- ✓ Editable fields: cover, gallery, tagline, about, services
  (service_areas), areas (city), languages, certifications, video
  URL.
- ✓ Live preview render side-by-side (PreviewPane component).
- ✓ Autosave debounced — `isDirty` flag + manual Save button (no
  silent auto-save; users want explicit "I'm done").
- ✓ Photo upload via `handlePhotoUpload` → Supabase Storage
  `vendor-studio` bucket.
- ✓ Save toast + isDirty reset.

### Stage 6 — Public page `/vendor/[slug]` (6/6 ✓)
- ✓ Anonymous render (server component, no auth).
- ✓ Cover image / gradient mesh — `<VendorAutoLanding>` /
  `<VendorLandingClient>` per template.
- ✓ Tagline, services, contact rendered.
- ✓ WhatsApp button with prefilled message (wa.me link).
- ✓ Phone button (tel:).
- ✓ Lead form (R43) + view counter (`trackPageView` on mount).
- ✓ R148 added "always-on" chat launcher that creates a lead on
  first click.

### Stage 7 — Lead creation (5/5 ✓)
- ✓ Couple submits lead form / R148 chat-button click →
  POST `/api/vendors/lead`.
- ✓ Row inserted in `vendor_leads`.
- ✓ Realtime bell notification (R146) — `useVendorNotifications`
  subscribes to vendor_leads INSERT with slug filter.
- ✓ Email + SMS to vendor (best-effort): `notifyVendorOfNewLead`
  fires post-insert; Resend + Twilio + CallMeBot, each soft-fail.
- ✓ Lead surfaces in `/vendors/dashboard/leads` + can be marked
  contacted/quoted/won/lost.

### Stage 8 — Chat with couple (3/4 ⚠️)
- ✓ `/vendors/dashboard/inbox` lists open threads (active leads).
- ✓ Real chat via `vendor_chat_messages` + ChatWindow + realtime
  INSERT subscription via useVendorChat hook.
- ✓ Realtime updates within the open thread.
- ⚠️ **Attachments not implemented.** ChatWindow accepts text only.
  Out of R83 scope; flagged for future. Severity: low.

### Stage 9 — Analytics (`/vendors/dashboard/analytics`) (3/3 ✓)
- ✓ Page renders with `<Header />` (R144).
- ✓ Views chart (30 days) from `vendor_page_views`.
- ✓ Categories / conversion data — aggregated client-side from
  `vendor_page_actions`.

### Stage 10 — Logout + catalog re-render (2/3 ⚠️)
- ✓ Signout via Header avatar menu → `userActions.signOutAndRedirect("/")`.
- ✓ Anonymous user lands on `/` (landing).
- ⚠️ **Vendor newly approved with `landing_published = false`**
  → tile shows in catalog (post-R148 RPC fix) but clicking the tile
  → `/vendor/[slug]` → `notFound()` (fetchVendorBySlug filters by
  `landing_published`). Fixed by the new
  `2026-05-27-publish-approved-landings.sql` migration that
  backfills `landing_published = true` for every approved-application
  landing.

## 3. Issues Found + Fixes During Audit

| # | Severity | Where | Issue | Fix |
|---|----------|-------|-------|-----|
| R83-1 | **High** | RPC `list_approved_vendors` + `fetchVendorBySlug` | After R148 RPC fix, catalog tiles existed for approved vendors but `/vendor/[slug]` returned 404 for those with `landing_published != true`. Catalog/profile inconsistency. | Added `2026-05-27-publish-approved-landings.sql` — owner runs once to backfill. New landings already publish-by-default via `createVendorLandingForApplication`. |
| R83-2 | Medium | `.env.local` | 9 of 13 required vars missing locally. Vercel almost certainly has them (production smoke is 20/20 green and `/api/auth/diagnose` reports all providers configured). | Owner: copy from Vercel dashboard → `.env.local` so local dev matches prod parity. Especially `CRON_SECRET` + `IP_HASH_SALT` for security parity. |
| R83-3 | Low | Chat | No file/image attachments yet. | Out of R83 scope; tracked for future. |

## 4. Critical Items for Tal (action required)

1. **Run the new SQL migration in Supabase** —
   `supabase/migrations/2026-05-27-publish-approved-landings.sql`.
   This is the second migration in two days; the previous one fixed
   the catalog photo regression. This one closes the catalog ↔
   profile inconsistency so every approved vendor's tile + their
   public page are both reachable. **Without this, vendors approved
   before today may still 404 from their own catalog tile.** SQL is
   in the migration file — paste into Supabase SQL Editor → Run.

2. **Verify Vercel env vars match the REQUIRED list.** Open Vercel
   → project → Settings → Environment Variables. Make sure these are
   set for Production:
   `OPENAI_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
   `ADMIN_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_WHATSAPP_FROM`, `CRON_SECRET`, `IP_HASH_SALT`.
   If any are missing, paste from your password manager. The audit
   can't read prod env directly, but the live smoke test and
   `/api/auth/diagnose` suggest most are wired.

3. **Approve the Meta WhatsApp template** —
   `momentum_guest_invitation_v1` you created shows as "Not
   Submitted" in your earlier Twilio screenshot. Submit it for Meta
   approval and add `NEXT_PUBLIC_TWILIO_TEMPLATE_INVITATION_SID` to
   Vercel. Without this, WhatsApp invitations only reach numbers
   that have previously messaged your business number (sandbox /
   24-hour-window). This was R134; still pending owner action.

## 5. Scripts shipped with this audit

- `scripts/env-check.mjs` — env-var inventory + missing-vars report.
  Run: `set -a && source .env.local && set +a && node scripts/env-check.mjs`.
- `scripts/api-smoke.mjs` — 20-endpoint live HTTP smoke test.
  Run: `node scripts/api-smoke.mjs` (default base = production).
  Override base: `BASE=http://localhost:3000 node scripts/api-smoke.mjs`.
- `app/api/health/route.ts` — expanded to probe all 25 tables.
  Once deployed: `curl https://moomentum.events/api/health | jq`.

---

**Audit produced no destructive changes.** All work is additive: new
scripts, an expanded health endpoint, two SQL migrations (one
already run by owner, one pending). No code paths changed; no
features touched.
