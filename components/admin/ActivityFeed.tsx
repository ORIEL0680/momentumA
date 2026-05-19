"use client";

import { useEffect, useState } from "react";
import { UserPlus, Store, Star, Activity as ActivityIcon } from "lucide-react";
import {
  subscribeAdminActivity,
  type ActivityItem,
  type ActivityKind,
} from "@/lib/admin/realtime";

/**
 * R59 (R49) — live activity feed. Seeds from the stats route's
 * recent_activity, then appends realtime INSERTs (app_states /
 * vendor_applications / vendor_reviews). A green dot pulses for
 * anything in the last 30s.
 */

interface SeedItem {
  id: string;
  type: string;
  label: string;
  timestamp: string;
}

function seedKind(type: string): ActivityKind {
  if (type.startsWith("vendor")) return "vendor";
  if (type === "review") return "review";
  return "state";
}

function iconFor(kind: ActivityKind) {
  if (kind === "vendor") return Store;
  if (kind === "review") return Star;
  return UserPlus;
}

function relativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 45) return "ממש עכשיו";
  const m = Math.floor(s / 60);
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.floor(h / 24);
  if (d < 7) return `לפני ${d} ימים`;
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "short",
  });
}

export function ActivityFeed({
  initial = [],
  limit = 20,
}: {
  initial?: SeedItem[];
  limit?: number;
}) {
  // Lazy init from the seed (no setState-in-effect).
  const [items, setItems] = useState<ActivityItem[]>(() =>
    initial.slice(0, limit).map((s) => ({
      id: s.id,
      kind: seedKind(s.type),
      label: s.label,
      at: s.timestamp,
    })),
  );
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const unsub = subscribeAdminActivity((item) => {
      setItems((prev) => [item, ...prev].slice(0, limit));
      setNow(Date.now());
    });
    const tick = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      unsub();
      window.clearInterval(tick);
    };
  }, [limit]);

  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <ActivityIcon size={16} style={{ color: "var(--accent)" }} aria-hidden />
        <h2 className="font-bold">פעילות חיה</h2>
        <span
          className="ms-auto inline-flex items-center gap-1.5 text-xs"
          style={{ color: "var(--foreground-muted)" }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "rgb(110,200,150)" }}
            aria-hidden
          />
          realtime
        </span>
      </div>

      {items.length === 0 ? (
        <p
          className="text-sm py-8 text-center"
          style={{ color: "var(--foreground-muted)" }}
        >
          אין פעילות עדיין. ברגע שמישהו נרשם / מגיש בקשת ספק — זה יופיע כאן
          בזמן אמת.
        </p>
      ) : (
        <ul className="space-y-1 max-h-[600px] overflow-y-auto pe-1">
          {items.map((it) => {
            const Icon = iconFor(it.kind);
            const fresh = now - new Date(it.at).getTime() < 30000;
            return (
              <li
                key={it.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "var(--input-bg)" }}
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background:
                      "color-mix(in srgb, var(--gold-100) 14%, transparent)",
                    border: "1px solid var(--border-gold)",
                    color: "var(--accent)",
                  }}
                  aria-hidden
                >
                  <Icon size={15} />
                </span>
                <span className="flex-1 min-w-0 text-sm truncate">
                  {it.label}
                </span>
                {fresh && (
                  <span
                    className="w-2 h-2 rounded-full animate-pulse shrink-0"
                    style={{ background: "rgb(110,200,150)" }}
                    aria-hidden
                  />
                )}
                <span
                  className="text-xs ltr-num shrink-0"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  {relativeTime(it.at, now)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
