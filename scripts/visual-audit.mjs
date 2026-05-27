#!/usr/bin/env node
/**
 * R88 — automated visual sweep.
 *
 * Boots a headless Chromium, walks every route at four viewport
 * sizes, saves full-page PNGs under ./design-audit/<viewport>/<route>.png.
 * The output is a flat directory tree of ~180 screenshots that the
 * owner (or a reviewer) can browse quickly.
 *
 * Usage:
 *   npm run dev &              # start the local server on :3000
 *   sleep 5                    # let Next finish first-build warmup
 *   node scripts/visual-audit.mjs
 *
 * Auth-gated routes return a sign-in shell — that's fine; we're
 * auditing CHROME consistency (header / footer / spacing / radii /
 * typography), not behind-auth content. To capture an authed view,
 * pre-set the cookie:
 *   BASE=http://localhost:3000 SESSION_TOKEN='…' node scripts/visual-audit.mjs
 *
 * Dependency: puppeteer (not pinned in package.json — install with
 *   `npm i -D puppeteer` once before the first run).
 */

import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SESSION_TOKEN = process.env.SESSION_TOKEN ?? "";

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 740 },
  { name: "mobile-iphone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const PAGES = [
  // ─── PUBLIC ───
  "/", "/signup", "/terms", "/privacy",
  "/vendors", "/vendors/join",
  // ─── HOST AUTH-GATED ───
  "/dashboard", "/guests", "/budget", "/balance", "/seating",
  "/inbox", "/onboarding", "/start", "/settings", "/chats",
  // ─── EVENT DAY ───
  "/event-day",
  // ─── VENDOR ───
  "/vendors/my", "/vendors/dashboard",
  "/vendors/dashboard/leads", "/vendors/dashboard/inbox",
  "/vendors/dashboard/analytics",
  // ─── VENDOR STUDIO ───
  "/dashboard/vendor-studio",
  // ─── ADMIN ───
  "/admin", "/admin/dashboard",
  // ─── 404 sanity ───
  "/this-route-does-not-exist",
];

async function main() {
  const browser = await puppeteer.launch({ headless: "new" });
  const outRoot = path.resolve("./design-audit");
  await fs.mkdir(outRoot, { recursive: true });

  for (const vp of VIEWPORTS) {
    const dir = path.join(outRoot, vp.name);
    await fs.mkdir(dir, { recursive: true });
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
    if (SESSION_TOKEN) {
      await page.setCookie({
        name: "sb-token",
        value: SESSION_TOKEN,
        url: BASE,
      });
    }

    for (const route of PAGES) {
      const url = `${BASE}${route}`;
      try {
        await page.goto(url, { waitUntil: "networkidle0", timeout: 20_000 });
        // Give animations a beat to settle so screenshots aren't
        // mid-transition.
        await new Promise((r) => setTimeout(r, 1_200));
        const fname = (route.replace(/[/\[\]?:=&]/g, "_") || "_home") + ".png";
        await page.screenshot({
          path: path.join(dir, fname),
          fullPage: true,
        });
        process.stdout.write(`✓ ${vp.name}${route}\n`);
      } catch (e) {
        process.stdout.write(
          `✗ ${vp.name}${route}: ${e instanceof Error ? e.message : String(e)}\n`,
        );
      }
    }
    await page.close();
  }
  await browser.close();
  process.stdout.write(`\nDone. Screenshots under ./design-audit/\n`);
}

main().catch((e) => {
  console.error("[visual-audit] fatal:", e);
  process.exit(1);
});
