"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVendorContext } from "./useVendorContext";

/**
 * R114 — guard host-only pages against vendor users.
 *
 * Vendors registered through /signup?role=vendor (or who applied
 * via /vendors/join later) shouldn't see /dashboard, /guests,
 * /budget, /seating, etc — those are wedding-host surfaces. If they
 * navigate (or get linked) there anyway, this hook ships them to
 * /vendors/dashboard before the page has a chance to render guest
 * tiles / budget tables / etc.
 *
 * Runs once on mount + whenever vendor status changes. Waits for the
 * vendor context check to finish (`isLoading`) so we don't bounce
 * an authenticated host who happens to load slowly.
 */
export function useVendorRedirect() {
  const router = useRouter();
  const { isVendor, isLoading } = useVendorContext();

  useEffect(() => {
    if (isLoading) return;
    if (isVendor) {
      router.replace("/vendors/dashboard");
    }
  }, [isVendor, isLoading, router]);
}
