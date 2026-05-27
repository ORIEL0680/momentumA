import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * R123 — Shared vendor-landing creation logic.
 *
 * Three places need to create a `vendor_landings` row from a
 * `vendor_applications` row + a verified auth.users id:
 *
 *   • /api/vendors/admin/decide — when an admin approves a vendor
 *     who already has an auth.users row (most common path).
 *   • /api/admin/vendors/backfill-landing — sweep mode that repairs
 *     vendors stuck in "approved but invisible".
 *   • /api/vendors/self-provision-landing — called from the vendor's
 *     own dashboard when they sign up AFTER admin approval (the
 *     "no-auth-user at approval time" case the R122 fix logs and
 *     skips). This endpoint is what finally closes the loop.
 *
 * All three end up running the same SQL. Extracting it here means
 * one canonical source for slug generation, payload shape, and
 * error handling — so a future schema change touches one file.
 *
 * The caller is responsible for verifying that the auth user is
 * allowed to own this landing (e.g. their email matches the
 * application row). This helper trusts its inputs.
 */

export interface ApplicationSnapshot {
  id: string;
  email: string;
  business_name: string;
  category?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  about?: string | null;
  years_in_field?: number | null;
}

export type LandingOutcome =
  | { status: "created"; slug: string }
  | { status: "already-exists"; slug: string }
  | { status: "insert-failed"; error: string };

/**
 * Mint a URL-safe slug from a Hebrew/English business name. The
 * application-id suffix disambiguates two vendors named the same
 * thing ("Studio Aviv" + "Studio Aviv 2") without us having to do
 * a uniqueness probe round-trip.
 */
export function mintVendorSlug(
  businessName: string,
  applicationId: string,
): string {
  const base =
    businessName
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9֐-׿]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "vendor";
  return `${base}-${applicationId.slice(0, 8)}`;
}

/**
 * Create the vendor_landings row for the given application + auth
 * user. If one already exists for `ownerUserId`, returns
 * "already-exists" with the existing slug. The service-role client
 * is required (RLS would normally block the insert from an
 * arbitrary caller).
 *
 * R142 — also adopts ORPHAN landings: rows where `email` matches the
 * application email but `owner_user_id IS NULL`. This is the case when
 * an admin created a landing manually before the vendor signed up; the
 * landing carries the vendor's email but no auth-user link. Without
 * adoption, the next self-provision call tried to INSERT a brand-new
 * row, hit the slug-uniqueness or email constraint, and returned
 * `insert-failed` — leaving the vendor with the host nav forever.
 * Adoption only ever links a NULL owner; a landing already owned by a
 * different user is never touched, so this can't be used to hijack.
 */
export async function createVendorLandingForApplication(
  adminClient: SupabaseClient,
  application: ApplicationSnapshot,
  ownerUserId: string,
): Promise<LandingOutcome> {
  // 1. Already-owned check first — keeps the helper idempotent.
  const { data: existing } = await adminClient
    .from("vendor_landings")
    .select("slug")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (existing) {
    const { slug } = existing as { slug: string };
    return { status: "already-exists", slug };
  }

  // 2. R142 — orphan adoption: a landing exists for this email but
  // has no owner_user_id set. Common when an admin pre-created the
  // landing from the application before the vendor signed up to the
  // app. Link it to the verified caller (who has been authenticated
  // against the same email upstream — see /api/vendors/self-
  // provision-landing). Returns "already-exists" so the caller treats
  // it the same as the idempotent case above.
  const normalizedEmail = application.email.trim().toLowerCase();
  if (normalizedEmail) {
    const { data: orphan } = await adminClient
      .from("vendor_landings")
      .select("id, slug, owner_user_id")
      .ilike("email", normalizedEmail)
      .is("owner_user_id", null)
      .maybeSingle();
    if (orphan) {
      const { id: orphanId, slug: orphanSlug } = orphan as {
        id: string;
        slug: string;
        owner_user_id: string | null;
      };
      const { error: linkErr } = await adminClient
        .from("vendor_landings")
        .update({ owner_user_id: ownerUserId })
        .eq("id", orphanId);
      if (!linkErr) {
        return { status: "already-exists", slug: orphanSlug };
      }
      // Link failed (rare — RLS misconfig or column constraint).
      // Fall through to the insert path; the unique constraints will
      // catch any real duplicate.
      console.error(
        "[createVendorLandingForApplication] orphan link failed:",
        linkErr,
      );
    }
  }

  // 3. Otherwise insert a brand-new landing.
  const slug = mintVendorSlug(application.business_name, application.id);
  const { error } = await adminClient.from("vendor_landings").insert({
    slug,
    owner_user_id: ownerUserId,
    name: application.business_name,
    category: application.category ?? null,
    city: application.city ?? null,
    phone: application.phone ?? null,
    email: application.email,
    website: application.website ?? null,
    instagram: application.instagram ?? null,
    facebook: application.facebook ?? null,
    about_long: application.about ?? null,
    years_experience: application.years_in_field ?? null,
    landing_published: true,
  });
  if (error) {
    return { status: "insert-failed", error: error.message };
  }
  return { status: "created", slug };
}
