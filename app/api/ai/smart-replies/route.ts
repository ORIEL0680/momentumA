import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/serverRateLimit";

/**
 * POST /api/ai/smart-replies  (R43 E2)
 * Body: { leadId }
 *
 * Returns up to 3 short Hebrew reply suggestions for the vendor based
 * on the last few messages. Fail-soft: no key / error → { replies: [] }
 * (the inbox just hides the suggestion chips). The client caches the
 * result per last-message-id so we never re-ask for the same thread
 * state.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!supabaseUrl || !anonKey || !apiKey) {
      return NextResponse.json({ replies: [] });
    }
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const token = auth.slice(7);
    const { leadId } = (await req.json().catch(() => ({}))) as {
      leadId?: string;
    };
    if (!leadId) {
      return NextResponse.json({ error: "missing leadId" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!rateLimit("ai-smart-replies", user.id, 50, 24 * 60 * 60 * 1000)) {
      return NextResponse.json({ replies: [] });
    }

    // RLS scopes to a lead the vendor owns. Last 5, newest first.
    const { data: rows } = await supabase
      .from("vendor_chat_messages")
      .select("sender_role, body")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5);
    const msgs = ((rows ?? []) as { sender_role: string; body: string }[])
      .reverse();
    if (msgs.length === 0) return NextResponse.json({ replies: [] });
    const transcript = msgs
      .map((m) => `${m.sender_role === "couple" ? "זוג" : "ספק"}: ${m.body}`)
      .join("\n")
      .slice(0, 1800);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content:
              'אתה ספק שירותי אירועים שעונה לזוג. החזר אך ורק JSON: {"replies":["3 הצעות תשובה מקצועיות, קצרות (עד 25 מילים כל אחת), בעברית רהוטה, בטון חם ועסקי"]}.',
          },
          { role: "user", content: transcript },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return NextResponse.json({ replies: [] });
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    let replies: string[] = [];
    try {
      const parsed = JSON.parse(
        json.choices?.[0]?.message?.content ?? "{}",
      ) as { replies?: unknown };
      if (Array.isArray(parsed.replies)) {
        replies = parsed.replies
          .filter((r): r is string => typeof r === "string")
          .map((r) => r.slice(0, 200))
          .slice(0, 3);
      }
    } catch {
      replies = [];
    }
    return NextResponse.json({ replies });
  } catch (e) {
    console.error("[ai/smart-replies]", e);
    return NextResponse.json({ replies: [] });
  }
}
