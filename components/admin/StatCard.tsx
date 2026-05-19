import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { MiniChart } from "./MiniChart";

/**
 * R59 (R49) — the big KPI card. Same gold language as the landing page
 * (card-gold + gradient-gold number). Pure presentational, no client JS.
 */
export interface StatCardProps {
  label: string;
  value: string | number;
  delta?: { value: number; period: string };
  chart?: number[];
  href?: string;
  isPlaceholder?: boolean;
}

export function StatCard({
  label,
  value,
  delta,
  chart,
  href,
  isPlaceholder = false,
}: StatCardProps) {
  const deltaColor =
    !delta || delta.value === 0
      ? "var(--foreground-muted)"
      : delta.value > 0
        ? "rgb(110,200,150)"
        : "rgb(239,120,120)";
  const DeltaIcon =
    !delta || delta.value === 0
      ? Minus
      : delta.value > 0
        ? ArrowUpRight
        : ArrowDownRight;

  const inner = (
    <div className="relative card-gold p-5 md:p-6 h-full flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_var(--accent-glow)]">
      <div
        className="text-sm font-medium"
        style={{ color: "var(--foreground-soft)" }}
      >
        {label}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-4xl md:text-5xl font-extrabold gradient-gold ltr-num leading-none">
          {value}
        </div>
        {delta && (
          <span
            className="inline-flex items-center gap-1 text-xs font-bold ltr-num shrink-0 pb-1"
            style={{ color: deltaColor }}
          >
            <DeltaIcon size={13} aria-hidden />
            {delta.value > 0 ? "+" : ""}
            {delta.value}% {delta.period}
          </span>
        )}
      </div>

      {chart && chart.length > 0 && (
        <div className="mt-auto pt-4 -mx-1">
          <MiniChart data={chart} />
        </div>
      )}

      {isPlaceholder && (
        <div
          className="absolute inset-0 flex items-center justify-center text-sm font-semibold rounded-[inherit]"
          style={{
            background: "color-mix(in srgb, var(--background) 78%, transparent)",
            color: "var(--foreground-muted)",
            backdropFilter: "blur(1px)",
          }}
        >
          בקרוב (Q3 2026)
        </div>
      )}
    </div>
  );

  if (href && !isPlaceholder) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}
