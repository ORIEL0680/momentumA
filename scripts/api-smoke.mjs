#!/usr/bin/env node
/**
 * R83 — Public-route smoke test. Hits every page + every public API
 * endpoint and reports HTTP status + first 200 chars of body for
 * non-2xx responses.
 *
 * Auth-gated routes (e.g. /vendors/dashboard, /admin/*) are expected
 * to return 200 with a sign-in shell or redirect to /signup; either
 * is "healthy" — what we're catching is 500s + 404s + hung
 * connections.
 *
 * Usage:
 *   node scripts/api-smoke.mjs              # hits production
 *   BASE=http://localhost:3000 node scripts/api-smoke.mjs
 */

const BASE = process.env.BASE ?? "https://moomentum.events";

const ENDPOINTS = [
  // Public pages
  { path: "/", method: "GET", expect: [200] },
  { path: "/signup", method: "GET", expect: [200] },
  { path: "/vendors", method: "GET", expect: [200] },
  { path: "/vendors/join", method: "GET", expect: [200] },
  { path: "/terms", method: "GET", expect: [200] },
  { path: "/privacy", method: "GET", expect: [200] },
  { path: "/rsvp", method: "GET", expect: [200] },
  // Auth-gated pages: may render a sign-in shell (200) or redirect (3xx).
  { path: "/dashboard", method: "GET", expect: [200, 302, 307] },
  { path: "/vendors/dashboard", method: "GET", expect: [200, 302, 307] },
  { path: "/vendors/dashboard/leads", method: "GET", expect: [200, 302, 307] },
  { path: "/vendors/dashboard/inbox", method: "GET", expect: [200, 302, 307] },
  { path: "/chats", method: "GET", expect: [200, 302, 307] },
  { path: "/seating", method: "GET", expect: [200, 302, 307] },
  { path: "/budget", method: "GET", expect: [200, 302, 307] },
  { path: "/guests", method: "GET", expect: [200, 302, 307] },
  { path: "/balance", method: "GET", expect: [200, 302, 307] },
  { path: "/settings", method: "GET", expect: [200, 302, 307] },
  // Public APIs
  { path: "/api/health", method: "GET", expect: [200, 503] },
  { path: "/api/auth/diagnose", method: "GET", expect: [200, 503] },
  // 404 sanity
  { path: "/this-route-does-not-exist", method: "GET", expect: [404] },
];

async function probe(url, method, expect) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const elapsed = Date.now() - start;
    const text = res.status >= 400 ? await res.text().catch(() => "") : "";
    return {
      url,
      method,
      status: res.status,
      ok: expect.includes(res.status),
      elapsedMs: elapsed,
      preview: text.slice(0, 200),
    };
  } catch (e) {
    return {
      url,
      method,
      status: 0,
      ok: false,
      elapsedMs: Date.now() - start,
      preview: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

async function main() {
  const banner = "═".repeat(78);
  console.log(banner);
  console.log(`  Momentum — API Smoke Test (R83)`);
  console.log(`  base: ${BASE}`);
  console.log(banner);

  const results = await Promise.all(
    ENDPOINTS.map((e) => probe(`${BASE}${e.path}`, e.method, e.expect)),
  );

  let failures = 0;
  for (const r of results) {
    const icon = r.ok ? "✓" : "✗";
    const status = r.status === 0 ? "ERR" : String(r.status);
    const time = String(r.elapsedMs).padStart(5);
    const label = `${icon} ${status.padStart(3)} ${time}ms  ${r.method} ${r.url.replace(BASE, "")}`;
    console.log(label);
    if (!r.ok) {
      failures++;
      if (r.preview) console.log(`     ${r.preview.split("\n")[0].slice(0, 140)}`);
    }
  }

  console.log(`\n${banner}`);
  console.log(
    `Result: ${failures === 0 ? "PASS" : "FAIL"} — ${
      results.length - failures
    }/${results.length} endpoints healthy.`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("[api-smoke] unexpected error:", e);
  process.exit(2);
});
