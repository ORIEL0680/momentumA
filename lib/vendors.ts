import type { Vendor } from "./types";

/**
 * R37 — Removed ~332 seeded/demo vendors that weren't real businesses.
 * R87 (R69-3) — Also removed the last static seed entry. The catalog
 * now lives entirely in the `vendor_applications` table (via the
 * `list_approved_vendors` RPC) — every vendor goes through the
 * /vendors/join → admin approval flow.
 *
 * The empty array is intentional. Every consumer already uses
 * `.find()/.filter()/.length`, so a zero-element array is safe.
 * /vendors merges this with the approved-applications RPC result;
 * when the catalog is empty, the page renders its empty state.
 */
export const VENDORS: Vendor[] = [];
