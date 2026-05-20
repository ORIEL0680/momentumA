"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/Toast";
import {
  APPOINTMENT_TEMPLATES,
  CATEGORY_COLORS,
} from "@/lib/calendar/appointment-templates";
import type { AppointmentCategory } from "@/lib/calendar/wedding-brain";
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  updateChecklist,
  type Appointment,
} from "@/lib/calendar/appointments";
import { formatHebrewDate } from "@/lib/calendar/hebrew-calendar";
import {
  newChecklistItemId,
  type ChecklistItem,
} from "@/lib/calendar/checklist-templates";

/**
 * R69 (R58) — appointment create/edit modal — premium redesign.
 *
 * Visual overhaul on top of R67/R68 logic (kept verbatim):
 *   • Premium header — eyebrow + gradient title + Hebrew-date subtitle.
 *   • Template chips with horizontal scroll (replaces <select>).
 *   • Larger inputs with .input class, time row + quick-duration chips
 *     [15min / 30min / שעה / שעתיים] that snap the end time.
 *   • 32×32 color dots with a soft ring + scale on the selected one.
 *   • Save-state animation: idle → saving → ✓ saved (600ms) → close.
 *   • Delete button moved to a discrete top-end slot in edit mode.
 *   • Stagger fade-in on the form sections (existing .stagger utility,
 *     prefers-reduced-motion guard already lives in globals.css).
 *
 * All R67 behaviour (template auto-fill, validation, save/delete,
 * day-balance hint, RTL inputs) and R68 (checklist with debounced
 * auto-save) is preserved — only the chrome changes.
 */

const COLOR_SWATCHES: Array<{ id: string; label: string; value: string }> = [
  { id: "gold", label: "זהב", value: "#D4B068" },
  { id: "rose", label: "ורד", value: "#E8889B" },
  { id: "emerald", label: "ירוק", value: "#9BE8B0" },
  { id: "purple", label: "סגול", value: "#C29BE8" },
  { id: "teal", label: "תכלת", value: "#9BC8E8" },
  { id: "warm", label: "כתום", value: "#FFB05E" },
];

const QUICK_DURATIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 15, label: "15ד׳" },
  { minutes: 30, label: "30ד׳" },
  { minutes: 60, label: "שעה" },
  { minutes: 120, label: "שעתיים" },
];

const TIME_PATTERN = /^\d{2}:\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoLocalTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function combine(dateStr: string, timeStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  if (!TIME_PATTERN.test(timeStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const out = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(out.getTime()) ? null : out;
}

function durationMinutes(startStr: string, endStr: string): number | null {
  if (!TIME_PATTERN.test(startStr) || !TIME_PATTERN.test(endStr)) return null;
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export interface AppointmentSheetProps {
  /** Editing an existing row, or null/undefined for create. */
  editing?: Appointment | null;
  /** When creating: pre-fill the date (default = today). */
  initialDate?: Date;
  /**
   * R68 — for the smart-day-balance hint. Returns the count of OTHER
   * appointments already scheduled on a given local-iso day (YYYY-MM-DD),
   * excluding the row currently being edited. Optional — when omitted,
   * the hint just never shows.
   */
  appointmentsOnDay?: (iso: string) => number;
  onClose: () => void;
  onSaved: (a: Appointment) => void;
  onDeleted?: (id: string) => void;
}

export function AppointmentSheet({
  editing,
  initialDate,
  appointmentsOnDay,
  onClose,
  onSaved,
  onDeleted,
}: AppointmentSheetProps) {
  const startInit = editing
    ? new Date(editing.start_at)
    : initialDate ?? new Date();
  const endInit = editing
    ? new Date(editing.end_at)
    : (() => {
        const e = new Date(startInit);
        e.setMinutes(e.getMinutes() + 60);
        return e;
      })();

  const [templateId, setTemplateId] = useState<string>("");
  const [title, setTitle] = useState<string>(editing?.title ?? "");
  const [category, setCategory] = useState<AppointmentCategory>(
    editing?.category ?? "other",
  );
  const [dateStr, setDateStr] = useState<string>(isoLocalDate(startInit));
  const [startStr, setStartStr] = useState<string>(isoLocalTime(startInit));
  const [endStr, setEndStr] = useState<string>(isoLocalTime(endInit));
  const [location, setLocation] = useState<string>(editing?.location ?? "");
  const [description, setDescription] = useState<string>(
    editing?.description ?? "",
  );
  const [color, setColor] = useState<string>(
    editing?.color ?? CATEGORY_COLORS[editing?.category ?? "other"],
  );
  const [busy, setBusy] = useState(false);
  // R69 — terminal "saved" pulse before closing. Decoupled from `busy`
  // so the spinner can fall away and a check can fade in.
  const [savedFlash, setSavedFlash] = useState(false);

  // R68 — local checklist state (only meaningful when editing an
  // existing row; the create path seeds the checklist on save).
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    editing?.checklist ?? [],
  );
  const [checklistDirty, setChecklistDirty] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newBring, setNewBring] = useState("");

  // Apply a template: fills title/category/duration/color, leaves date.
  const applyTemplate = (tplId: string) => {
    setTemplateId(tplId);
    const tpl = APPOINTMENT_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    if (tpl.id === "custom") {
      setTitle("");
      setCategory("other");
      return;
    }
    setTitle(tpl.title);
    setCategory(tpl.category);
    setColor(CATEGORY_COLORS[tpl.category]);
    const start = combine(dateStr, startStr);
    if (start) {
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + tpl.duration);
      setEndStr(isoLocalTime(end));
    }
  };

  // Snap the end time to a fixed duration from start. Used by the quick
  // duration chips below the time row.
  const applyDuration = (minutes: number) => {
    const start = combine(dateStr, startStr);
    if (!start) return;
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + minutes);
    setEndStr(isoLocalTime(end));
  };

  const hebDate = useMemo(() => {
    const d = combine(dateStr, "00:00");
    return d ? formatHebrewDate(d) : "";
  }, [dateStr]);

  const currentDuration = durationMinutes(startStr, endStr);

  const canSave =
    !busy &&
    !savedFlash &&
    title.trim().length > 0 &&
    TIME_PATTERN.test(startStr) &&
    TIME_PATTERN.test(endStr) &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

  const handleSave = async () => {
    if (!canSave) return;
    const start = combine(dateStr, startStr);
    const end = combine(dateStr, endStr);
    if (!start || !end) {
      showToast("תאריך או שעה לא תקינים", "error");
      return;
    }
    if (end.getTime() <= start.getTime()) {
      showToast("שעת סיום חייבת להיות אחרי שעת ההתחלה", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title,
        description: description.trim() || null,
        start_at: start,
        end_at: end,
        location: location.trim() || null,
        color,
        category,
      };
      const saved = editing
        ? await updateAppointment(editing.id, payload)
        : await createAppointment(payload);
      if (!saved) {
        showToast("שמירה נכשלה. נסו שוב.", "error");
        setBusy(false);
        return;
      }
      showToast(editing ? "הפגישה עודכנה" : "הפגישה נשמרה", "success");
      onSaved(saved);
      // Saved → flash the check for 600ms, then close. The setTimeout
      // owns the state transition, so it's an async callback (no lint
      // trip on set-state-in-effect).
      setBusy(false);
      setSavedFlash(true);
      setTimeout(() => {
        onClose();
      }, 600);
    } catch {
      showToast("שמירה נכשלה. נסו שוב.", "error");
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || busy) return;
    if (typeof window !== "undefined" && !window.confirm("למחוק את הפגישה?")) {
      return;
    }
    setBusy(true);
    const ok = await deleteAppointment(editing.id);
    if (!ok) {
      showToast("מחיקה נכשלה", "error");
      setBusy(false);
      return;
    }
    showToast("הפגישה נמחקה", "success");
    onDeleted?.(editing.id);
    onClose();
  };

  // R68 — debounced checklist auto-save. Only fires after the user
  // actually toggles/adds (checklistDirty). setState inside setTimeout
  // is async, so the set-state-in-effect lint rule doesn't apply.
  useEffect(() => {
    if (!editing || !checklistDirty) return;
    const t = setTimeout(() => {
      updateChecklist(editing.id, checklistItems).then((saved) => {
        if (saved) onSaved(saved);
        setChecklistDirty(false);
      });
    }, 500);
    return () => clearTimeout(t);
  }, [editing, checklistItems, checklistDirty, onSaved]);

  const toggleChecklistItem = (id: string) => {
    setChecklistItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it)),
    );
    setChecklistDirty(true);
  };

  const removeChecklistItem = (id: string) => {
    setChecklistItems((prev) => prev.filter((it) => it.id !== id));
    setChecklistDirty(true);
  };

  const addChecklistItem = (type: ChecklistItem["type"]) => {
    const label = type === "question" ? newQuestion.trim() : newBring.trim();
    if (!label) return;
    setChecklistItems((prev) => [
      ...prev,
      { id: newChecklistItemId(type), label, checked: false, type },
    ]);
    if (type === "question") setNewQuestion("");
    else setNewBring("");
    setChecklistDirty(true);
  };

  // R68 (Part 7) — smart day-balance hint. Inline notice when ≥ 3 other
  // appointments fall on the same day.
  const otherSameDayCount = appointmentsOnDay
    ? appointmentsOnDay(dateStr)
    : 0;

  const questionItems = checklistItems.filter((i) => i.type === "question");
  const bringItems = checklistItems.filter((i) => i.type === "bring");
  const checkedCount = checklistItems.filter((i) => i.checked).length;

  // Premium header. The Modal wraps `title` in an <h3 id="modal-title">,
  // so we feed it plain divs (avoid nested headings) and lean on the
  // wrapper for accessibility labelling.
  const headerDateLine = (() => {
    const d = combine(dateStr, "00:00");
    return d
      ? d.toLocaleDateString("he-IL", {
          day: "numeric",
          month: "long",
          weekday: "long",
        })
      : "";
  })();
  const headerNode = (
    <span className="min-w-0 block">
      <span
        className="eyebrow"
        style={{ display: "inline-flex" }}
      >
        {editing ? "עריכת פגישה" : "פגישה חדשה"}
      </span>
      <span
        className="block mt-1.5 text-2xl md:text-[1.75rem] font-bold gradient-text leading-tight"
      >
        {editing ? title.trim() || "ללא שם" : "מה נוסיף ללוח?"}
      </span>
      {hebDate && (
        <span
          className="block mt-1 text-xs font-normal"
          style={{ color: "var(--foreground-muted)" }}
        >
          <span className="ltr-num">{headerDateLine}</span>
          {" · "}
          <span>{hebDate}</span>
        </span>
      )}
    </span>
  );

  return (
    <Modal onClose={onClose} title={headerNode} maxWidthClass="max-w-xl">
      {/* Edit-mode discrete delete chip — top-end, divider below. */}
      {editing && (
        <div className="flex justify-end -mt-2 mb-1">
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy || savedFlash}
            aria-label="מחק פגישה"
            className="inline-flex items-center gap-1.5 text-xs py-1.5 px-2.5 rounded-full transition disabled:opacity-40"
            style={{
              color: "rgb(239,120,120)",
              border: "1px solid color-mix(in srgb, rgb(239,120,120) 35%, transparent)",
              background: "color-mix(in srgb, rgb(239,120,120) 8%, transparent)",
            }}
          >
            <Trash2 size={12} aria-hidden /> מחק
          </button>
        </div>
      )}

      <div
        className="stagger space-y-4 pt-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {/* Template chips — horizontal scroll, only in create mode. */}
        {!editing && (
          <div className="pt-3">
            <span
              className="block text-xs font-semibold mb-2 uppercase tracking-wider"
              style={{ color: "var(--foreground-muted)" }}
            >
              תבנית מהירה
            </span>
            <div
              className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
              style={{ scrollbarWidth: "thin" }}
              role="radiogroup"
              aria-label="בחירת תבנית"
            >
              {APPOINTMENT_TEMPLATES.map((t) => {
                const selected = templateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => applyTemplate(t.id)}
                    className="shrink-0 inline-flex items-center gap-1.5 text-sm py-1.5 px-3 rounded-full transition"
                    style={{
                      border: selected
                        ? "1.5px solid var(--accent)"
                        : "1px solid var(--border)",
                      background: selected
                        ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                        : "var(--input-bg)",
                      color: selected
                        ? "var(--accent)"
                        : "var(--foreground-soft)",
                      fontWeight: selected ? 600 : 500,
                    }}
                  >
                    <span aria-hidden>{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Title — single most-important field, slightly larger. */}
        <div>
          <label
            htmlFor="appt-title"
            className="block text-sm mb-1.5 font-medium"
            style={{ color: "var(--foreground-soft)" }}
          >
            כותרת <span style={{ color: "var(--accent)" }}>*</span>
          </label>
          <input
            id="appt-title"
            type="text"
            className="input w-full"
            style={{ fontSize: "1rem", padding: "0.7rem 0.95rem" }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="לדוגמה: טעימה באולם"
            autoFocus
          />
        </div>

        {/* Date + time row. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="appt-date"
              className="block text-sm mb-1.5 font-medium"
              style={{ color: "var(--foreground-soft)" }}
            >
              📅 תאריך
            </label>
            <input
              id="appt-date"
              type="date"
              dir="ltr"
              className="input w-full text-start"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>
          <div>
            <span
              className="block text-sm mb-1.5 font-medium"
              style={{ color: "var(--foreground-soft)" }}
            >
              ⏰ שעה
            </span>
            <div className="flex items-center gap-2">
              <input
                aria-label="שעת התחלה"
                type="time"
                dir="ltr"
                step={900}
                className="input flex-1 text-start"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
              />
              <span style={{ color: "var(--foreground-muted)" }}>—</span>
              <input
                aria-label="שעת סיום"
                type="time"
                dir="ltr"
                step={900}
                className="input flex-1 text-start"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Quick-duration chips — snap end time to a fixed window. */}
        <div className="flex flex-wrap gap-2">
          {QUICK_DURATIONS.map((q) => {
            const matches = currentDuration === q.minutes;
            return (
              <button
                key={q.minutes}
                type="button"
                onClick={() => applyDuration(q.minutes)}
                aria-pressed={matches}
                className="text-xs py-1 px-2.5 rounded-full transition"
                style={{
                  border: matches
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border)",
                  background: matches
                    ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                    : "transparent",
                  color: matches
                    ? "var(--accent)"
                    : "var(--foreground-muted)",
                  fontWeight: matches ? 600 : 500,
                }}
              >
                {q.label}
              </button>
            );
          })}
        </div>

        {/* R68 (Part 7) — smart day-balance hint. */}
        {otherSameDayCount >= 3 && (
          <div
            className="text-sm rounded-xl px-3 py-2.5"
            style={{
              background: "color-mix(in srgb, #fb923c 10%, transparent)",
              border: "1px solid color-mix(in srgb, #fb923c 35%, transparent)",
              color: "var(--foreground-soft)",
            }}
          >
            💡 כבר יש <span className="ltr-num">{otherSameDayCount}</span>{" "}
            פגישות באותו יום. שיקלו לפזר על 2 ימים כדי לא להעמיס.
          </div>
        )}

        {/* Location. */}
        <div>
          <label
            htmlFor="appt-location"
            className="block text-sm mb-1.5 font-medium"
            style={{ color: "var(--foreground-soft)" }}
          >
            📍 מיקום
          </label>
          <input
            id="appt-location"
            type="text"
            className="input w-full"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="אופציונלי"
          />
        </div>

        {/* Description. */}
        <div>
          <label
            htmlFor="appt-desc"
            className="block text-sm mb-1.5 font-medium"
            style={{ color: "var(--foreground-soft)" }}
          >
            📝 הערות
          </label>
          <textarea
            id="appt-desc"
            className="input w-full"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="אופציונלי"
          />
        </div>

        {/* Color swatches — 32×32 with ring + scale on selected. */}
        <div>
          <span
            className="block text-sm mb-2 font-medium"
            style={{ color: "var(--foreground-soft)" }}
          >
            🎨 צבע
          </span>
          <div className="flex flex-wrap gap-2.5">
            {COLOR_SWATCHES.map((s) => {
              const selected = color === s.value;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setColor(s.value)}
                  aria-label={`צבע ${s.label}`}
                  aria-pressed={selected}
                  className="w-8 h-8 rounded-full transition"
                  style={{
                    background: s.value,
                    transform: selected ? "scale(1.12)" : "scale(1)",
                    boxShadow: selected
                      ? "0 0 0 2px var(--background), 0 0 0 4px var(--accent)"
                      : "0 0 0 1px var(--border)",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* R68 (Part 1) — checklist (only when editing). */}
        {editing && checklistItems.length > 0 && (
          <div
            className="rounded-xl p-3.5"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold">צ׳קליסט לפגישה</span>
              <span
                className="text-xs ltr-num"
                style={{ color: "var(--foreground-muted)" }}
              >
                {checkedCount}/{checklistItems.length}
                {checklistDirty ? " · שומר…" : ""}
              </span>
            </div>

            <ChecklistGroup
              title="📝 שאלות לשאול"
              items={questionItems}
              onToggle={toggleChecklistItem}
              onRemove={removeChecklistItem}
              newInput={newQuestion}
              setNewInput={setNewQuestion}
              onAdd={() => addChecklistItem("question")}
              placeholder="שאלה נוספת…"
            />
            <div className="mt-4">
              <ChecklistGroup
                title="📦 מה להביא"
                items={bringItems}
                onToggle={toggleChecklistItem}
                onRemove={removeChecklistItem}
                newInput={newBring}
                setNewInput={setNewBring}
                onAdd={() => addChecklistItem("bring")}
                placeholder="פריט נוסף…"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action bar — sticky-feel divider, save button is the primary
          attention. Outside .stagger so it stays put. */}
      <div
        className="flex items-center gap-2 pt-4 mt-5"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary text-sm py-2 px-4"
          disabled={busy || savedFlash}
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="btn-gold inline-flex items-center justify-center gap-2 ms-auto disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            padding: "0.7rem 1.4rem",
            minWidth: "140px",
            transition: "background 200ms ease",
          }}
          aria-live="polite"
        >
          {savedFlash ? (
            <>
              <Check size={16} aria-hidden /> נשמר
            </>
          ) : busy ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden /> שומר…
            </>
          ) : (
            <>שמירה</>
          )}
        </button>
      </div>
    </Modal>
  );
}

/** Single checklist group (questions OR bring). Internal to the Sheet. */
function ChecklistGroup({
  title,
  items,
  onToggle,
  onRemove,
  newInput,
  setNewInput,
  onAdd,
  placeholder,
}: {
  title: string;
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  newInput: string;
  setNewInput: (s: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <div>
      <div
        className="text-xs font-semibold mb-2"
        style={{ color: "var(--foreground-soft)" }}
      >
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 group">
            <input
              id={`chk-${it.id}`}
              type="checkbox"
              checked={it.checked}
              onChange={() => onToggle(it.id)}
              className="w-4 h-4 shrink-0"
              style={{ accentColor: "var(--accent)" }}
            />
            <label
              htmlFor={`chk-${it.id}`}
              className="flex-1 text-sm cursor-pointer leading-snug"
              style={{
                color: it.checked
                  ? "var(--foreground-muted)"
                  : "var(--foreground-soft)",
                textDecoration: it.checked ? "line-through" : "none",
              }}
            >
              {it.label}
            </label>
            <button
              type="button"
              onClick={() => onRemove(it.id)}
              aria-label="הסר פריט"
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0"
              style={{ color: "var(--foreground-muted)" }}
            >
              <X size={13} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 mt-2.5">
        <input
          type="text"
          value={newInput}
          onChange={(e) => setNewInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
          className="input flex-1 !py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!newInput.trim()}
          aria-label="הוסף שורה"
          className="w-9 h-9 rounded-full inline-flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            border: "1px solid var(--border-gold)",
            color: "var(--accent)",
          }}
        >
          <Plus size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
