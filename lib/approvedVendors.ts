import type { Vendor, VendorType, Region } from "./types";
import { getVendorPhotoUrl } from "./vendorStudio";

/**
 * R38 — map an APPROVED `vendor_applications` row (returned by the
 * `list_approved_vendors` RPC — public-safe columns only) into the
 * `Vendor` shape the catalog UI renders.
 *
 * Pure + isomorphic. Never throws — a bad row maps to a usable card or
 * is skipped by the caller.
 */

export interface ApprovedVendorRow {
  id: string;
  business_name: string;
  category: string;
  city: string | null;
  about: string | null;
  /** R146 — vendor's one-line tagline from vendor_landings. Null when
   *  the vendor never set one in the editor. Shown above the
   *  description in the catalog card when present. */
  tagline?: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  /** R117 — Storage path (vendor-studio bucket) for the vendor's
   *  profile photo / logo, joined in from vendor_landings via the
   *  auth user's email. Null when the vendor hasn't uploaded yet.
   *
   *  R146 — also now reflects landing edits: business_name, category,
   *  city, about, website, instagram, facebook are all COALESCE'd
   *  landing-first in the RPC, so this row shape stays the same but
   *  the data behind it is the live editable value.
   *
   *  R86 — legacy. Prefer the explicit `logo_url` + `cover_image_url`
   *  fields below; we keep this in the row so old vendors who
   *  haven't migrated to the new fields still render. */
  hero_photo_path: string | null;
  /** R86 — explicit logo URL (or Storage path). Optional in the RPC
   *  return because old DBs (pre-2026-05-28 migration) won't have
   *  the column. */
  logo_url?: string | null;
  /** R86 — explicit cover URL (or Storage path). Same optional shape
   *  as logo_url. */
  cover_image_url?: string | null;
  /** R86 — touched by the DB trigger whenever any image field
   *  changes. Used as a cache-buster on image URLs. */
  image_updated_at?: string | null;
  created_at: string | null;
}

// VendorApplication category id → catalog VendorType. Mirrors the
// mapping documented in app/api/vendors/admin/decide/route.ts.
const CATEGORY_TO_TYPE: Record<string, VendorType> = {
  venue: "venue",
  catering: "catering",
  photography: "photography",
  videography: "videography",
  "music-dj": "dj",
  rabbi: "rabbi",
  "makeup-hair": "makeup",
  bridal: "dress",
  groomswear: "dress",
  florist: "florist",
  invitations: "stationery",
  printing: "printing",
  chuppah: "designer",
  transport: "transportation",
  other: "entertainment", // no 1:1 VendorType — closest generic bucket
};

// Free-text city → Region. Heuristic (substring match); region is a
// soft filter, so an imperfect guess just affects default sort, never
// correctness. Unknown → "tel-aviv" (the broadest "מרכז" bucket).
const CITY_REGION_RULES: Array<[RegExp, Region]> = [
  [/תל.?אביב|ת"א|רמת.?גן|גבעתיים|חולון|בת.?ים|ראשון|אזור|יפו/, "tel-aviv"],
  [/ירושלים|בית.?שמש|מבשרת|מעלה.?אדומים/, "jerusalem"],
  [/חיפה|קריות|קריית|נשר|טירת.?כרמל/, "haifa"],
  [/נהריה|עכו|כרמיאל|צפת|טבריה|קריית.?שמונה|גליל|עפולה|נצרת|מגדל.?העמק|כרמל/, "north"],
  [/באר.?שבע|אילת|דימונה|אופקים|נתיבות|שדרות|נגב|ערד/, "south"],
  [/נתניה|הרצליה|כפר.?סבא|רעננה|הוד.?השרון|השרון|רמת.?השרון|כפר.?יונה/, "sharon"],
  [/רחובות|נס.?ציונה|יבנה|לוד|רמלה|מודיעין|גדרה|שפלה|קרית.?עקרון/, "shfela"],
];

function regionFromCity(city: string | null | undefined): Region {
  const c = (city ?? "").trim();
  if (c) {
    for (const [re, region] of CITY_REGION_RULES) {
      if (re.test(c)) return region;
    }
  }
  return "tel-aviv";
}

function cleanHandle(v: string | null | undefined): string | undefined {
  const s = (v ?? "").trim();
  return s ? s : undefined;
}

export function mapApprovedRowToVendor(row: ApprovedVendorRow): Vendor {
  const type = CATEGORY_TO_TYPE[row.category] ?? "entertainment";
  const city = (row.city ?? "").trim();
  // R117 / R86 — resolve to a full public URL ONCE here. Priority:
  //   1. cover_image_url (the wide-aspect cover, ideal for the
  //      catalog tile's 16/10 frame)
  //   2. logo_url (smaller brand mark, used as fallback)
  //   3. hero_photo_path (legacy single image — used by every
  //      vendor pre-2026-05-28 migration)
  // The first non-empty wins.
  //
  // Cache-bust: append `?v=image_updated_at` so a browser that
  // cached the URL for `/storage/v1/.../logo-1234.jpg` doesn't
  // serve the old version after the vendor reuploads. Skipped for
  // URLs that already carry a query string.
  const rawPhoto =
    (row.cover_image_url && row.cover_image_url.trim()) ||
    (row.logo_url && row.logo_url.trim()) ||
    (row.hero_photo_path && row.hero_photo_path.trim()) ||
    "";
  const resolved = rawPhoto ? getVendorPhotoUrl(rawPhoto) : "";
  const photoUrl = resolved
    ? appendCacheBuster(resolved, row.image_updated_at ?? row.created_at)
    : "";
  return {
    // `app-` prefix keeps DB-backed ids distinct from the static seed.
    id: `app-${row.id}`,
    name: row.business_name,
    type,
    region: regionFromCity(city),
    rating: 0,
    reviews: 0, // 0 → VendorCard shows the honest "ספק חדש" badge (R37)
    priceFrom: 0, // applications don't capture price; UI handles 0
    // R146 — tagline (one-liner from the editor) wins over the longer
    // `about` text in the catalog card, since the card has limited
    // space. Falls back to about → generic copy.
    description:
      (row.tagline ?? "").trim() ||
      (row.about ?? "").trim() ||
      `ספק מאומת${city ? ` · ${city}` : ""} שהצטרף דרך Momentum.`,
    phone: "", // never expose applicant phone here (PII) — contact via site/IG
    inCatalog: true,
    tags: ["ספק חדש", ...(city ? [city] : [])],
    website: cleanHandle(row.website),
    instagram: cleanHandle(row.instagram),
    facebook: cleanHandle(row.facebook),
    photoUrl: photoUrl || undefined,
  };
}

/**
 * R86 — appends a `?v=` query so browsers re-fetch when the vendor
 * uploads a new image to a stable URL (same Storage path, replaced
 * content). The version stamp comes from `image_updated_at` (or
 * `created_at` as fallback). No-op if the URL already carries a
 * query string — Supabase Storage public URLs don't, but we
 * future-proof in case a vendor pastes one that does.
 */
function appendCacheBuster(url: string, stamp: string | null | undefined): string {
  if (!stamp) return url;
  if (url.includes("?")) return url;
  const v = Date.parse(stamp);
  if (!Number.isFinite(v)) return url;
  return `${url}?v=${v}`;
}

export function mapApprovedRows(rows: ApprovedVendorRow[]): Vendor[] {
  const out: Vendor[] = [];
  for (const r of rows) {
    try {
      if (r && r.id && r.business_name) out.push(mapApprovedRowToVendor(r));
    } catch {
      /* skip a malformed row — never break the catalog */
    }
  }
  return out;
}
