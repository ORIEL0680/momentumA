import { headers } from "next/headers";
import { StartClient } from "./StartClient";

export const metadata = {
  title: "חינמי לכולם — Momentum",
  description: "כל הפיצ׳רים פתוחים בחינם לחודשיים — בלי כרטיס אשראי.",
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
 *
 * R140 — the inline script can ONLY check localStorage at paint time.
 * For a returning user whose cloud `app_states` has data but
 * localStorage is empty (signed out / new device / cleared cookies),
 * the script falls through and the user lands on the tier picker.
 * The client-side StartClient then runs a cloud backstop (mirrors
 * the auth-callback + dashboard logic from R122) and redirects to
 * /dashboard the moment the cloud confirms an event exists. The
 * window between "page paints" and "redirect fires" is ~1s; the
 * StartClient renders a calm loading state during it instead of
 * the tier picker so the user never sees the wrong screen.
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
