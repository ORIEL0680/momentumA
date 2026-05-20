#!/usr/bin/env node
/**
 * R70 (R59) — Phase 2 visual regression sweep.
 *
 * Walks a list of public/authenticated routes across 4 viewports,
 * captures a full-page screenshot of each, and records every console
 * error / page error / failed nav into ERRORS.json.
 *
 * Anonymous run: any route requiring auth simply renders its
 * unauthenticated state (redirect or "please login"). That's intentional
 * — it's still useful for catching obvious console errors that fire
 * before auth gating.
 *
 * Usage:
 *   npm run dev &
 *   sleep 6
 *   node scripts/visual-sweep.mjs
 */

import puppeteer from "puppeteer";
import fs from "node:fs/promises";

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 740 },
  { name: "mobile-iphone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const ROUTES = [
  // Public
  "/",
  "/signup",
  "/start",
  "/pricing",
  "/terms",
  "/privacy",
  "/rsvp",
  // Authenticated couple (will redirect when anon — still capture)
  "/dashboard",
  "/guests",
  "/budget",
  "/balance",
  "/seating",
  "/calendar",
  "/calendar/print",
  "/alcohol",
  "/timeline",
  "/checklist",
  "/compare",
  "/inbox",
  "/settings",
  "/onboarding",
  // Event-day
  "/event-day",
  // Vendors
  "/vendors",
  "/vendors/join",
  "/vendors/my",
  "/vendors/dashboard",
  "/vendors/dashboard/inbox",
  "/vendors/dashboard/leads",
  "/dashboard/vendor-studio",
  // Admin
  "/admin",
  "/admin/dashboard",
  "/admin/users",
  "/admin/vendors/applications",
  "/admin/errors",
];

const BASE_URL = process.env.SWEEP_BASE_URL || "http://localhost:3000";
const OUT_DIR = "./screenshots";

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const errors = {};

for (const vp of VIEWPORTS) {
  await fs.mkdir(`${OUT_DIR}/${vp.name}`, { recursive: true });
  console.log(`\n[${vp.name}] ${vp.width}×${vp.height}`);
  const page = await browser.newPage();
  await page.setViewport({ width: vp.width, height: vp.height });

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route}`;
    const pageErrors = [];
    const onPageError = (e) => pageErrors.push(`pageerror: ${e.message}`);
    const onConsole = (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Filter out CSP report-only chatter and dev-only HMR noise.
        if (
          text.includes("Content Security Policy") ||
          text.includes("Failed to load resource") ||
          text.includes("404") ||
          text.includes("[next-route-announcer]") ||
          text.startsWith("Warning:")
        ) {
          return;
        }
        pageErrors.push(`console: ${text}`);
      }
    };

    page.on("pageerror", onPageError);
    page.on("console", onConsole);

    try {
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      // Let any client-side effects/animations settle.
      await new Promise((r) => setTimeout(r, 800));

      const filename =
        (route === "/" ? "_home" : route.replace(/\//g, "_").replace(/^_/, "")) +
        ".png";
      await page.screenshot({
        path: `${OUT_DIR}/${vp.name}/${filename}`,
        fullPage: true,
      });
      const status = pageErrors.length > 0 ? `⚠ ${pageErrors.length}` : "✓";
      console.log(`  ${status} ${route}`);
    } catch (e) {
      pageErrors.push(`FAILED TO LOAD: ${e.message}`);
      console.log(`  ✗ ${route} — ${e.message.slice(0, 80)}`);
    } finally {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
    }

    if (pageErrors.length > 0) {
      errors[`${vp.name}${route}`] = pageErrors;
    }
  }

  await page.close();
}

await browser.close();
await fs.writeFile(
  `${OUT_DIR}/ERRORS.json`,
  JSON.stringify(errors, null, 2),
);

const totalRoutes = VIEWPORTS.length * ROUTES.length;
const issueCount = Object.keys(errors).length;
console.log(
  `\nSweep complete. ${totalRoutes} captures total. ${issueCount} with issues. ` +
    `See ${OUT_DIR}/ERRORS.json`,
);
