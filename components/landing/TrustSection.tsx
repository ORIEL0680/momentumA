import { Shield, Server, Heart, type LucideIcon } from "lucide-react";

/**
 * R48 — trust by demonstration. Bank-grade infrastructure framed
 * honestly (real stack, real security posture, real human support).
 * Server component, CSS-only.
 */
const PILLARS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Shield,
    title: "אבטחה ברמת בנק",
    body: "הצפנה AES-256 · GDPR מלא · Row Level Security על כל טבלה · 13 סבבי ביקורת אבטחה לפני השקה",
  },
  {
    icon: Server,
    title: "נבנה על תשתית מובילה",
    body: "Supabase (DB + Auth) · Twilio (SMS) · OpenAI (AI) · Vercel (CDN) · כלים שמיליוני אפליקציות בעולם משתמשים בהם",
  },
  {
    icon: Heart,
    title: "תמיכה אנושית 24/7",
    body: "וואטסאפ ישיר עם המייסד · תגובה תוך 4 שעות · ליווי מותאם ל-100 הזוגות הראשונים — כולל שיחת אונבורדינג",
  },
];

export function TrustSection() {
  return (
    <section className="py-24 md:py-32 relative">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <h2
          className="text-center font-bold gradient-text"
          style={{ fontSize: "clamp(2rem, 6vw, 3rem)" }}
        >
          תשתית של בנק. חוויה של רויאלטי.
        </h2>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="card-gold p-7 md:p-8 transition duration-200 hover:-translate-y-0.5"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background:
                    "color-mix(in srgb, var(--gold-100) 14%, transparent)",
                  border: "1px solid var(--border-gold)",
                  color: "var(--accent)",
                }}
                aria-hidden
              >
                <Icon size={22} />
              </div>
              <h3 className="mt-5 text-xl font-bold leading-snug">{title}</h3>
              <p
                className="mt-3 leading-relaxed"
                style={{ color: "var(--foreground-soft)", fontSize: "1.02rem" }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
