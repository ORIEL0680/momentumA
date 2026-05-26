"use client";

/**
 * R129 — Inline vendor control panel for the admin dashboard.
 *
 * Owner reported: "בדשבורד האדמין שלי עדיין אני לא רואה שליטה ובקרה
 * על הספקים שלי" — vendor management was reachable only via the
 * CommandTile jump to /admin/vendors. They want it visible AND
 * controllable directly from /admin/dashboard.
 *
 * This panel surfaces approved vendors as compact rows with the same
 * one-click actions /admin/vendors has (Pin to top + Delete with
 * undo). The intent is "at-a-glance management" — see the list,
 * promote or remove without leaving the page.
 *
 * Behavior:
 *   • Fetches the live approved-vendors list (vendor_applications
 *     where status='approved' AND deleted_at IS NULL).
 *   • Sorted same way as the public catalog: featured_at desc nulls
 *     last, then created_at desc.
 *   • Shows the 8 most-recent / most-relevant rows; "צפה בכולם"
 *     link bottom-right opens /admin/vendors for the full surface.
 *   • Pin toggle + Delete-with-undo wired through the same
 *     /api/admin/vendors/* endpoints as the full page.
 *   • Pinned rows get a gold left-border accent (consistent with
 *     /admin/vendors row styling).
 *
 * Pure client component. Auth token comes from props (admin
 * dashboard already holds it).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Loader2,
  Pin,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";
import {
  VENDOR_CATEGORIES,
  type VendorApplicationRecord,
} from "@/lib/vendorApplication";

const MAX_ROWS = 8;

export function VendorControlPanel({ token }: { token: string }) {
  const [rows, setRows] = useState<VendorApplicationRecord[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load approved + live vendors once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) {
          setError("Supabase לא מוגדר");
          return;
        }
        const { data, error: qErr } = await supabase
          .from("vendor_applications")
          .select("*")
          .eq("status", "approved")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (cancelled) return;
        if (qErr) {
          console.error("[VendorControlPanel] query error:", qErr);
          setError("שגיאה בטעינת הספקים");
          return;
        }
        setRows((data as VendorApplicationRecord[]) ?? []);
      } catch (e) {
        if (cancelled) return;
        console.error("[VendorControlPanel]", e);
        setError("שגיאת רשת");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sort: pinned first (by featured_at desc), then by created_at desc.
  const sorted = (rows ?? []).slice().sort((a, b) => {
    const af = a.featured_at ? new Date(a.featured_at).getTime() : 0;
    const bf = b.featured_at ? new Date(b.featured_at).getTime() : 0;
    if (af !== bf) return bf - af;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });

  const togglePin = async (vendor: VendorApplicationRecord) => {
    const nextFeatured = !vendor.featured_at;
    setBusyId(vendor.id);
    try {
      const res = await fetch("/api/admin/vendors/feature", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vendorId: vendor.id, featured: nextFeatured }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        featuredAt?: string | null;
      };
      if (!res.ok) {
        console.error("[VendorControlPanel] feature error", res.status, data);
        showToast(data.message ?? "ההצמדה נכשלה", "error");
        return;
      }
      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.id === vendor.id
            ? {
                ...r,
                featured_at: nextFeatured
                  ? (data.featuredAt ?? new Date().toISOString())
                  : null,
              }
            : r,
        ),
      );
      showToast(
        nextFeatured
          ? "📌 הספק מוצמד לראש הקטלוג"
          : "ההצמדה בוטלה",
        "success",
      );
    } catch (e) {
      console.error("[VendorControlPanel] feature exception", e);
      showToast("שגיאה ברשת", "error");
    } finally {
      setBusyId(null);
    }
  };

  const removeVendor = async (vendor: VendorApplicationRecord) => {
    setBusyId(vendor.id);
    try {
      const res = await fetch("/api/admin/vendors/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vendorId: vendor.id, reason: "" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!res.ok) {
        console.error("[VendorControlPanel] delete error", res.status, data);
        showToast(data.message ?? "המחיקה נכשלה", "error");
        return;
      }
      // Optimistic remove from the visible list.
      setRows((prev) => (prev ?? []).filter((r) => r.id !== vendor.id));
      showToast(`✓ ${vendor.business_name} הוסר מהקטלוג`, "success", {
        duration: 8000,
        action: {
          label: "בטל",
          onClick: () => void restoreVendor(vendor),
        },
      });
    } catch (e) {
      console.error("[VendorControlPanel] delete exception", e);
      showToast("שגיאה ברשת", "error");
    } finally {
      setBusyId(null);
    }
  };

  const restoreVendor = async (vendor: VendorApplicationRecord) => {
    setBusyId(vendor.id);
    try {
      const res = await fetch("/api/admin/vendors/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vendorId: vendor.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        showToast(data.message ?? "השחזור נכשל", "error");
        return;
      }
      // Re-add to the visible list. Keeps existing order roughly correct.
      setRows((prev) =>
        prev
          ? [
              ...prev,
              { ...vendor, deleted_at: null, deletion_reason: null },
            ]
          : null,
      );
      showToast(`✓ ${vendor.business_name} שוחזר`, "success");
    } catch (e) {
      console.error("[VendorControlPanel] restore exception", e);
      showToast("שגיאה ברשת", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="card p-5 md:p-6 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Briefcase size={20} className="text-[--accent]" aria-hidden />
          שליטה בספקים
        </h2>
        <Link
          href="/admin/vendors"
          className="text-xs inline-flex items-center gap-1 transition hover:translate-y-[-1px]"
          style={{ color: "var(--accent)" }}
        >
          צפה בכולם
          <ChevronLeft size={13} />
        </Link>
      </div>

      {rows === null && !error && (
        <div className="flex justify-center py-8">
          <Loader2
            size={20}
            className="animate-spin"
            style={{ color: "var(--accent)" }}
          />
        </div>
      )}

      {error && (
        <div
          className="text-sm rounded-xl px-3 py-2"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "rgb(252,165,165)",
          }}
        >
          {error}
        </div>
      )}

      {rows && rows.length === 0 && !error && (
        <div
          className="text-sm text-center py-8 rounded-xl"
          style={{
            background: "var(--input-bg)",
            color: "var(--foreground-muted)",
          }}
        >
          עדיין אין ספקים בקטלוג. ספקים חדשים יופיעו כאן אוטומטית.
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-2">
          {sorted.slice(0, MAX_ROWS).map((vendor) => (
            <VendorRow
              key={vendor.id}
              vendor={vendor}
              busy={busyId === vendor.id}
              onPinToggle={() => void togglePin(vendor)}
              onRemove={() => void removeVendor(vendor)}
            />
          ))}
          {rows.length > MAX_ROWS && (
            <Link
              href="/admin/vendors"
              className="block text-center text-xs py-2.5 rounded-xl transition hover:bg-[var(--secondary-button-bg)]"
              style={{
                color: "var(--foreground-soft)",
                border: "1px dashed var(--border)",
              }}
            >
              ועוד {rows.length - MAX_ROWS} ספקים נוספים — פתח את הניהול המלא
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function VendorRow({
  vendor,
  busy,
  onPinToggle,
  onRemove,
}: {
  vendor: VendorApplicationRecord;
  busy: boolean;
  onPinToggle: () => void;
  onRemove: () => void;
}) {
  const cat = VENDOR_CATEGORIES.find((c) => c.id === vendor.category);
  const isFeatured = !!vendor.featured_at;
  return (
    <div
      className="rounded-xl p-3 flex items-center justify-between text-sm gap-3 transition"
      style={{
        background: "var(--input-bg)",
        border: "1px solid var(--border)",
        ...(isFeatured
          ? {
              borderInlineStartWidth: 3,
              borderInlineStartStyle: "solid",
              borderInlineStartColor: "var(--accent)",
              background:
                "linear-gradient(90deg, rgba(212,176,104,0.06), var(--input-bg) 60%)",
            }
          : null),
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span aria-hidden>{cat?.emoji}</span>
          <span className="font-semibold truncate">{vendor.business_name}</span>
          {isFeatured && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0"
              style={{
                background: "rgba(212,176,104,0.18)",
                color: "var(--accent)",
                border: "1px solid var(--border-gold)",
              }}
            >
              📌
            </span>
          )}
        </div>
        <div
          className="text-xs truncate mt-0.5"
          style={{ color: "var(--foreground-muted)" }}
        >
          {cat?.label}
          {vendor.city ? ` · ${vendor.city}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onPinToggle}
          disabled={busy}
          aria-label={isFeatured ? "בטל הצמדה" : "הצמד לראש הקטלוג"}
          title={isFeatured ? "בטל הצמדה" : "הצמד לראש הקטלוג"}
          className="h-8 w-8 rounded-full inline-flex items-center justify-center transition disabled:opacity-50"
          style={
            isFeatured
              ? {
                  background:
                    "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                  color: "var(--gold-button-text)",
                }
              : {
                  border: "1px solid var(--border-gold)",
                  color: "var(--accent)",
                  background: "rgba(212,176,104,0.05)",
                }
          }
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" aria-hidden />
          ) : (
            <Pin
              size={13}
              aria-hidden
              fill={isFeatured ? "currentColor" : "none"}
            />
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label="הסר מהקטלוג"
          title="הסר את הספק מהקטלוג"
          className="h-8 w-8 rounded-full inline-flex items-center justify-center transition disabled:opacity-50"
          style={{
            border: "1px solid rgba(248,113,113,0.4)",
            color: "rgb(252,165,165)",
            background: "rgba(248,113,113,0.06)",
          }}
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin" aria-hidden />
          ) : (
            <Trash2 size={13} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
