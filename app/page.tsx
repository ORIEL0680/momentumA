import { headers } from "next/headers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/landing/Hero";
import { PainSection } from "@/components/landing/PainSection";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { AppShowcase } from "@/components/landing/AppShowcase";
import { PricingSection } from "@/components/landing/PricingSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { HonestStats } from "@/components/landing/HonestStats";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";

/**
 * R62 (R52) — pre-paint redirect to /dashboard for signed-in users.
 *
 * Why an inline script and not a Server-Component `getUser()` redirect?
 *   This app's Supabase session lives in **localStorage**, not cookies
 *   (the browser client uses persistSession:true → localStorage). The
 *   server can't read it. The spec's `await supabase.auth.getUser()`
 *   on a Server Component would return null for every visitor (signed
 *   in or not), so the redirect would never fire.
 *
 *   An inline `<script>` in the SSR HTML runs synchronously before the
 *   body paints, reads localStorage, and `location.replace()` to the
 *   dashboard if a Supabase session token is found. Signed-out visitors
 *   continue parsing the landing in the same tick → no flash, no delay.
 *
 * CSP: middleware emits a per-request `x-nonce` header and a
 * `script-src 'nonce-…' 'strict-dynamic'` policy. The nonce attribute
 * below lets this inline script execute under that policy.
 */
const REDIRECT_SCRIPT = `
(function(){
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k)) {
        var v = localStorage.getItem(k);
        if (v && v.length > 10) { location.replace("/dashboard"); return; }
      }
    }
  } catch (e) {}
})();
`;

/**
 * R42 — premium landing page. Composition only; each section is its own
 * component under components/landing/. Order is conversion-tuned:
 * hook → pain → solution → proof → PRICE → trust → objections → close.
 */
export default async function LandingPage() {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <script
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: REDIRECT_SCRIPT }}
      />
      <Header />
      <main className="flex-1 relative">
        <Hero />
        <PainSection />
        <SolutionSection />
        <FeatureGrid />
        <AppShowcase />
        <PricingSection />
        <TrustSection />
        <HonestStats />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
