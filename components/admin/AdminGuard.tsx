"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

/**
 * R59 (R49) — client admin gate.
 *
 * NOTE: this is UX, not the security boundary. The real enforcement is
 * server-side in every /api/admin/* route (requireAdmin → admin_emails
 * under RLS → service role). We can't gate in middleware / a server
 * component because this app keeps the Supabase session in localStorage,
 * not cookies — so SSR has no session to read. Same reason the existing
 * /admin/dashboard is client-gated.
 *
 * Non-admins are redirected to /dashboard with NO hint that an admin
 * area exists; signed-out users go to /signup?returnTo=.
 */

const AdminTokenContext = createContext<string | null>(null);

/** Access token for calling /api/admin/* — only valid inside AdminGuard. */
export function useAdminToken(): string {
  const t = useContext(AdminTokenContext);
  if (!t) throw new Error("useAdminToken must be used within <AdminGuard>");
  return t;
}

type Phase = "loading" | "ok";

export function AdminGuard({
  children,
  returnTo = "/admin",
}: {
  children: ReactNode;
  returnTo?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Hard timeout so a stuck getUser() can't spin forever.
    const timeout = window.setTimeout(() => {
      if (!cancelled) router.replace("/dashboard");
    }, 10000);

    void (async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) {
          router.replace("/dashboard");
          return;
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user?.email) {
          router.replace(`/signup?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }
        const email = user.email.toLowerCase().trim();
        const { data: adminRow } = (await supabase
          .from("admin_emails")
          .select("email")
          .eq("email", email)
          .maybeSingle()) as { data: { email: string } | null };
        if (cancelled) return;
        if (!adminRow) {
          // Silent — never reveal that an admin area exists.
          console.warn("[admin-guard] non-admin attempted access");
          router.replace("/dashboard");
          return;
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session?.access_token) {
          router.replace(`/signup?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }
        setToken(session.access_token);
        setPhase("ok");
      } catch {
        if (!cancelled) router.replace("/dashboard");
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [router, returnTo]);

  if (phase === "loading" || !token) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2
          className="animate-spin"
          size={30}
          style={{ color: "var(--accent)" }}
          aria-label="טוען"
        />
      </main>
    );
  }

  return (
    <AdminTokenContext.Provider value={token}>
      {children}
    </AdminTokenContext.Provider>
  );
}
