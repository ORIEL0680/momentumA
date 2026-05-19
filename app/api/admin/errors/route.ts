import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";

/**
 * R59 (R49) — recent error log (admin only, service-role read).
 *
 *   GET /api/admin/errors            → latest 100
 *   GET /api/admin/errors?type=auth  → filtered by type
 *
 * If the error_logs table hasn't been migrated yet we return an empty
 * list + `table_missing:true` so the page can show a friendly hint
 * instead of a 500.
 */

interface ErrorRow {
  id: string;
  type: string;
  message: string;
  stack: string | null;
  user_id: string | null;
  url: string | null;
  user_agent: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;
    const admin = gate.adminClient;

    const type = req.nextUrl.searchParams.get("type");
    let query = admin
      .from("error_logs")
      .select("id, type, message, stack, user_id, url, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (type && ["auth", "db", "api", "unknown"].includes(type)) {
      query = query.eq("type", type);
    }

    const { data, error } = (await query) as {
      data: ErrorRow[] | null;
      error: { message: string; code?: string } | null;
    };

    if (error) {
      // 42P01 = undefined_table (migration not run yet).
      const tableMissing =
        error.code === "42P01" || /relation .* does not exist/i.test(error.message);
      if (tableMissing) {
        return NextResponse.json({ errors: [], table_missing: true });
      }
      console.error("[/api/admin/errors]", error.message);
      return NextResponse.json({ error: "שגיאה בטעינה" }, { status: 500 });
    }

    // Frequency: how many times each distinct message appears in the window.
    const freq = new Map<string, number>();
    for (const r of data ?? []) {
      freq.set(r.message, (freq.get(r.message) ?? 0) + 1);
    }
    const errors = (data ?? []).map((r) => ({
      ...r,
      frequency: freq.get(r.message) ?? 1,
    }));

    return NextResponse.json({ errors, table_missing: false });
  } catch (e) {
    console.error("[/api/admin/errors]", e);
    return NextResponse.json(
      { error: "שגיאה פנימית. בדוק את הלוגים בשרת." },
      { status: 500 },
    );
  }
}
