"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Loader2,
  Save,
  Eye,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  Camera,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";
import {
  // R102 — TEMPLATE_LABELS no longer rendered (chooser removed),
  // but `LandingTemplate` type is still used by the persisted
  // `template` state + save payload for forward compat.
  type LandingTemplate,
  type VendorLandingData,
} from "@/lib/types";
import { getVendorPhotoUrl, sanitizeFilename } from "@/lib/vendorStudio";

/**
 * R124 — Sanitize Instagram / Facebook handles.
 * Accepts:
 *   • bare handle: "yourstudio"
 *   • leading @: "@yourstudio"
 *   • full URL: "https://instagram.com/yourstudio/" / "facebook.com/yourstudio"
 * Returns the bare handle (no leading @, no URL, no trailing slash).
 * Empty input → empty string.
 */
function sanitizeSocialHandle(input: string): string {
  if (!input) return "";
  let v = input.trim();
  // Strip URL prefix
  v = v.replace(
    /^https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com)\//i,
    "",
  );
  // Strip query string + trailing slash
  v = v.split("?")[0].split("#")[0].replace(/\/+$/, "");
  // Strip leading @
  v = v.replace(/^@+/, "");
  return v;
}

/**
 * R20 Phase 9 — Vendor Studio editor.
 *
 * Auth: any signed-in user can have ONE landing row (owner_user_id =
 * auth.uid()). The editor finds it via that constraint, or creates an
 * empty one on first save. The static catalog in lib/vendors.ts is
 * intentionally untouched — vendors entering the studio bring their own
 * data.
 */
export default function VendorStudioEditor() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorLandingData | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tagline, setTagline] = useState("");
  const [aboutLong, setAboutLong] = useState("");
  const [template, setTemplate] = useState<LandingTemplate>("luxurious");
  const [serviceAreas, setServiceAreas] = useState("");
  const [languages, setLanguages] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [heroPhotoPath, setHeroPhotoPath] = useState<string | null>(null);
  const [galleryPaths, setGalleryPaths] = useState<string[]>([]);
  const [published, setPublished] = useState(false);
  // True when the Supabase env vars aren't set. Surfaced as a banner so
  // vendors stop wondering why "load" succeeded with empty fields.
  const [supabaseMissing, setSupabaseMissing] = useState(false);
  // R124 — snapshot of the form state at last successful load/save.
  // We diff `currentSnapshot` against this to compute `isDirty` — used
  // to (a) show an "unsaved changes" indicator next to Save, (b) warn
  // via beforeunload if the vendor closes the tab, (c) gate the
  // "open public page" link so the vendor doesn't preview a stale DB
  // row and think the editor's broken.
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [yearsError, setYearsError] = useState<string | null>(null);

  const loadVendor = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setSupabaseMissing(true);
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/signup?returnTo=/dashboard/vendor-studio");
      return;
    }
    const { data } = (await supabase
      .from("vendor_landings")
      .select("*")
      .eq("owner_user_id", user.id)
      .maybeSingle()) as { data: VendorLandingData | null };

    if (data) {
      setVendor(data);
      setName(data.name ?? "");
      setCategory(data.category ?? "");
      setCity(data.city ?? "");
      setPhone(data.phone ?? "");
      setEmail(data.email ?? "");
      setWebsite(data.website ?? "");
      setInstagram(data.instagram ?? "");
      setFacebook(data.facebook ?? "");
      setTagline(data.tagline ?? "");
      setAboutLong(data.about_long ?? "");
      setTemplate(data.landing_template);
      setServiceAreas((data.service_areas ?? []).join(", "));
      setLanguages((data.languages ?? []).join(", "));
      setYearsExperience(data.years_experience?.toString() ?? "");
      setHeroPhotoPath(data.hero_photo_path);
      setGalleryPaths(data.gallery_paths ?? []);
      setPublished(data.landing_published);
      // R124 — anchor the saved-snapshot to what we just loaded so
      // isDirty starts at false. The snapshot keys mirror the field
      // setters exactly; any drift = dirty.
      setSavedSnapshot(
        JSON.stringify({
          name: data.name ?? "",
          category: data.category ?? "",
          city: data.city ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          website: data.website ?? "",
          instagram: data.instagram ?? "",
          facebook: data.facebook ?? "",
          tagline: data.tagline ?? "",
          aboutLong: data.about_long ?? "",
          template: data.landing_template,
          serviceAreas: (data.service_areas ?? []).join(", "),
          languages: (data.languages ?? []).join(", "),
          yearsExperience: data.years_experience?.toString() ?? "",
          heroPhotoPath: data.hero_photo_path,
          galleryPaths: data.gallery_paths ?? [],
          published: data.landing_published,
        }),
      );
    }
    setLoading(false);
  }, [router]);

  // R124 — current form state, serialized, so isDirty is a stable string
  // comparison instead of 17 separate value checks.
  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        name,
        category,
        city,
        phone,
        email,
        website,
        instagram,
        facebook,
        tagline,
        aboutLong,
        template,
        serviceAreas,
        languages,
        yearsExperience,
        heroPhotoPath,
        galleryPaths,
        published,
      }),
    [
      name,
      category,
      city,
      phone,
      email,
      website,
      instagram,
      facebook,
      tagline,
      aboutLong,
      template,
      serviceAreas,
      languages,
      yearsExperience,
      heroPhotoPath,
      galleryPaths,
      published,
    ],
  );
  const isDirty = !!savedSnapshot && currentSnapshot !== savedSnapshot;

  // R124 — warn before tab close / refresh if there are unsaved edits.
  // Doesn't intercept Next.js client-side navigation (App Router has
  // no router events) — for that, the "unsaved" badge by the Save
  // button is the user-visible cue.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the message string and show their own.
      // Returning a value (legacy API) keeps the dialog firing on
      // older browsers.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    // Documented "load on mount" pattern — same as the dashboard / report
    // / diagnose pages elsewhere in this project.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadVendor();
  }, [loadVendor]);

  const handlePhotoUpload = async (file: File, isHero: boolean) => {
    // R11 P1 #6 — hard cap at 5MB and reject anything not a real raster
    // image. SVG can carry inline scripts; HTML pretending to be an image
    // never wins. The MIME check happens BEFORE the size check so the
    // error message is more specific.
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/.test(file.type)) {
      showToast("רק קבצי JPG, PNG, WEBP, או GIF", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("התמונה גדולה מ-5MB. צמצם ונסה שוב.", "error");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      showToast("Supabase לא מוגדר", "error");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const stamp = Date.now();
    // Hebrew filenames + spaces would otherwise produce broken public URLs
    // (the read URL doesn't always percent-encode, and Supabase rejects
    // some non-ASCII paths outright).
    const path = `${user.id}/${stamp}-${sanitizeFilename(file.name)}`;
    const { error } = await supabase.storage
      .from("vendor-studio")
      .upload(path, file);
    if (error) {
      const raw = error.message ?? "";
      let userError = raw;
      if (/duplicate|already exists/i.test(raw)) {
        userError = "כבר קיים קובץ בשם הזה. נסה שוב.";
      } else if (/payload too large|413/i.test(raw)) {
        userError = "הקובץ גדול מדי.";
      } else if (/permission|policy|rls/i.test(raw)) {
        userError = "אין הרשאה להעלאה. וודא שאתה מחובר.";
      }
      showToast(userError, "error");
      return;
    }

    if (isHero) {
      setHeroPhotoPath(path);
    } else {
      setGalleryPaths((prev) => [...prev, path]);
    }
    showToast("תמונה הועלתה", "success");
  };

  const handleSave = async () => {
    // R11 P0 #3 — guard against rapid double-clicks. `saving` flips off
    // only in the error branches and at the end of the happy path, so the
    // window for a second INSERT (when vendor is still null) closes here.
    // The DB-level unique constraint (2026-05-13-vendor-fixes.sql) is the
    // belt; this is the suspenders.
    if (saving) return;
    if (!name.trim()) {
      showToast("חסר שם עסק", "error");
      return;
    }
    setSaving(true);

    const supabase = getSupabase();
    if (!supabase) {
      showToast("Supabase לא מוגדר", "error");
      setSaving(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast("נדרשת התחברות", "error");
      setSaving(false);
      return;
    }

    const trimmed = {
      name: name.trim(),
      category: category.trim() || null,
      city: city.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      website: website.trim() || null,
      instagram: instagram.trim() || null,
      facebook: facebook.trim() || null,
      tagline: tagline.trim() || null,
      about_long: aboutLong.trim() || null,
      landing_template: template,
      service_areas: serviceAreas
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      languages: languages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      // R12 §3Q — parseInt returns NaN for "abc" which Postgres rejects
       // with a confusing error. Clamp to 0–80 (anyone claiming "150 years
       // in the industry" is either lying or made a typo).
      years_experience: (() => {
        if (!yearsExperience.trim()) return null;
        const n = parseInt(yearsExperience, 10);
        if (!Number.isFinite(n)) return null;
        return Math.max(0, Math.min(80, n));
      })(),
      hero_photo_path: heroPhotoPath,
      gallery_paths: galleryPaths,
      landing_published: published,
      landing_updated_at: new Date().toISOString(),
    };

    let slug = vendor?.slug ?? null;
    if (!slug) {
      const { data: slugData, error: slugErr } = (await supabase.rpc(
        "generate_vendor_slug",
        { p_name: trimmed.name, p_landing_id: vendor?.id ?? null },
      )) as { data: string | null; error: { message: string } | null };
      if (slugErr || !slugData) {
        // RPC missing / migration not run. Fall back to a client-generated
        // slug so the page stays reachable. The DB-side `slug unique`
        // constraint will still catch the rare collision and the user gets
        // a clear error toast below.
        if (slugErr) {
          console.error("[vendor-studio] slug rpc failed", slugErr);
        }
        const base = trimmed.name
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[^a-z0-9א-ת]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 50);
        // R12 §3T — random suffix instead of Date.now (which is predictable
        // and lets an attacker guess upcoming slugs to squat on them).
        slug = `${base || "vendor"}-${crypto.randomUUID().slice(0, 6)}`;
      } else {
        slug = slugData;
      }
    }

    // Single helper so the friendly mapping is identical for both branches.
    const mapSaveError = (raw: string): string => {
      if (/duplicate|unique/i.test(raw)) {
        return "כבר קיים דף עם פרטים זהים. רענן וערוך מחדש.";
      }
      if (/does not exist|relation .* does not exist/i.test(raw)) {
        return "טבלת דפי הספקים לא קיימת. הרץ את 2026-05-12-vendor-studio.sql ב-Supabase.";
      }
      if (/permission|policy|rls/i.test(raw)) {
        return "אין הרשאה לשמירה. וודא שאתה מחובר.";
      }
      if (/network|fetch|failed to/i.test(raw)) {
        return "אין חיבור לאינטרנט. נסה שוב.";
      }
      return raw || "השמירה נכשלה";
    };

    if (vendor) {
      const { error } = await supabase
        .from("vendor_landings")
        .update({ ...trimmed, slug } as unknown as never)
        .eq("id", vendor.id);
      if (error) {
        showToast(mapSaveError(error.message ?? ""), "error");
        setSaving(false);
        return;
      }
      setVendor({ ...vendor, ...trimmed, slug } as VendorLandingData);
    } else {
      const { data: inserted, error } = (await supabase
        .from("vendor_landings")
        .insert({
          ...trimmed,
          slug,
          owner_user_id: user.id,
        } as unknown as never)
        .select("*")
        .single()) as {
        data: VendorLandingData | null;
        error: { message: string } | null;
      };
      if (error || !inserted) {
        showToast(mapSaveError(error?.message ?? ""), "error");
        setSaving(false);
        return;
      }
      setVendor(inserted);
    }

    // R124 — pin the new "saved" snapshot to the current form state so
    // isDirty flips back to false. Without this, beforeunload would
    // still nag the vendor right after a successful save.
    setSavedSnapshot(currentSnapshot);
    showToast("השינויים נשמרו בהצלחה! התעדכן בקטלוג תוך מספר שניות.", "success");
    // R84-4 — kick the server-rendered routes (/vendor/[slug] +
    // /vendors via its RSC layer) so the new logo / name / tagline
    // surface immediately. router.refresh re-runs server queries
    // without losing client state.
    router.refresh();
    setSaving(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[--accent]" size={32} aria-hidden />
      </main>
    );
  }

  const previewUrl = vendor?.slug ? `/vendor/${vendor.slug}` : null;

  return (
    <main className="min-h-screen pb-20 px-5">
      <div className="max-w-3xl mx-auto pt-6">
        <Link
          href="/"
          className="text-sm inline-flex items-center gap-2"
          style={{ color: "var(--foreground-soft)" }}
        >
          <ArrowRight size={14} aria-hidden /> חזרה
        </Link>

        <div className="mt-6 text-center">
          <Sparkles size={32} className="mx-auto text-[--accent]" aria-hidden />
          <h1 className="mt-4 text-3xl font-extrabold gradient-gold">
            Vendor Studio
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--foreground-soft)" }}>
            עיצוב דף הנחיתה המקצועי שלך — מאונדקס במנועי חיפוש לאחר זחילה
          </p>
        </div>

        {supabaseMissing && (
          <div
            className="mt-6 card p-4 flex items-start gap-3"
            style={{
              background: "rgba(248,113,113,0.08)",
              borderColor: "rgba(248,113,113,0.35)",
            }}
          >
            <AlertCircle
              size={18}
              className="shrink-0 mt-0.5 text-red-400"
              aria-hidden
            />
            <div className="text-sm">
              <div className="font-bold text-red-300">Supabase לא מוגדר</div>
              <div
                className="mt-1 text-xs"
                style={{ color: "var(--foreground-soft)" }}
              >
                הוסף את <code>NEXT_PUBLIC_SUPABASE_URL</code> ו-
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> ב-
                <code>.env.local</code> ואז הפעל מחדש את ה-dev server.
                בלעדיהם הטופס לא יישמר.
              </div>
            </div>
          </div>
        )}

        {previewUrl && vendor && (
          <div className="mt-6 card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                הדף שלך
              </div>
              <div className="font-mono text-sm ltr-num truncate">{previewUrl}</div>
              {!vendor.landing_published && (
                <div
                  className="text-[10px] mt-1 inline-flex items-center gap-1"
                  style={{ color: "rgb(251,191,36)" }}
                >
                  ⚠ עדיין לא פורסם — תצוגה מקדימה זמינה רק לך
                </div>
              )}
              {/* R124 — preview links read the DB row, not the in-memory
                  edits. Tell the vendor so they don't think the preview
                  is broken when their typed-but-unsaved tagline doesn't
                  show. The hint disappears once they save. */}
              {isDirty && (
                <div
                  className="text-[10px] mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--accent)" }}
                >
                  💡 התצוגה המקדימה מציגה את הגרסה השמורה — שמור כדי לראות את השינויים החדשים.
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {/* Owner-preview route works on unpublished drafts. The public
                  URL only resolves once landing_published is true. */}
              <a
                href={`/vendor/${vendor.slug}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl px-4 py-2 text-sm inline-flex items-center gap-2"
                style={{
                  background: "var(--input-bg)",
                  border: "1px solid var(--border-strong)",
                  opacity: isDirty ? 0.7 : 1,
                }}
                title={
                  isDirty
                    ? "הדף מציג את הגרסה השמורה — שמור כדי לראות את השינויים שלך"
                    : undefined
                }
              >
                <Eye size={14} aria-hidden /> תצוגה מקדימה
              </a>
              {vendor.landing_published && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold text-sm inline-flex items-center gap-2 px-4 py-2"
                  style={{ opacity: isDirty ? 0.7 : 1 }}
                  title={
                    isDirty
                      ? "הדף הציבורי מציג את הגרסה השמורה"
                      : undefined
                  }
                >
                  פתח את הדף הציבורי
                </a>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Identity */}
          <section className="card p-5 grid gap-4">
            <h2 className="font-bold">פרטי העסק</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <label>
                <span
                  className="text-xs block mb-1.5"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  שם העסק *
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  maxLength={80}
                />
              </label>
              <label>
                <span
                  className="text-xs block mb-1.5"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  קטגוריה
                </span>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input"
                  placeholder="צילום, DJ, קייטרינג..."
                />
              </label>
              <label>
                <span
                  className="text-xs block mb-1.5"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  עיר
                </span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="input"
                />
              </label>
              <label>
                <span
                  className="text-xs block mb-1.5"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  טלפון
                </span>
                <input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input text-start ltr-num"
                />
              </label>
              <label>
                <span
                  className="text-xs block mb-1.5"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  מייל
                </span>
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input text-start"
                />
              </label>
              <label>
                <span
                  className="text-xs block mb-1.5"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  אתר
                </span>
                <input
                  dir="ltr"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="input text-start"
                  placeholder="https://..."
                />
              </label>
              <label>
                <span
                  className="text-xs block mb-1.5"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  Instagram (handle)
                </span>
                <input
                  dir="ltr"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  onBlur={() => setInstagram((v) => sanitizeSocialHandle(v))}
                  className="input text-start"
                  placeholder="yourstudio"
                />
              </label>
              <label>
                <span
                  className="text-xs block mb-1.5"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  Facebook (page slug)
                </span>
                <input
                  dir="ltr"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  onBlur={() => setFacebook((v) => sanitizeSocialHandle(v))}
                  className="input text-start"
                />
              </label>
            </div>
          </section>

          {/* R102 — template chooser removed. The three options
              (Modern / Luxurious / Rustic) all delegated to the
              same LuxuriousTemplate, so the choice was cosmetic
              UI with no effect. The `template` state still exists
              + still saves to `landing_template` for forward
              compat (if we ever ship distinct templates), but the
              vendor doesn't pick it. */}

          {/* Hero / Profile photo — R117 surfaces this as the "face of
              the business" that appears as a gold-bordered avatar on
              every vendor's catalog tile. Same field, clearer copy. */}
          <section
            className="card p-5"
            style={{ borderColor: "var(--border-gold)" }}
          >
            <div className="flex items-start gap-3 mb-1">
              <div
                className="w-10 h-10 rounded-2xl inline-flex items-center justify-center shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(244,222,169,0.18), rgba(168,136,74,0.05))",
                  border: "1px solid var(--border-gold)",
                  color: "var(--accent)",
                }}
              >
                <Camera size={18} aria-hidden />
              </div>
              <div>
                <h2 className="font-bold leading-tight">
                  תמונת פרופיל / לוגו
                </h2>
                <p
                  className="text-xs mt-0.5 leading-relaxed"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  הפנים של העסק שלך בקטלוג של Momentum. הזוגות יראו את התמונה
                  הזו כאוואטר זהוב על הכרטיס שלך — לוגו, צילום של מוצר מוכר, או
                  כל תמונה מייצגת אחרת.
                </p>
              </div>
            </div>

            {heroPhotoPath ? (
              <div className="mt-4 flex items-center gap-4">
                {/* Live preview at the actual avatar size + gradient ring
                    so the vendor sees exactly what the catalog will show. */}
                <div
                  className="rounded-full p-[2.5px] shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--gold-100), var(--gold-500) 60%, var(--gold-100))",
                    width: 96,
                    height: 96,
                  }}
                >
                  <div
                    className="w-full h-full rounded-full overflow-hidden"
                    style={{ background: "var(--background)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getVendorPhotoUrl(heroPhotoPath)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div
                    className="text-xs"
                    style={{ color: "var(--foreground-soft)" }}
                  >
                    👀 ככה הזוגות יראו אותך בקטלוג.
                  </div>
                  <div className="flex gap-2">
                    <label
                      className="action-btn primary cursor-pointer text-xs"
                      style={{ minHeight: 40 }}
                    >
                      <Camera size={13} aria-hidden />
                      החלף תמונה
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handlePhotoUpload(f, true);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setHeroPhotoPath(null)}
                      className="action-btn text-xs"
                      style={{ minHeight: 40 }}
                    >
                      הסר
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label
                className="mt-4 flex items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition hover:bg-white/[0.02]"
                style={{ borderColor: "var(--border-gold)" }}
              >
                <Camera size={22} className="text-[--accent]" aria-hidden />
                <span className="text-sm font-semibold">
                  לחץ להעלאת תמונת פרופיל / לוגו
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handlePhotoUpload(f, true);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            <div
              className="text-[11px] mt-2 leading-relaxed"
              style={{ color: "var(--foreground-muted)" }}
            >
              💡 הכי טוב: תמונה מרובעת ברזולוציה גבוהה (לפחות 512×512), JPG /
              PNG / WEBP, עד 5MB.
            </div>
          </section>

          {/* Text */}
          <section className="card p-5 grid gap-4">
            <label>
              <span
                className="text-xs block mb-1.5"
                style={{ color: "var(--foreground-soft)" }}
              >
                Tagline (משפט קצר)
              </span>
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                maxLength={120}
                className="input"
                placeholder="למשל: יוצרים את הרגעים שאתם תזכרו לכל החיים"
              />
            </label>
            <label>
              <span
                className="text-xs block mb-1.5"
                style={{ color: "var(--foreground-soft)" }}
              >
                אודות מפורט
              </span>
              <textarea
                value={aboutLong}
                onChange={(e) => setAboutLong(e.target.value)}
                rows={6}
                maxLength={2000}
                className="input"
                placeholder="ספר על העסק שלך, הניסיון, הסגנון, איך אתה עובד..."
              />
              <div
                className="text-xs text-end mt-1 ltr-num"
                style={{ color: "var(--foreground-muted)" }}
              >
                {aboutLong.length}/2000
              </div>
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label>
                <span
                  className="text-xs block mb-1.5"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  איזורי שירות (מופרד בפסיקים)
                </span>
                <input
                  value={serviceAreas}
                  onChange={(e) => setServiceAreas(e.target.value)}
                  className="input"
                  placeholder="תל אביב, מרכז, השרון"
                />
              </label>
              <label>
                <span
                  className="text-xs block mb-1.5"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  שפות
                </span>
                <input
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  className="input"
                  placeholder="עברית, אנגלית, רוסית"
                />
              </label>
            </div>
            <label>
              <span
                className="text-xs block mb-1.5"
                style={{ color: "var(--foreground-soft)" }}
              >
                שנות ניסיון
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={80}
                value={yearsExperience}
                onChange={(e) => {
                  const v = e.target.value;
                  setYearsExperience(v);
                  // R124 — show inline feedback when the input can't
                  // be parsed as a year count; otherwise it silently
                  // saves as null and the vendor wonders why their
                  // experience didn't stick.
                  if (!v.trim()) {
                    setYearsError(null);
                  } else if (!/^\d+$/.test(v.trim())) {
                    setYearsError("מספר שלם בלבד");
                  } else {
                    const n = Number(v);
                    if (n < 0 || n > 80) setYearsError("0 עד 80");
                    else setYearsError(null);
                  }
                }}
                className="input ltr-num"
                aria-invalid={!!yearsError}
                aria-describedby={yearsError ? "years-err" : undefined}
              />
              {yearsError && (
                <span
                  id="years-err"
                  className="text-[11px] mt-1 block"
                  style={{ color: "rgb(252,165,165)" }}
                >
                  {yearsError}
                </span>
              )}
            </label>
          </section>

          {/* Gallery */}
          <section className="card p-5">
            <h2 className="font-bold mb-3">
              גלריה (<span className="ltr-num">{galleryPaths.length}</span> תמונות)
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
              {galleryPaths.map((p, i) => (
                <div key={p} className="relative aspect-square rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getVendorPhotoUrl(p)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setGalleryPaths(galleryPaths.filter((_, j) => j !== i))
                    }
                    className="absolute top-1 end-1 p-1.5 rounded-full bg-black/60 text-white text-xs"
                    aria-label="הסר תמונה"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <label
              className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed cursor-pointer hover:bg-white/5"
              style={{ borderColor: "var(--border)" }}
            >
              <ImageIcon size={20} className="text-[--accent]" aria-hidden />
              <span className="text-sm">הוסף תמונה לגלריה</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhotoUpload(f, false);
                  e.target.value = "";
                }}
              />
            </label>
          </section>

          {/* Publish + Save */}
          <section className="card-gold p-5">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-bold">פרסום הדף</div>
                <div
                  className="text-xs mt-1"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  הדף יופיע ב-Google ובחיפוש האפליקציה
                </div>
              </div>
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="w-5 h-5"
                style={{ accentColor: "var(--accent)" }}
              />
            </label>

            {/* R124 — unsaved-changes indicator. The vendor sees a
                clear "יש שינויים שלא נשמרו" badge next to the Save
                button the moment any field diverges from the saved
                snapshot. Pairs with the beforeunload guard. */}
            {isDirty && (
              <div
                className="mt-5 mb-2 inline-flex items-center gap-2 text-xs rounded-full px-3 py-1.5"
                style={{
                  background: "rgba(212,176,104,0.10)",
                  border: "1px solid var(--border-gold)",
                  color: "var(--accent)",
                }}
                role="status"
                aria-live="polite"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--accent)" }}
                  aria-hidden
                />
                יש שינויים שלא נשמרו
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="btn-gold w-full mt-3 inline-flex items-center justify-center gap-2 py-4 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={18} aria-hidden />
              ) : (
                <>
                  <Save size={18} aria-hidden />
                  {isDirty ? "שמור שינויים" : "נשמר ✓"}
                </>
              )}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
