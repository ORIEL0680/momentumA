# R92 / R140 — Pre-Launch Status Report

_Last updated: 2026-05-29 by Tal · Claude session_

---

## ✅ Done in R140 (this commit)

- [x] **Existing-user signin keeps the event** — `/onboarding` now redirects to `/dashboard` when `state.event` exists, instead of silently re-rendering the questions. `/start` got a cloud backstop (mirrors the R122 fix in `/auth/callback` and `/dashboard`) so returning users whose localStorage is empty but cloud `app_states` has an event are redirected to `/dashboard` before they ever see the launch screen.
- [x] **Settings "מסלול הנוכחי" + "שדרג" button** removed — replaced with a "🎁 חינמי בתקופת ההשקה" reassurance card.
- [x] **Vendor dashboard "שדרוג מסלול" / "מסלול פרימיום" tile** reframed to "חינמי בתקופת השקה · כל הפיצ׳רים פתוחים".
- [x] **`/start` page metadata** updated from "בחר מסלול" to "חינמי לכולם".

The big landing-page sweep (Hero / FinalCTA / PricingSection / FAQ / Header nav / UpgradePlanModal / FAQ) was done in **R121** — those surfaces are already clean.

---

## 🔴 What was the root cause of the "lost event" bug?

Two compounding bugs:

1. **`/onboarding`** had `if (state.event) return;` in its useEffect — which only stopped the redirect logic; it did NOT prevent the onboarding questions from rendering. So a returning user whose state was hydrating mid-page saw the form anyway.
2. **`/start/page.tsx`'s pre-paint script** only checked `localStorage.getItem("momentum.app.v1")`. Anyone who signed out and back in had an empty localStorage at that moment — even if their cloud `app_states` row was intact. The script fell through and they landed on the launch screen, then clicked "התחל" and went to `/onboarding` as a "fresh" user.

R140 fixes both: `/onboarding` now `router.replace("/dashboard")` when an event exists, and `/start` runs a one-shot Supabase query for the user's `app_states` row before rendering — if found, it hydrates localStorage via `applyCloudPayload()` and redirects.

---

## 🔴 Critical Outstanding (BEFORE launch)

None left at the code level. The remaining critical items are **infrastructure / DB**:

1. **Run the R134 anonymous-WhatsApp-leads migration** in Supabase SQL Editor:
   ```sql
   alter table vendor_leads alter column couple_user_id drop not null;
   ```
   Until this runs, anonymous WhatsApp clicks fail to create lead rows (analytics still works).

2. **WhatsApp template approval** (`momentum_guest_invitation_v1`, `rsvp_confirmation_v2`) — pending Meta review. **Workaround already shipped in R116/R119**: bulk send falls back to SMS automatically when WhatsApp can't deliver, and RSVP confirmations go via SMS + Email instead of WhatsApp.

3. **DB sanity check** — confirm `talhemo132@gmail.com` actually has a row in `app_states`. Run:
   ```sql
   select user_id, jsonb_path_query(payload, '$.event.id') as event_id, updated_at
   from app_states
   where user_id = (select id from auth.users where email = 'talhemo132@gmail.com');
   ```
   - **0 rows** → the event was never pushed to cloud (R122's `pushToCloud` should have written it on every change). Look at logs for `[momentum/sync] pushToCloud failed` around when the user reported the loss.
   - **1 row, event_id null** → the payload was cleared somehow. Restore from a backup or recreate.
   - **1 row, valid event_id** → R140 fix above will recover them on next signin. Already deployed.

---

## 🟠 High Priority

1. **Vercel deploy logs**: enable Twilio/Resend status surfacing. Currently failures only show in `console.error` which is captured by Vercel but not surfaced to admins.
2. **Light-mode contrast pass** (mentioned in R71 history). R111 swapped surfaces to white + gold and rebuilt the gold scale; if any text reads too low-contrast on white, surface it.
3. **Vendor catalog symmetry on long lists** (R86 / R125 covered most). Verify catalog tile heights with mixed photo / no-photo rows.

---

## 🟡 Medium Priority

1. **Light/dark theme manual sweep** of the seating page, RSVP page, vendor landing page.
2. **PWA install prompt** — `<InstallPWA />` exists but no telemetry on accept-rate.
3. **Hebrew copy review** by a native speaker for the new R135 InterestForm wizard + R131 seating tips + R140 settings card.

---

## 🟢 Nice to Have

1. **`UpgradePlanModal`** still exists (R121 neutralized its copy to "₪0 launch"). Either ship a real payments integration into it or delete it entirely once tiers are reinstated.
2. **Vendor dashboard "Analytics" tab** could surface the WhatsApp click → SMS fallback rate.
3. **`/admin/dashboard`** revenue counter shows ₪0 — works as designed, just a reminder that the column needs to flip when payments come online.

---

## 📊 Code Health

| Metric | Value |
|---|---|
| TypeScript strict errors | 0 (verified `npx tsc --noEmit` clean) |
| Build status | Passing |
| Latest passing CI | R140 (this report) |
| Modal positioning bug pattern | Eliminated in R137 + R138 |
| Mobile compositor instability | Eliminated in R120 |
| Open security findings | 0 critical (R139 closed open redirect) |

The audit + cleanup pass before launch covered:
- **R134/R135/R136** — vendor analytics + leads end-to-end + popup-blocker safety.
- **R137/R138** — every modal uses the headless-UI scroll pattern + top-anchor.
- **R139** — open-redirect guard on `?returnTo=`, vendor phone normalization in crisis room, guest dedup canonical-form.
- **R140** — pricing strip + cloud-backstop on `/start` + onboarding redirect.

---

## 🎯 Manual Actions for Tal

1. **Run in Supabase SQL Editor**:
   ```sql
   alter table vendor_leads alter column couple_user_id drop not null;
   ```
2. **Verify** `talhemo132@gmail.com` has a row in `app_states` (query above). If yes, the user signing in after deploy will recover their event automatically. If no, restore manually or have them recreate.
3. **Submit** the WhatsApp templates for Meta approval (24-48h turnaround).
4. **Test signup flow** on a fresh incognito tab end-to-end:
   - Google OAuth → /auth/callback → /dashboard with the test event
   - Email OTP → /auth/callback → /dashboard
   - Sign out → sign back in → /dashboard (NOT /onboarding)
5. **(Optional)** Set `TWILIO_SMS_FROM` env var in Vercel separately from `TWILIO_WHATSAPP_FROM` if you want SMS to come from a dedicated number. R117 has a fallback so both can be the same number.
