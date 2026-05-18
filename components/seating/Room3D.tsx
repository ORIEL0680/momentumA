"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { Guest, SeatingTable } from "@/lib/types";

/**
 * R44 · Feature 3 — ROOM 3D lazy wrapper.
 *
 * three.js / r3f / drei are pulled ONLY here, via a dynamic ssr:false
 * import — so they never touch the main bundle and only download when
 * the user actually opens the 3D view. WebGL is feature-detected; on
 * unsupported / failed contexts the caller stays on the existing 2D
 * view (we render a clear notice, never a blank canvas).
 */

const Room3DScene = dynamic(() => import("./Room3DScene"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="animate-spin text-[--accent]" size={28} />
    </div>
  ),
});

function webglOK(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl2") || c.getContext("webgl")
    );
  } catch {
    return false;
  }
}

export function Room3D({
  tables,
  guests,
  seatAssignments,
}: {
  tables: SeatingTable[];
  guests: Guest[];
  seatAssignments: Record<string, string>;
}) {
  const supported = useMemo(() => webglOK(), []);
  const [focusGuestId, setFocusGuestId] = useState<string | null>(null);

  const seated = useMemo(
    () =>
      guests
        .filter((g) => seatAssignments[g.id])
        .sort((a, b) => a.name.localeCompare(b.name, "he")),
    [guests, seatAssignments],
  );

  if (!supported) {
    return (
      <div
        className="rounded-3xl p-8 text-center"
        style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}
      >
        <p className="font-semibold">תצוגת 3D לא נתמכת במכשיר הזה</p>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--foreground-soft)" }}
        >
          ממשיכים עם תצוגת המפה הרגילה — הכול עובד כרגיל.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          height: "min(70vh, 560px)",
          border: "1px solid var(--border-gold)",
          background: "#0A0A0B",
        }}
      >
        <Room3DScene
          tables={tables}
          guests={guests}
          seatAssignments={seatAssignments}
          focusGuestId={focusGuestId}
        />
      </div>

      {seated.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={focusGuestId ?? ""}
            onChange={(e) => setFocusGuestId(e.target.value || null)}
            className="input"
            aria-label="עמדו במקום של אורח"
            style={{ maxWidth: 260 }}
          >
            <option value="">תעמדו במקום של…</option>
            {seated.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {focusGuestId && (
            <button
              type="button"
              onClick={() => setFocusGuestId(null)}
              className="btn-secondary text-sm"
            >
              חזרה למבט-על
            </button>
          )}
        </div>
      )}
    </div>
  );
}
