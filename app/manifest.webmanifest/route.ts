export const dynamic = "force-static";

// Canonical origin — env wins in prod (Vercel), moomentum.events is the
// safe fallback. Used only for the stable PWA `id`; start_url/scope stay
// relative so the manifest works on any host.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://moomentum.events";

export function GET() {
  const manifest = {
    id: `${SITE_URL}/`,
    name: "Momentum — תכנון אירועים",
    short_name: "Momentum",
    description: "הדרך החכמה לתכנן אירועים",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0A0A0B",
    theme_color: "#0A0A0B",
    lang: "he",
    dir: "rtl",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json" },
  });
}
