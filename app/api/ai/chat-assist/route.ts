import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/serverRateLimit";

/**
 * POST /api/ai/chat-assist  (R43 E1)
 * Body: { messageId }
 *
 * Fire-and-forget enrichment the client triggers once after a send.
 * Computes a short summary + tags + urgency for the message and writes
 * them back. Fully fail-soft: no OpenAI key / any error → 200 skipped
 * (the chat works fine without AI). Spam-tagged messages are
 * auto-marked read so they don't nag the recipient.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!supabaseUrl || !anonKey || !apiKey) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const token = auth.slice(7);
    const { messageId } = (await req.json().catch(() => ({}))) as {
      messageId?: string;
    };
    if (!messageId) {
      return NextResponse.json({ error: "missing messageId" }, { status: 400 });
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
    if (!rateLimit("ai-chat-assist", user.id, 50, 24 * 60 * 60 * 1000)) {
      return NextResponse.json({ ok: true, skipped: true, quota: true });
    }

    // RLS scopes this select to a lead the user is a party to.
    const { data: msg } = await supabase
      .from("vendor_chat_messages")
      .select("id, body")
      .eq("id", messageId)
      .maybeSingle();
    const text = (msg as { body?: string } | null)?.body;
    if (!text) return NextResponse.json({ ok: true, skipped: true });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              'אתה עוזר שמתמצת הודעות בין זוג לספק אירועים. החזר אך ורק JSON: {"summary":"תקציר עד 15 מילים בעברית","tags":["עד 3 תגיות בעברית"],"urgency":1-5}. אם זו ספאם/פרסומת — הוסף את התגית "ספאם".',
          },
          { role: "user", content: text.slice(0, 1500) },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return NextResponse.json({ ok: true, skipped: true });
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    let parsed: { summary?: string; tags?: string[]; urgency?: number } = {};
    try {
      parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    } catch {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t) => typeof t === "string").slice(0, 3)
      : [];
    const isSpam = tags.some((t) => /ספאם|spam/i.test(t));

    await supabase
      .from("vendor_chat_messages")
      .update({
        ai_summary:
          typeof parsed.summary === "string"
            ? parsed.summary.slice(0, 200)
            : null,
        ai_tags: tags,
        ...(isSpam ? { is_read: true } : {}),
      })
      .eq("id", messageId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ai/chat-assist]", e);
    return NextResponse.json({ ok: true, skipped: true });
  }
}
