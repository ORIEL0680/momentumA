"use client";

/**
 * R121 — /gifts: credit-card gifts paid via the app.
 *
 * Sibling page to /balance. /balance tracks cash envelopes (manual data
 * entry, post-event). /gifts tracks online gifts (PSP-driven, auto-
 * arriving as guests pay through the invitation link).
 *
 * Until a real payment-service-provider (Stripe / Tranzila / Pelecard) is
 * wired in, the data model is local — store action `addGiftPayment` is
 * called either manually from this page (the "+ הוסף תשלום" button) or by
 * a future webhook route. Either way, downstream readers (this page) see
 * the same shape.
 *
 * The card layout deliberately mirrors /balance so a host who already
 * knows the cash flow understands the credit-card flow at a glance.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CreditCard,
  Heart,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Header } from "@/components/Header";
import { EmptyEventState } from "@/components/EmptyEventState";
import { EmptyState } from "@/components/EmptyState";
import { PrintButton } from "@/components/PrintButton";
import { BalanceSkeleton } from "@/components/skeletons/PageSkeletons";
import { useAppState, actions } from "@/lib/store";
import { useUser } from "@/lib/user";
import { useVendorRedirect } from "@/lib/useVendorRedirect";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import type { GiftPayment } from "@/lib/types";

export default function GiftsPage() {
  const router = useRouter();
  const { state, hydrated } = useAppState();
  const { user, hydrated: userHydrated } = useUser();
  // R114 — vendors don't track wedding gifts.
  useVendorRedirect();

  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (userHydrated && !user) {
      router.replace("/signup");
    }
  }, [userHydrated, user, router]);

  // Paid gifts only count toward the running total. Pending rows display
  // greyed out so the host can see what's mid-flight but doesn't double-
  // count refunds or stalled charges.
  // useMemo so the `??[]` fallback doesn't mint a fresh array reference
  // on every render — the downstream filtered/totals memos see a stable
  // input and only re-run when giftPayments actually changes.
  const gifts = useMemo(
    () => state.giftPayments ?? [],
    [state.giftPayments],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = s
      ? gifts.filter(
          (g) =>
            g.guestName.toLowerCase().includes(s) ||
            (g.message ?? "").toLowerCase().includes(s),
        )
      : gifts;
    // Newest first — the host wants to see what just came in.
    return [...list].sort(
      (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
    );
  }, [gifts, search]);

  const totals = useMemo(() => {
    const paid = gifts.filter((g) => g.status === "paid");
    const pending = gifts.filter((g) => g.status === "pending");
    const totalPaid = paid.reduce((s, g) => s + g.amount, 0);
    const totalPending = pending.reduce((s, g) => s + g.amount, 0);
    const avg = paid.length > 0 ? Math.round(totalPaid / paid.length) : 0;
    return {
      totalPaid,
      totalPending,
      paidCount: paid.length,
      pendingCount: pending.length,
      avg,
    };
  }, [gifts]);

  if (!hydrated) {
    return (
      <>
        <Header />
        <BalanceSkeleton />
      </>
    );
  }
  if (!state.event) return <EmptyEventState toolName="המתנות" />;

  const dateFmt = new Date(state.event.date).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Header />
      <main className="flex-1 relative">
        <div
          aria-hidden
          className="glow-orb glow-orb-gold w-[600px] h-[600px] -top-40 left-0 opacity-30"
        />

        <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 relative z-10">
          <Link
            href="/dashboard"
            className="text-sm hover:text-white inline-flex items-center gap-1.5"
            style={{ color: "var(--foreground-muted)" }}
          >
            <ArrowRight size={14} /> חזרה למסע
          </Link>

          <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">מתנות באשראי</span>
              <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight gradient-text">
                המתנות שלך
              </h1>
              <p
                className="mt-2 max-w-xl"
                style={{ color: "var(--foreground-soft)" }}
              >
                כל המתנות שאורחים שילמו לכם באשראי דרך האפליקציה — עם הברכה
                שכל אחד מהם רשם.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="text-sm rounded-full px-4 inline-flex items-center gap-1.5 font-semibold transition"
                style={{
                  background:
                    "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                  color: "var(--gold-button-text)",
                  minHeight: 40,
                }}
              >
                <Plus size={14} /> הוסף תשלום ידנית
              </button>
              <PrintButton label="ייצא ל-PDF" />
            </div>
          </div>

          <SummaryPanel
            totalPaid={totals.totalPaid}
            totalPending={totals.totalPending}
            paidCount={totals.paidCount}
            pendingCount={totals.pendingCount}
            avg={totals.avg}
            eventLabel={EVENT_TYPE_LABELS[state.event.type]}
            dateFmt={dateFmt}
          />

          {gifts.length === 0 ? (
            <EmptyState
              icon={<CreditCard size={28} aria-hidden />}
              title="עדיין לא התקבלה אף מתנה"
              description="ברגע שאורח ישלם מתנה באשראי דרך לינק ההזמנה, הוא יופיע כאן עם הברכה שלו. תוכלו גם להוסיף תשלום ידנית בכפתור למעלה."
              cta={{ label: "חזרה לדשבורד", href: "/dashboard" }}
              emphasis
            />
          ) : (
            <>
              <div className="card p-4 mt-8 flex items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search
                    size={16}
                    className="absolute end-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--foreground-muted)" }}
                  />
                  <input
                    className="input pe-10 !py-2.5 text-sm"
                    placeholder="חפש לפי שם אורח או טקסט ברכה..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {filtered.map((g) => (
                  <GiftCard key={g.id} gift={g} />
                ))}
                {filtered.length === 0 && (
                  <div
                    className="card p-8 text-center"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    אין תוצאות לחיפוש.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {showAdd && (
          <AddGiftModal
            onClose={() => setShowAdd(false)}
            guestSuggestions={state.guests
              .filter((g) => g.status === "confirmed")
              .map((g) => ({ id: g.id, name: g.name }))}
          />
        )}
      </main>
    </>
  );
}

function SummaryPanel({
  totalPaid,
  totalPending,
  paidCount,
  pendingCount,
  avg,
  eventLabel,
  dateFmt,
}: {
  totalPaid: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  avg: number;
  eventLabel: string;
  dateFmt: string;
}) {
  return (
    <section className="card-gold p-7 md:p-8 mt-8 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-20 -end-20 w-72 h-72 rounded-full bg-[radial-gradient(circle,rgba(212,176,104,0.16),transparent_70%)] blur-2xl"
      />

      <div className="relative">
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="pill pill-gold">
            <Sparkles size={11} /> {eventLabel}
          </span>
          <span
            className="text-xs"
            style={{ color: "var(--foreground-muted)" }}
          >
            {dateFmt}
          </span>
        </div>

        <div>
          <div
            className="text-xs uppercase tracking-wider"
            style={{ color: "var(--foreground-muted)" }}
          >
            סה״כ באשראי
          </div>
          <div className="text-5xl md:text-7xl font-extrabold tracking-tight gradient-gold ltr-num mt-2">
            ₪{totalPaid.toLocaleString("he-IL")}
          </div>
          {totalPending > 0 && (
            <div
              className="text-sm mt-2"
              style={{ color: "var(--foreground-soft)" }}
            >
              עוד <span className="ltr-num font-semibold">₪{totalPending.toLocaleString("he-IL")}</span> בתהליך אישור
            </div>
          )}
        </div>

        <div
          className="mt-6 pt-5 border-t grid grid-cols-2 sm:grid-cols-3 gap-4"
          style={{ borderColor: "var(--border)" }}
        >
          <Stat
            label="תשלומים שאושרו"
            value={`${paidCount}`}
            sub={pendingCount > 0 ? `+${pendingCount} בתהליך` : undefined}
          />
          <Stat
            label="ממוצע למתנה"
            value={avg > 0 ? `₪${avg.toLocaleString("he-IL")}` : "—"}
            sub="לפי תשלומים שאושרו"
          />
          <Stat
            label="עמלת סליקה"
            value={totalPaid > 0 ? `~₪${Math.round(totalPaid * 0.025).toLocaleString("he-IL")}` : "—"}
            sub="2.5% הערכה"
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
        {label}
      </div>
      <div className="font-bold text-lg ltr-num mt-1">{value}</div>
      {sub && (
        <div
          className="text-xs mt-0.5 ltr-num"
          style={{ color: "var(--foreground-muted)" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function GiftCard({ gift }: { gift: GiftPayment }) {
  const dim = gift.status !== "paid";
  const dateFmt = new Date(gift.paidAt).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeFmt = new Date(gift.paidAt).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <article
      className="card p-5 relative transition"
      style={{ opacity: dim ? 0.55 : 1 }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background:
                "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
              color: "var(--gold-button-text)",
            }}
          >
            <Heart size={20} fill="currentColor" strokeWidth={0} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-lg truncate">{gift.guestName}</div>
            <div
              className="text-xs mt-0.5 ltr-num"
              style={{ color: "var(--foreground-muted)" }}
            >
              {dateFmt} · {timeFmt}
              {gift.cardLast4 && (
                <>
                  {" · "}
                  כרטיס מסתיים ב-{gift.cardLast4}
                </>
              )}
              {gift.status === "pending" && " · בהמתנה לאישור"}
              {gift.status === "refunded" && " · הוחזר"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-end">
            <div
              className="text-xs"
              style={{ color: "var(--foreground-muted)" }}
            >
              סכום
            </div>
            <div className="text-2xl font-extrabold ltr-num gradient-gold">
              ₪{gift.amount.toLocaleString("he-IL")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm(`למחוק את התשלום של ${gift.guestName}?`)) {
                actions.removeGiftPayment(gift.id);
              }
            }}
            aria-label="הסר תשלום"
            className="p-2 rounded-lg hover:bg-white/5"
            style={{ color: "rgb(248,113,113)" }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {gift.message ? (
        <div
          className="mt-4 rounded-2xl p-4 flex items-start gap-2.5"
          style={{
            background: "rgba(212,176,104,0.06)",
            border: "1px solid var(--border-gold)",
          }}
        >
          <MessageSquare
            size={15}
            className="text-[--accent] mt-0.5 shrink-0"
          />
          <p
            className="text-sm leading-relaxed whitespace-pre-line"
            style={{ color: "var(--foreground-soft)" }}
          >
            {gift.message}
          </p>
        </div>
      ) : (
        <div
          className="mt-4 text-xs"
          style={{ color: "var(--foreground-muted)" }}
        >
          לא נשלחה ברכה עם התשלום הזה
        </div>
      )}
    </article>
  );
}

function AddGiftModal({
  onClose,
  guestSuggestions,
}: {
  onClose: () => void;
  guestSuggestions: Array<{ id: string; name: string }>;
}) {
  const [guestId, setGuestId] = useState<string>("");
  const [guestName, setGuestName] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [cardLast4, setCardLast4] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!guestName.trim() || !Number.isFinite(num) || num <= 0) return;
    actions.addGiftPayment({
      guestId: guestId || undefined,
      guestName: guestName.trim(),
      amount: num,
      message: message.trim() || undefined,
      cardLast4: cardLast4.trim() || undefined,
    });
    onClose();
  };

  // When the host picks an existing guest, fill the name automatically.
  const selectGuest = (id: string) => {
    setGuestId(id);
    const match = guestSuggestions.find((g) => g.id === id);
    if (match) setGuestName(match.name);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md flex flex-col max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="font-bold text-lg">הוספת תשלום ידנית</h2>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="p-1.5 rounded-lg hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submit} className="p-5 space-y-4">
          {guestSuggestions.length > 0 && (
            <label className="block">
              <span
                className="text-xs"
                style={{ color: "var(--foreground-soft)" }}
              >
                אורח קיים (אופציונלי)
              </span>
              <select
                value={guestId}
                onChange={(e) => selectGuest(e.target.value)}
                className="input mt-1.5 w-full"
              >
                <option value="">— בחר אורח מהרשימה —</option>
                {guestSuggestions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span
              className="text-xs"
              style={{ color: "var(--foreground-soft)" }}
            >
              שם האורח*
            </span>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="input mt-1.5 w-full"
              placeholder="לדוגמה: דניאל ושירה כהן"
              required
            />
          </label>

          <label className="block">
            <span
              className="text-xs"
              style={{ color: "var(--foreground-soft)" }}
            >
              סכום (₪)*
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input mt-1.5 w-full ltr-num"
              placeholder="500"
              required
            />
          </label>

          <label className="block">
            <span
              className="text-xs"
              style={{ color: "var(--foreground-soft)" }}
            >
              4 ספרות אחרונות של הכרטיס
            </span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={cardLast4}
              onChange={(e) =>
                setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="input mt-1.5 w-full ltr-num"
              placeholder="4242"
            />
          </label>

          <label className="block">
            <span
              className="text-xs"
              style={{ color: "var(--foreground-soft)" }}
            >
              ברכה
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              className="input mt-1.5 w-full min-h-[100px] resize-y"
              placeholder="מאחלים לכם המון אושר, אהבה ובריאות..."
              rows={4}
            />
            <span
              className="text-[10px] mt-1 block ltr-num"
              style={{ color: "var(--foreground-muted)" }}
            >
              {message.length}/500
            </span>
          </label>

          <div
            className="flex items-center gap-2 pt-3 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              type="submit"
              className="flex-1 rounded-full px-5 py-3 text-sm font-bold transition"
              style={{
                background:
                  "linear-gradient(135deg, var(--gold-100), var(--gold-500))",
                color: "var(--gold-button-text)",
              }}
            >
              שמור תשלום
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-3 text-sm font-semibold"
              style={{
                border: "1px solid var(--border)",
                color: "var(--foreground-soft)",
              }}
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
