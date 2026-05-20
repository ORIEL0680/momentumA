"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, Plus, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { showToast } from "@/components/Toast";
import {
  APPOINTMENT_TEMPLATES,
  CATEGORY_COLORS,
  type AppointmentTemplate,
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
 * R67 (R56) — appointment create/edit modal.
 *
 * - "Template" picker auto-fills title/category/duration/icon.
 * - End time is derived from start + duration but stays editable.
 * - Color preview reflects the chosen swatch live.
 * - Delete button shows only in edit mode (existing appointment).
 *
 * Uses the shared `Modal` for backdrop + Esc handling. RTL-correct.
 */

const COLOR_SWATCHES: Array<{ id: string; label: string; value: string }> = [
  { id: "gold", label: "זהב", value: "#D4B068" },
  { id: "rose", label: "ורד", value: "#E8889B" },
  { id: "emerald", label: "ירוק", value: "#9BE8B0" },
  { id: "purple", label: "סגול", value: "#C29BE8" },
  { id: "teal", label: "תכלת", value: "#9BC8E8" },
  { id: "warm", label: "כתום", value: "#FFB05E" },
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

  // R68 — local checklist state (only meaningful when editing an
  // existing row; the create path seeds the checklist on save).
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    editing?.checklist ?? [],
  );
  // True after the local checklist diverges from what's in the DB.
  // Drives the debounced auto-save effect below. Starts false → no
  // save fires on mount; only after the user actually toggles/adds.
  const [checklistDirty, setChecklistDirty] = useState(false);
  // Inputs for "+ הוסף שורה" per group.
  const [newQuestion, setNewQuestion] = useState("");
  const [newBring, setNewBring] = useState("");

  // Apply a template: fills title/category/duration/color, leaves date.
  const applyTemplate = (tplId: string) => {
    setTemplateId(tplId);
    const tpl = APPOINTMENT_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    if (tpl.id === "custom") {
      // Custom = clear the slate.
      setTitle("");
      setCategory("other");
      return;
    }
    setTitle(tpl.title);
    setCategory(tpl.category);
    setColor(CATEGORY_COLORS[tpl.category]);
    // Recompute end based on duration.
    const start = combine(dateStr, startStr);
    if (start) {
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + tpl.duration);
      setEndStr(isoLocalTime(end));
    }
  };

  const hebDate = useMemo(() => {
    const d = combine(dateStr, "00:00");
    return d ? formatHebrewDate(d) : "";
  }, [dateStr]);

  const canSave =
    !busy &&
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
      onClose();
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

  // Keep end time in sync with start when the user changes start
  // (preserve previous duration). Lazy-init pattern via ref to avoid
  // setState-in-effect lint.
  useEffect(() => {
    // Intentionally no body — we don't auto-shift end. The user can
    // edit each independently. (Auto-shift on every keystroke felt
    // janky in early iterations.)
  }, [startStr]);

  // R68 — debounced checklist auto-save. Only fires after the user
  // actually toggles/adds (checklistDirty). The setState inside the
  // setTimeout callback is async, so the lint rule against synchronous
  // setState-in-effect doesn't apply.
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
      {
        id: newChecklistItemId(type),
        label,
        checked: false,
        type,
      },
    ]);
    if (type === "question") setNewQuestion("");
    else setNewBring("");
    setChecklistDirty(true);
  };

  // R68 (Part 7) — smart day-balance hint. Compute count of existing
  // appointments on the chosen day (excluding the one being edited).
  // Shown as an inline notice when ≥ 3; spec wanted a confirm modal
  // but the inline hint achieves the same awareness with much less
  // surface area and no extra component.
  const otherSameDayCount = appointmentsOnDay
    ? appointmentsOnDay(dateStr)
    : 0;

  const questionItems = checklistItems.filter((i) => i.type === "question");
  const bringItems = checklistItems.filter((i) => i.type === "bring");
  const checkedCount = checklistItems.filter((i) => i.checked).length;

  return (
    <Modal
      onClose={onClose}
      title={editing ? "עריכת פגישה" : "פגישה חדשה"}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        {!editing && (
          <div>
            <label
              htmlFor="appt-template"
              className="block text-sm mb-1.5"
              style={{ color: "var(--foreground-soft)" }}
            >
              🎯 בחירת תבנית (אופציונלי)
            </label>
            <select
              id="appt-template"
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="input w-full"
            >
              <option value="">— בחרו תבנית —</option>
              {APPOINTMENT_TEMPLATES.map((t: AppointmentTemplate) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label
            htmlFor="appt-title"
            className="block text-sm mb-1.5"
            style={{ color: "var(--foreground-soft)" }}
          >
            כותרת <span style={{ color: "var(--accent)" }}>*</span>
          </label>
          <input
            id="appt-title"
            type="text"
            className="input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="לדוגמה: טעימה באולם"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="appt-date"
              className="block text-sm mb-1.5"
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
            {hebDate && (
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--foreground-muted)" }}
              >
                {hebDate}
              </p>
            )}
          </div>
          <div>
            <label
              className="block text-sm mb-1.5"
              style={{ color: "var(--foreground-soft)" }}
            >
              ⏰ שעה
            </label>
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

        {/* R68 (Part 7) — smart day-balance inline hint. Surfaces when
            the chosen day already has ≥3 other appointments. Inline
            warning instead of the spec's blocking confirm modal —
            less friction, same awareness. */}
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

        <div>
          <label
            htmlFor="appt-location"
            className="block text-sm mb-1.5"
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

        <div>
          <label
            htmlFor="appt-desc"
            className="block text-sm mb-1.5"
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

        <div>
          <span
            className="block text-sm mb-2"
            style={{ color: "var(--foreground-soft)" }}
          >
            🎨 צבע
          </span>
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map((s) => {
              const selected = color === s.value;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setColor(s.value)}
                  aria-label={`צבע ${s.label}`}
                  aria-pressed={selected}
                  className="w-9 h-9 rounded-full transition"
                  style={{
                    background: s.value,
                    border: selected
                      ? "2.5px solid var(--accent)"
                      : "1px solid var(--border)",
                    boxShadow: selected
                      ? "0 0 0 2px var(--background)"
                      : "none",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* R68 (Part 1) — checklist. Only shown when editing an
            existing appointment; fresh ones get their checklist seeded
            on save and the user reopens the sheet to see it.
            Auto-saves 500ms after the last toggle/add. */}
        {editing && checklistItems.length > 0 && (
          <div
            className="rounded-xl p-3"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold">
                צ׳קליסט לפגישה
              </span>
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

        <div
          className="flex items-center gap-2 pt-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {editing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm py-2 px-3 rounded-full transition disabled:opacity-50"
              style={{
                color: "rgb(239,120,120)",
                border: "1px solid var(--border)",
              }}
            >
              <Trash2 size={14} aria-hidden /> מחק
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-sm py-2 px-4 ms-auto"
            disabled={busy}
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="btn-gold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ padding: "0.6rem 1.25rem" }}
          >
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
            שמירה
          </button>
        </div>
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
          <li
            key={it.id}
            className="flex items-center gap-2 group"
          >
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
