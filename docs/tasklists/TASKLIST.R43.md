# TASKLIST · R43 — Vendor Chat (Inquiry → Quote → AI Inbox + Realtime)

**Date:** 2026-05-18 · `tsc` ✅ · `lint` ✅ (0 err; 6 pre-existing) · `build` ✅ (51 routes; 4 new) · `test` ✅ 9/9

> ✅ **Migration already run by the owner** at the R43 checkpoint
> (`supabase/migrations/2026-05-18-vendor-chat.sql` — `vendor_chat_messages`
> + RLS + 20/lead/hr trigger + realtime). Code shipped after.

## 🅐 Schema (done at checkpoint)

`vendor_chat_messages` (lead-scoped). RLS: each side reads/writes only
its own leads (couple by `couple_user_id`, vendor by `vendor_landings`
ownership); update limited to `is_read`. Verified `vendor_leads` /
`vendor_landings` columns before writing the SQL.

## 🅑 Backend

- **`/api/chat/send`** — Bearer-authed; validates (≤2000), inserts via
  the user's own client (RLS = the real authorization); app-layer
  rate-limit (20/lead/hr) on top of the DB trigger; **best-effort SMS**.
- **`lib/useVendorChat.ts`** — initial fetch + INSERT realtime sub,
  id-deduped, **strict channel cleanup**; `markChatRead` helper.

## 🅒 Couple UI

- **`components/chat/ChatWindow.tsx`** — shared bubble surface (couple
  right/gold, vendor left/gray), realtime, ✓/✓✓ receipts, auto-scroll,
  Enter-to-send, fires `/api/ai/chat-assist` fire-and-forget post-send.
- **`VendorChatLauncher`** — floating "צ׳אט עם הספק" on `/vendor/[slug]`,
  **self-hides** unless the signed-in couple has an active lead
  (status≠'lost'); opens a sheet/modal.

## 🅓 Vendor inbox

- **`/vendors/dashboard/inbox`** — split view (list ⇄ chat; stacks on
  mobile w/ back), per-lead last message / AI summary / unread badge /
  urgency dot (🟢 <24h · 🟡 24–48h · 🔴 48h+ unanswered), realtime
  refresh.
- **Smart replies** — `ChatWindow enableSmartReplies` shows 3 AI chips
  (click → fills editable input); cached in `sessionStorage` per
  last-message-id (never re-asks the same thread state).
- **`VendorInboxCard`** on `/vendors/dashboard` (unread count → inbox).

## 🅔 AI (fail-soft, rate-limited 50/user/day via lib/serverRateLimit)

- **`/api/ai/chat-assist`** — summary(≤15w)/tags/urgency → writes back;
  spam-tagged → auto `is_read`. No key/err → 200 skipped.
- **`/api/ai/smart-replies`** — 3 short Hebrew suggestions from last 5
  msgs. No key/err → `{replies:[]}`.

## 🅕 Notifications

- **F1 SMS:** vendor→couple works (vendor's RLS can read
  `lead.couple_phone`). **couple→vendor SMS deferred** — the vendor's
  phone lives in `vendor_landings`, which RLS does **not** expose to the
  couple; sending it would need a SECURITY DEFINER RPC (= another manual
  migration, which the owner gates). The realtime feed + header badge is
  the reliable notification for that direction. Documented; structured
  so an RPC can enable it later.
- **F2 header badge:** `ChatBell` (own `useChatUnread` hook) — counts
  unread not authored by the user (RLS-scoped), realtime, fail-soft →
  hidden when 0 / signed out. Pure indicator (couples have no central
  inbox route).

## 🅖 Verification

tsc/lint(0)/build/test(9/9) green; build lists `/api/chat/send`,
`/api/ai/chat-assist`, `/api/ai/smart-replies`, `/vendors/dashboard/inbox`.
Full realtime/SMS/AI flow needs a logged-in couple + vendor + an
existing lead + Supabase realtime — **manual device test** (cannot be
exercised headless).
