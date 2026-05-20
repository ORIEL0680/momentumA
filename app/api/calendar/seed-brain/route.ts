import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateBrainSuggestions } from "@/lib/calendar/wedding-brain";
import { CATEGORY_COLORS } from "@/lib/calendar/appointment-templates";

/**
 * R67 (R56) — seed the Wedding Brain.
 *
 * POST /api/calendar/seed-brain
 *   body: { eventDate: ISO-8601 string }
 *
 * Creates one `appointments` row per future Wedding Brain suggestion
 * (source='ai_suggestion', ai_status='pending'). Idempotent: if the
 * user already has ANY ai_suggestion rows, returns `{ skipped: true }`
 * without inserting — the spec's gate of "user_profiles.calendar_seeded"
 * doesn't exist here, so we infer "already seeded" from row presence.
 *
 * Auth: caller passes their JWT as `Authorization: Bearer …`; the anon
 * client bound to that JWT inserts under the user's RLS scope, so the
 * `user_id = auth.uid()` policy auto-protects the writes.
 */

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 503 },
      );
    }

    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }
    const token = auth.slice(7);

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body = (await req.json().catch(() => null)) as {
      eventDate?: string;
    } | null;
    if (!body?.eventDate) {
      return NextResponse.json(
        { error: "eventDate required" },
        { status: 400 },
      );
    }
    const eventDate = new Date(body.eventDate);
    if (Number.isNaN(eventDate.getTime())) {
      return NextResponse.json(
        { error: "invalid eventDate" },
        { status: 400 },
      );
    }

    // Idempotency check — has this user been seeded before?
    const { count, error: countErr } = (await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("source", "ai_suggestion")) as {
      count: number | null;
      error: { message: string } | null;
    };
    if (countErr) {
      console.error("[seed-brain] count failed", countErr.message);
      return NextResponse.json({ error: "lookup failed" }, { status: 500 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json({ skipped: true, reason: "already-seeded" });
    }

    // Generate future-only suggestions and insert as a single batch.
    const generated = generateBrainSuggestions(eventDate, new Date());
    if (generated.length === 0) {
      return NextResponse.json({ inserted: 0, reason: "no-future-suggestions" });
    }
    const rows = generated.map((g) => ({
      user_id: user.id,
      title: g.suggestion.title,
      description: g.suggestion.description,
      start_at: g.startAt.toISOString(),
      end_at: g.endAt.toISOString(),
      category: g.suggestion.category,
      color: CATEGORY_COLORS[g.suggestion.category] ?? "#D4B068",
      source: "ai_suggestion" as const,
      ai_status: "pending" as const,
    }));

    const { data, error } = (await supabase
      .from("appointments")
      .insert(rows)
      .select("id")) as {
      data: { id: string }[] | null;
      error: { message: string } | null;
    };
    if (error) {
      console.error("[seed-brain] insert failed", error.message);
      return NextResponse.json({ error: "insert failed" }, { status: 500 });
    }

    return NextResponse.json({
      inserted: data?.length ?? 0,
      total_in_timeline: generated.length,
    });
  } catch (e) {
    console.error("[/api/calendar/seed-brain]", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}
