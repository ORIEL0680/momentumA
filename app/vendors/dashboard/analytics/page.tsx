"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  MessageSquare,
  TrendingUp,
  Loader2,
  AlertCircle,
  Inbox,
  Star,
  ExternalLink,
} from "lucide-react";
import { Header } from "@/components/Header";
import { getSupabase } from "@/lib/supabase";

/**
 * R86 (R68) — vendor analytics dashboard.
 *
 * Three panels on top of the vendor's existing data:
 *   • Daily views — last 30 days line chart (pure SVG, no chart lib
 *     dependency — keeps the bundle lean).
 *   • Totals — views, leads, conversion %.
 *   • Action breakdown — count of WhatsApp / phone / instagram clicks
 *     from vendor_page_actions, so the vendor sees WHICH channels
 *     actually convert.
 *
 * All reads use the user's anon-keyed client. RLS on vendor_page_views,
 * vendor_page_actions and vendor_leads scopes results to the vendor's
 * own slug (via `vendor_landings.owner_user_id = auth.uid()`).
 */

interface VendorLanding {
  id: string;
  slug: string | null;
  name: string;
}

interface DailyView {
  day: string;
  count: number;
}

interface ActionCount {
  action_type: string;
  count: number;
}

const ACTION_LABELS: Record<string, { label: string; emoji: string }> = {
  whatsapp: { label: "וואטסאפ", emoji: "💬" },
  phone: { label: "שיחות", emoji: "📞" },
  email: { label: "אימייל", emoji: "📧" },
  website: { label: "אתר", emoji: "🌐" },
  instagram: { label: "אינסטגרם", emoji: "📸" },
  facebook: { label: "פייסבוק", emoji: "📘" },
  gallery_open: { label: "פתיחת גלריה", emoji: "🖼️" },
  review_helpful: { label: "לייק על ביקורת", emoji: "👍" },
};

export default function VendorAnalyticsPage() {
  const [landing, setLanding] = useState<VendorLanding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [views, setViews] = useState<DailyView[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [leadsCount, setLeadsCount] = useState(0);
  const [actions, setActions] = useState<ActionCount[]>([]);
  // R124 — review summary so the new #reviews section can show a
  // count + average without redirecting the vendor to the public page.
  const [reviewStats, setReviewStats] = useState<{
    count: number;
    avg: number | null;
  }>({ count: 0, avg: null });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) {
          setError("Supabase לא מוגדר.");
          setLoading(false);
          return;
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("צריך להתחבר.");
          setLoading(false);
          return;
        }

        // Step 1 — find the vendor landing owned by this user.
        const { data: landingRow } = (await supabase
          .from("vendor_landings")
          .select("id, slug, name")
          .eq("owner_user_id", user.id)
          .maybeSingle()) as { data: VendorLanding | null };
        if (cancelled) return;
        if (!landingRow?.slug) {
          // No landing → nothing to analyze. Page handles the empty state.
          setLanding(landingRow);
          setLoading(false);
          return;
        }
        setLanding(landingRow);

        // Step 2 — pull 30 days of views (capped at 10k rows to stay
        // cheap on serverless). The chart only needs day-buckets so
        // we count client-side; smaller code than a SQL `group by`.
        //
        // R97 — `vendor_page_views.vendor_id` stores the landing
        // UUID (see lib/vendorStudio.ts `trackPageView(vendor.id)`,
        // where `vendor.id` is the vendor_landings.id UUID). The
        // PRE-R97 code queried by `landingRow.slug` here, which
        // never matched — every analytics dashboard showed 0
        // views regardless of actual traffic. The /vendors/dashboard
        // metric strip got it right (R142 used `landingIdAsText`);
        // this page lagged. Now using `landingRow.id`.
        const thirtyAgo = new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString();
        const { data: viewRows } = await supabase
          .from("vendor_page_views")
          .select("viewed_at")
          .eq("vendor_id", landingRow.id)
          .gte("viewed_at", thirtyAgo)
          .order("viewed_at", { ascending: false })
          .limit(10000);
        if (cancelled) return;

        const dayBuckets = bucketByDay(
          (viewRows ?? []).map((r) => (r as { viewed_at: string }).viewed_at),
        );
        setViews(dayBuckets);
        setTotalViews(viewRows?.length ?? 0);

        // Step 3 — total leads for this vendor.
        const { count: leadCount } = await supabase
          .from("vendor_leads")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", landingRow.slug);
        if (cancelled) return;
        setLeadsCount(leadCount ?? 0);

        // Step 4 — action breakdown (last 30 days).
        // R97 — same UUID vs slug fix as Step 2. vendor_page_actions
        // is keyed by the landing UUID, not the slug.
        const { data: actionRows } = await supabase
          .from("vendor_page_actions")
          .select("action_type")
          .eq("vendor_id", landingRow.id)
          .gte("action_at", thirtyAgo);
        if (cancelled) return;
        const map = new Map<string, number>();
        for (const r of actionRows ?? []) {
          const t = (r as { action_type: string }).action_type;
          map.set(t, (map.get(t) ?? 0) + 1);
        }
        const list = Array.from(map.entries())
          .map(([action_type, count]) => ({ action_type, count }))
          .sort((a, b) => b.count - a.count);
        setActions(list);

        // R124 — review aggregate. Pulls just the ratings (id + rating)
        // so we can compute count + avg without dragging the full
        // text payload of each review. Cheap query, no pagination
        // needed at this scale (vendors with 1000+ reviews are rare).
        const { data: reviewRows } = await supabase
          .from("vendor_reviews")
          .select("rating")
          .eq("vendor_id", landingRow.slug);
        if (cancelled) return;
        const ratings = (reviewRows ?? [])
          .map((r) => (r as { rating: number }).rating)
          .filter((n) => Number.isFinite(n) && n > 0);
        const avg =
          ratings.length > 0
            ? Math.round(
                (ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10,
              ) / 10
            : null;
        setReviewStats({ count: ratings.length, avg });
      } catch (e) {
        if (cancelled) return;
        console.error("[vendor-analytics]", e);
        setError("שגיאת טעינה.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const conversionPct = useMemo(() => {
    if (totalViews === 0) return 0;
    return Math.round((leadsCount / totalViews) * 1000) / 10;
  }, [totalViews, leadsCount]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="flex items-center justify-center py-20">
          <Loader2
            className="animate-spin"
            size={26}
            style={{ color: "var(--accent)" }}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-10">
        <Link
          href="/vendors/dashboard"
          className="text-sm inline-flex items-center gap-1.5"
          style={{ color: "var(--foreground-muted)" }}
        >
          <ArrowRight size={14} /> חזרה לדשבורד
        </Link>

        <h1 className="mt-4 text-3xl font-bold gradient-text">
          ניתוח ביצועים
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--foreground-soft)" }}>
          30 הימים האחרונים{landing?.name ? ` · ${landing.name}` : ""}
        </p>

        {error && (
          <div
            className="mt-6 card p-4 flex items-center gap-3"
            style={{ border: "1px solid rgba(239,68,68,0.25)" }}
          >
            <AlertCircle size={18} className="text-red-300 shrink-0" />
            <span style={{ color: "var(--foreground-soft)" }}>{error}</span>
          </div>
        )}

        {/* Empty state — vendor hasn't built a landing yet */}
        {!error && !landing?.slug && (
          <div className="mt-8 card-gold p-10 text-center">
            <TrendingUp size={32} className="mx-auto text-[--accent]" />
            <h2 className="mt-4 text-lg font-bold">
              עוד אין נתונים להציג
            </h2>
            <p
              className="mt-1 text-sm max-w-md mx-auto leading-relaxed"
              style={{ color: "var(--foreground-soft)" }}
            >
              בנו את דף הנחיתה שלכם כדי שזוגות יוכלו לראות אותכם — ואז כאן
              תראו צפיות, פניות, ונתוני המרה אמיתיים.
            </p>
            <Link
              href="/dashboard/vendor-studio"
              className="btn-gold inline-flex mt-5"
            >
              בנו את הדף שלכם
            </Link>
          </div>
        )}

        {!error && landing?.slug && (
          <>
            {/* KPI cards */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Kpi
                icon={<Eye size={18} />}
                value={totalViews}
                label="צפיות (30 ימים)"
              />
              <Kpi
                icon={<Inbox size={18} />}
                value={leadsCount}
                label="לידים שנשלחו"
              />
              {/* R124 — pre-data state shows "—" instead of "0.0%" so
                  a vendor whose first lead hasn't come in yet doesn't
                  think the dashboard is broken. Below ~10 views the
                  conversion ratio is noise anyway. */}
              <Kpi
                icon={<TrendingUp size={18} />}
                value={
                  totalViews < 10
                    ? "—"
                    : `${conversionPct}%`
                }
                label="המרה (לידים/צפיות)"
                tone={
                  totalViews < 10
                    ? "muted"
                    : conversionPct >= 5
                      ? "positive"
                      : conversionPct >= 2
                        ? "neutral"
                        : "muted"
                }
                hint={totalViews < 10 ? "ממתינים ליותר צפיות" : undefined}
              />
            </div>

            {/* Daily views chart */}
            <section className="mt-8">
              <h2
                className="text-xs uppercase tracking-widest font-semibold mb-3"
                style={{ color: "var(--accent)" }}
              >
                צפיות יומיות
              </h2>
              <div className="card p-5">
                {views.length === 0 ? (
                  <p
                    className="text-sm text-center py-6"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    אין צפיות ב-30 הימים האחרונים.
                  </p>
                ) : (
                  <DailyViewsChart data={views} />
                )}
              </div>
            </section>

            {/* Actions breakdown */}
            <section className="mt-8">
              <h2
                className="text-xs uppercase tracking-widest font-semibold mb-3"
                style={{ color: "var(--accent)" }}
              >
                איך פונים אליכם
              </h2>
              <div className="card p-5">
                {actions.length === 0 ? (
                  <p
                    className="text-sm text-center py-6"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    אין פעולות עדיין. ברגע שזוגות יקליקו על וואטסאפ /
                    טלפון / אינסטגרם מהדף שלכם — נספור כאן.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {actions.map((a) => (
                      <ActionBar
                        key={a.action_type}
                        action={a.action_type}
                        count={a.count}
                        max={actions[0].count}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* R124 — Reviews summary section.
                #reviews is the anchor target the dashboard QuickAction
                links to (`/vendors/dashboard/analytics#reviews`).
                Shows count + average + a deep-link to the public
                landing's reviews block so vendors can read individual
                reviews without leaving Momentum more than once. */}
            <section className="mt-8 scroll-mt-20" id="reviews">
              <h2
                className="text-xs uppercase tracking-widest font-semibold mb-3"
                style={{ color: "var(--accent)" }}
              >
                ביקורות
              </h2>
              <div className="card p-5">
                {reviewStats.count === 0 ? (
                  <div className="text-center py-4">
                    <Star
                      size={22}
                      className="mx-auto"
                      style={{ color: "var(--foreground-muted)" }}
                      aria-hidden
                    />
                    <p
                      className="mt-2 text-sm"
                      style={{ color: "var(--foreground-soft)" }}
                    >
                      עדיין אין ביקורות. ברגע שזוג ישאיר ביקורת בדף שלך —
                      היא תופיע גם בקטלוג וגם כאן.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-5">
                    <div>
                      <div
                        className="text-4xl font-extrabold ltr-num flex items-baseline gap-1"
                        style={{ color: "var(--accent)" }}
                      >
                        {reviewStats.avg ?? "—"}
                        <Star
                          size={18}
                          fill="currentColor"
                          strokeWidth={0}
                          aria-hidden
                        />
                      </div>
                      <div
                        className="mt-0.5 text-xs"
                        style={{ color: "var(--foreground-soft)" }}
                      >
                        ממוצע ב-
                        <span className="ltr-num">{reviewStats.count}</span>{" "}
                        ביקורות
                      </div>
                    </div>
                    {landing?.slug && (
                      <Link
                        href={`/vendor/${landing.slug}#reviews`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ms-auto text-xs rounded-full px-4 py-2 inline-flex items-center gap-1.5 transition"
                        style={{
                          border: "1px solid var(--border-gold)",
                          color: "var(--accent)",
                          background: "rgba(212,176,104,0.06)",
                        }}
                      >
                        קרא את כל הביקורות
                        <ExternalLink size={12} aria-hidden />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </section>

            <p
              className="mt-8 text-[11px] text-center"
              style={{ color: "var(--foreground-muted)" }}
            >
              <MessageSquare
                size={11}
                className="inline-block ms-1"
                aria-hidden
              />
              הנתונים מתעדכנים בזמן אמת. לידים יוצרים שורה בכל שליחת
              הודעה דרך הדף.
            </p>
          </>
        )}
      </main>
    </>
  );
}

/* ─────────────── child components ─────────────── */

function Kpi({
  icon,
  value,
  label,
  tone = "neutral",
  hint,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  tone?: "positive" | "neutral" | "muted";
  /** R124 — optional sub-line under the KPI label. Used for "ממתינים ליותר צפיות"
   *  when the input set is too small to compute a meaningful ratio. */
  hint?: string;
}) {
  const toneColor =
    tone === "positive"
      ? "rgb(110,231,183)"
      : tone === "muted"
        ? "var(--foreground-muted)"
        : "var(--accent)";
  return (
    <div className="card p-5">
      <div
        className="w-9 h-9 rounded-full inline-flex items-center justify-center"
        style={{
          background: "color-mix(in srgb, var(--accent) 12%, transparent)",
          color: "var(--accent)",
        }}
      >
        {icon}
      </div>
      <div
        className="mt-3 text-3xl font-extrabold ltr-num"
        style={{ color: toneColor }}
      >
        {value}
      </div>
      <div
        className="mt-1 text-xs"
        style={{ color: "var(--foreground-soft)" }}
      >
        {label}
      </div>
      {hint && (
        <div
          className="mt-0.5 text-[10px]"
          style={{ color: "var(--foreground-muted)" }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function ActionBar({
  action,
  count,
  max,
}: {
  action: string;
  count: number;
  max: number;
}) {
  const meta = ACTION_LABELS[action] ?? { label: action, emoji: "•" };
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden>{meta.emoji}</span>
          {meta.label}
        </span>
        <span className="ltr-num font-bold" style={{ color: "var(--accent)" }}>
          {count}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--input-bg)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, var(--gold-100), var(--gold-500))",
          }}
        />
      </div>
    </div>
  );
}

/** Pure-SVG line chart. 30 day-buckets across full width. Lazy on
 *  visual fidelity to keep the bundle small. */
function DailyViewsChart({ data }: { data: DailyView[] }) {
  const width = 600;
  const height = 160;
  const padding = { top: 14, right: 8, bottom: 22, left: 8 };
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX =
    data.length > 1
      ? (width - padding.left - padding.right) / (data.length - 1)
      : 0;
  const points = data.map((d, i) => {
    const x = padding.left + i * stepX;
    const y =
      height -
      padding.bottom -
      (d.count / max) * (height - padding.top - padding.bottom);
    return { x, y, d };
  });
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    points.length > 1
      ? `${path} L ${points[points.length - 1].x.toFixed(1)} ${height - padding.bottom} L ${points[0].x.toFixed(1)} ${height - padding.bottom} Z`
      : null;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      aria-label="גרף צפיות יומיות"
      role="img"
    >
      <defs>
        <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill="url(#ga)" />}
      <path
        d={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {points.map((p) => (
        <circle
          key={p.d.day}
          cx={p.x}
          cy={p.y}
          r={p.d.count > 0 ? 2.5 : 0}
          fill="var(--accent)"
        >
          <title>
            {p.d.day}: {p.d.count} צפיות
          </title>
        </circle>
      ))}
    </svg>
  );
}

/** Build a continuous 30-day series from a flat list of timestamps. */
function bucketByDay(timestamps: string[]): DailyView[] {
  const byDay = new Map<string, number>();
  for (const ts of timestamps) {
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const out: DailyView[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(cursor);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}
