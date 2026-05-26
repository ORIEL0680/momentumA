import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Home, ArrowRight } from "lucide-react";

/**
 * R81-12 — Custom Hebrew 404 page.
 *
 * Pre-R81, hitting a non-existent route showed the generic Next.js
 * 404 — English text, no nav back to the app. Owner reviewer might
 * land on a dead old link and bounce. The new page:
 *   • Speaks Hebrew + matches the app's gold-on-black tone.
 *   • Two clear CTAs back into the product: the landing page and
 *     the dashboard.
 *   • Stays server-rendered so it has zero client JS cost.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 relative overflow-hidden text-center">
      <div
        aria-hidden
        className="glow-orb glow-orb-gold w-[600px] h-[600px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-25"
      />

      <div className="relative z-10 max-w-md">
        <div className="flex justify-center mb-7">
          <Logo size={28} />
        </div>

        <div className="card-gold p-8">
          <div className="text-6xl font-extrabold gradient-gold ltr-num">404</div>
          <h1 className="mt-3 text-2xl font-bold gradient-text">
            הדף שביקשת לא נמצא
          </h1>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: "var(--foreground-soft)" }}
          >
            ייתכן שהקישור פג, נמחק או מעולם לא היה. אפשר לחזור לעמוד
            הבית ולהמשיך מהמסע.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href="/dashboard"
              className="btn-gold inline-flex items-center justify-center gap-2 text-sm"
              style={{ minHeight: 44 }}
            >
              חזרה לדשבורד
              <ArrowRight size={14} aria-hidden />
            </Link>
            <Link
              href="/"
              className="btn-secondary inline-flex items-center justify-center gap-2 text-sm"
              style={{ minHeight: 44 }}
            >
              <Home size={14} aria-hidden />
              דף הבית
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
