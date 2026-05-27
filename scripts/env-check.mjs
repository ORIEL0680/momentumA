#!/usr/bin/env node
/**
 * R83 — Env-var audit. Verifies that every production-critical
 * environment variable is set, and surfaces optional-but-recommended
 * ones that are missing. Exits with code 1 if any REQUIRED var is
 * unset so we can wire this into CI later.
 *
 * Usage:
 *   node scripts/env-check.mjs                    # uses current shell env
 *   node -r dotenv/config scripts/env-check.mjs dotenv_config_path=.env.local
 *
 * The list is curated from a grep of every `process.env.*` reference
 * in the codebase. To re-derive: `grep -rh "process.env." app lib | grep -oE
 * "process.env.[A-Z_]+" | sort -u`.
 */

const REQUIRED_PROD = [
  // Public — exposed to the client at build time
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
  // Server-only — Supabase service-role for RLS bypass in admin paths
  "SUPABASE_SERVICE_ROLE_KEY",
  // Server-only — outbound messaging
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "ADMIN_EMAIL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_FROM",
  // Server-only — cron + integrity
  "CRON_SECRET",
  "IP_HASH_SALT",
];

const OPTIONAL = [
  "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "CALLMEBOT_PHONE",
  "CALLMEBOT_API_KEY",
  "NEXT_PUBLIC_TWILIO_TEMPLATE_INVITATION_SID",
  "NEXT_PUBLIC_TWILIO_TEMPLATE_REMINDER_SID",
];

function check() {
  const missingRequired = REQUIRED_PROD.filter((k) => !process.env[k]);
  const missingOptional = OPTIONAL.filter((k) => !process.env[k]);
  const presentRequired = REQUIRED_PROD.filter((k) => !!process.env[k]);

  const banner = "═".repeat(60);
  console.log(banner);
  console.log("  Momentum — Env Audit (R83)");
  console.log(banner);

  console.log(`\n✓ REQUIRED present (${presentRequired.length}/${REQUIRED_PROD.length}):`);
  for (const k of presentRequired) console.log(`  ✓ ${k}`);

  if (missingRequired.length > 0) {
    console.log(`\n✗ REQUIRED missing (${missingRequired.length}):`);
    for (const k of missingRequired) console.log(`  ✗ ${k}`);
  }

  if (missingOptional.length > 0) {
    console.log(`\n⚠️  OPTIONAL missing (${missingOptional.length}/${OPTIONAL.length}):`);
    for (const k of missingOptional) console.log(`  ⚠️  ${k}`);
  } else {
    console.log("\n✓ All OPTIONAL vars present too.");
  }

  console.log(`\n${banner}`);
  if (missingRequired.length > 0) {
    console.log(`Result: FAIL — ${missingRequired.length} required var(s) missing.`);
    process.exit(1);
  }
  console.log("Result: PASS — all required vars set.");
  process.exit(0);
}

check();
