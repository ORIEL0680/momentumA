import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/server";

/**
 * R59 (R49) — admin users list / single profile.
 *
 * There is no `user_profiles` table; users come from the Supabase Auth
 * admin API. We join each user to their `app_states` row (if any) to
 * surface event title / guest count — adapted to the JSON-blob model.
 *
 *   GET /api/admin/users          → list (id,email,created,last_sign_in,event)
 *   GET /api/admin/users?id=<uuid> → single + parsed event summary
 */

interface AuthUser {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
}
interface UsersPage {
  users: AuthUser[];
}

async function listAllUsers(admin: SupabaseClient): Promise<AuthUser[]> {
  const out: AuthUser[] = [];
  let page = 1;
  while (page < 50) {
    const { data, error } = (await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    })) as { data: UsersPage | null; error: { message: string } | null };
    if (error || !data) break;
    out.push(...data.users);
    if (data.users.length < 1000) break;
    page += 1;
  }
  return out;
}

interface StatePayload {
  event?: {
    type?: unknown;
    hostName?: unknown;
    partnerName?: unknown;
    date?: unknown;
  } | null;
  guests?: unknown;
}

function eventTitle(p: StatePayload | null): string | null {
  const ev = p?.event;
  if (!ev) return null;
  const host = typeof ev.hostName === "string" ? ev.hostName.trim() : "";
  const partner =
    typeof ev.partnerName === "string" ? ev.partnerName.trim() : "";
  if (!host) return null;
  return partner ? `${host} & ${partner}` : host;
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;
    const admin = gate.adminClient;

    const id = req.nextUrl.searchParams.get("id");

    if (id) {
      const { data, error } = (await admin.auth.admin.getUserById(id)) as {
        data: { user: AuthUser | null } | null;
        error: { message: string } | null;
      };
      if (error || !data?.user) {
        return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
      }
      const { data: stateRow } = (await admin
        .from("app_states")
        .select("payload, updated_at")
        .eq("user_id", id)
        .maybeSingle()) as {
        data: { payload: unknown; updated_at: string } | null;
      };
      const payload = (stateRow?.payload ?? null) as StatePayload | null;
      const guests = Array.isArray(payload?.guests)
        ? (payload!.guests as unknown[]).length
        : 0;
      return NextResponse.json({
        user: {
          id: data.user.id,
          email: data.user.email ?? null,
          created_at: data.user.created_at ?? null,
          last_sign_in_at: data.user.last_sign_in_at ?? null,
        },
        event: {
          title: eventTitle(payload),
          type:
            payload?.event && typeof payload.event.type === "string"
              ? payload.event.type
              : null,
          date:
            payload?.event && typeof payload.event.date === "string"
              ? payload.event.date
              : null,
          guests,
          last_sync: stateRow?.updated_at ?? null,
        },
      });
    }

    const [users, statesRes] = await Promise.all([
      listAllUsers(admin),
      admin.from("app_states").select("user_id, payload, updated_at") as unknown as Promise<{
        data: { user_id: string; payload: unknown; updated_at: string }[] | null;
      }>,
    ]);
    const stateByUser = new Map(
      (statesRes.data ?? []).map((r) => [r.user_id, r]),
    );

    const list = users
      .map((u) => {
        const st = stateByUser.get(u.id);
        return {
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          event_title: eventTitle(
            (st?.payload ?? null) as StatePayload | null,
          ),
        };
      })
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });

    return NextResponse.json({ users: list, total: list.length });
  } catch (e) {
    console.error("[/api/admin/users]", e);
    return NextResponse.json(
      { error: "שגיאה פנימית. בדוק את הלוגים בשרת." },
      { status: 500 },
    );
  }
}
