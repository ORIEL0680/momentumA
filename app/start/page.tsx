import { headers } from "next/headers";
import { StartClient } from "./StartClient";

export const metadata = {
  title: "בחר מסלול — Momentum",
  description: "לפני שיוצאים לדרך, בחר את המסלול שמתאים לך.",
};

/**
 * R62 (R52) — pre-paint routing gate.
 *
 *  - Anonymous visitor          → /signup?returnTo=/start
 *  - Signed-in WITH an event    → /dashboard (already past the gate)
 *  - Signed-in WITHOUT an event → stay; the StartClient picks the tier
 *
 * Why an inline script and not a Server-Component getUser()/db lookup:
 * sessions live in localStorage (not cookies) and the "has event" flag
 * lives in the same client-side JSON blob (`momentum.app.v1`), so the
 * server can't see either. The script runs synchronously before paint,
 * so the user never sees a tier-picker they shouldn't.
 */
const ROUTING_SCRIPT = `
(function(){
  try {
    var hasSession = false;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) {
        var v = localStorage.getItem(k);
        if (v && v.length > 10) { hasSession = true; break; }
      }
    }
    if (!hasSession) { location.replace("/signup?returnTo=/start"); return; }
    var raw = localStorage.getItem("momentum.app.v1");
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.event && parsed.event.id) {
        location.replace("/dashboard"); return;
      }
    }
  } catch (e) {}
})();
`;

export default async function StartPage() {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <script
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: ROUTING_SCRIPT }}
      />
      <StartClient />
    </>
  );
}
