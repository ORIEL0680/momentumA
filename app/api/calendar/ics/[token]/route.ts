import "server-only";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * R68 (R57) — public iCal feed for Google / Apple Calendar subscription.
 *
 * The path token IS the auth — anyone holding the URL can read the
 * user's appointments. Rotating the token (via /api/calendar/sync-token
 * DELETE) revokes the subscription instantly.
 *
 * Output: RFC 5545 calendar feed (text/calendar; charset=utf-8) with
 * UTC times + escaped strings. Cached on the edge for 15 minutes so
 * Google's poller (every ~hour) doesn't hammer our DB.
 */

interface SyncRow {
  user_id: string;
  enabled: boolean;
}

interface AppointmentRow {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  location: string | null;
  category: string;
  updated_at: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** RFC 5545 BASIC-format UTC timestamp: 20260815T093000Z */
function formatICSDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}` +
    `${pad(d.getUTCMonth() + 1)}` +
    `${pad(d.getUTCDate())}` +
    "T" +
    `${pad(d.getUTCHours())}` +
    `${pad(d.getUTCMinutes())}` +
    `${pad(d.getUTCSeconds())}` +
    "Z"
  );
}

/** Escape per RFC 5545 §3.3.11: backslash, semicolon, comma, newline. */
function escapeICS(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Fold long lines per RFC 5545 §3.1 (75 octets max, continuation with space). */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    parts.push(i === 0 ? line.slice(i, i + 75) : " " + line.slice(i, i + 74));
    i += parts.length === 1 ? 75 : 74;
  }
  return parts.join("\r\n");
}

function buildICS(appointments: AppointmentRow[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Momentum//Wedding Calendar//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Momentum — לוח החתונה שלי",
    "X-WR-TIMEZONE:Asia/Jerusalem",
  ];

  for (const a of appointments) {
    const start = new Date(a.start_at);
    const end = new Date(a.end_at);
    const stamp = new Date(a.updated_at);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      Number.isNaN(stamp.getTime())
    ) {
      continue;
    }
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${a.id}@moomentum.events`));
    lines.push(`DTSTAMP:${formatICSDate(stamp)}`);
    lines.push(`DTSTART:${formatICSDate(start)}`);
    lines.push(`DTEND:${formatICSDate(end)}`);
    lines.push(foldLine(`SUMMARY:${escapeICS(a.title)}`));
    if (a.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeICS(a.description)}`));
    }
    if (a.location) {
      lines.push(foldLine(`LOCATION:${escapeICS(a.location)}`));
    }
    lines.push(
      foldLine(
        `URL:https://moomentum.events/calendar?appointment=${encodeURIComponent(a.id)}`,
      ),
    );
    lines.push(foldLine(`CATEGORIES:Momentum,${escapeICS(a.category)}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!token || token.length < 10) {
      return new NextResponse("Not found", { status: 404 });
    }

    let admin;
    try {
      admin = createServiceClient();
    } catch {
      return new NextResponse("Service unavailable", { status: 503 });
    }

    const { data: sync } = (await admin
      .from("calendar_sync_tokens")
      .select("user_id, enabled")
      .eq("token", token)
      .maybeSingle()) as { data: SyncRow | null };

    if (!sync || !sync.enabled) {
      // 404 (not 401) — don't reveal that the token *used to exist*.
      return new NextResponse("Not found", { status: 404 });
    }

    // Best-effort access timestamp — never block the response on it.
    void admin
      .from("calendar_sync_tokens")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("token", token);

    // 30 days back + everything forward keeps the calendar useful for
    // glance-at-history without ballooning the payload.
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const { data: appts } = (await admin
      .from("appointments")
      .select("id, title, description, start_at, end_at, location, category, updated_at")
      .eq("user_id", sync.user_id)
      .or("ai_status.is.null,ai_status.neq.dismissed")
      .gte("start_at", from.toISOString())
      .order("start_at", { ascending: true })) as {
      data: AppointmentRow[] | null;
    };

    const ics = buildICS(appts ?? []);

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        // 15 min — enough to spare DB hits when Google polls hourly
        // but short enough that a fresh edit appears within a quarter
        // hour on the calendar client.
        "Cache-Control": "private, max-age=900",
      },
    });
  } catch (e) {
    console.error("[/api/calendar/ics]", e);
    return new NextResponse("Server error", { status: 500 });
  }
}
