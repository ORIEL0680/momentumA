import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSms } from "@/lib/twilioClient";
import { rateLimit } from "@/lib/serverRateLimit";

/**
 * POST /api/chat/send  (R43)
 * Body: { leadId, body, senderRole: 'couple' | 'vendor' }
 *
 * Auth: Bearer <supabase access token>. The INSERT runs through the
 * user's own client, so the migration's RLS "parties send messages"
 * policy is the real authorization (we can't forge a role we aren't).
 *
 * SMS (F1) is best-effort:
 *   - vendor → couple: the vendor can read the lead (RLS) → couple_phone.
 *   - couple → vendor: the vendor's phone lives in vendor_landings,
 *     which RLS does NOT expose to the couple. Notifying the vendor by
 *     SMS would need a SECURITY DEFINER RPC (= another manual migration);
 *     deferred — the realtime in-app feed + header badge is the
 *     reliable notification. Documented in TASKLIST.R43.
 *
 * AI summary/tags are computed by a separate fire-and-forget call the
 * client makes to /api/ai/chat-assist after a successful send.
 */
interface Body {
  leadId?: string;
  body?: string;
  senderRole?: "couple" | "vendor";
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const token = auth.slice(7);

    const body = (await req.json().catch(() => ({}))) as Body;
    const leadId = (body.leadId ?? "").trim();
    const text = (body.body ?? "").trim();
    const senderRole = body.senderRole;
    if (!leadId || !text) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    if (text.length > 2000) {
      return NextResponse.json({ error: "message too long" }, { status: 400 });
    }
    if (senderRole !== "couple" && senderRole !== "vendor") {
      return NextResponse.json({ error: "bad role" }, { status: 400 });
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

    // Defense-in-depth on top of the DB rate-limit trigger (20/lead/hr).
    if (!rateLimit("chat-send", `${user.id}:${leadId}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const { data: inserted, error } = await supabase
      .from("vendor_chat_messages")
      .insert({
        lead_id: leadId,
        sender_role: senderRole,
        sender_user_id: user.id,
        body: text,
      })
      .select("*")
      .single();

    if (error || !inserted) {
      // RLS rejection (not a party to this lead) lands here too.
      console.error("[chat/send] insert failed", error?.message);
      return NextResponse.json({ error: "send_failed" }, { status: 403 });
    }

    // Best-effort SMS to the couple when the vendor replies (RLS lets
    // the vendor read the lead → couple_phone). Never blocks the send.
    if (senderRole === "vendor") {
      try {
        const { data: lead } = await supabase
          .from("vendor_leads")
          .select("couple_phone, couple_name")
          .eq("id", leadId)
          .maybeSingle();
        const phone = (lead as { couple_phone?: string } | null)?.couple_phone;
        if (phone) {
          await sendSms({
            to: phone,
            body: `📩 הספק ענה לך ב-Momentum: "${text.slice(0, 60)}${
              text.length > 60 ? "…" : ""
            }" — פתחו את האפליקציה כדי להמשיך.`,
          });
        }
      } catch (e) {
        console.error("[chat/send] sms best-effort failed", e);
      }
    }

    return NextResponse.json({ ok: true, message: inserted });
  } catch (e) {
    console.error("[chat/send]", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
