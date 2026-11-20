"use client";

import { useState } from "react";
import { Banner, Button, Field, inputClass } from "@/components/ui";
import { isDateStr, repeatLabel } from "@/lib/events";
import { toDateInput } from "@/lib/dates";

const fieldInput = `${inputClass} font-normal md:min-h-11 md:text-[15px]`;

/**
 * Create or edit an event. Used on the Events page and on one event's page.
 * `onSubmit` receives { name, recurrence, dateStr, time, location, isService }
 * and should throw if saving fails; the form shows the failure and stays open.
 */
export default function EventForm({ initial, title, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    recurrence: initial?.recurrence === "weekly" ? "weekly" : "none",
    dateStr: initial?.dateStr || toDateInput(new Date()),
    time: initial?.time || "",
    location: initial?.location || "",
    isService: !!initial?.isService,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const weekly = form.recurrence === "weekly";

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Give the event a name.");
    if (!isDateStr(form.dateStr)) return setError("Pick a date.");
    setError("");
    setBusy(true);
    try {
      await onSubmit(form);
    } catch {
      setError("Could not save the event. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
      <h2 className="text-xl font-bold tracking-[-0.02em] md:text-[17px] md:tracking-[-0.015em]">{title}</h2>

      {error && <Banner tone="error">{error}</Banner>}

      <Field label="Name">
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Sunday service"
          className={fieldInput}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <p id="event-repeat-label" className="text-sm font-semibold">Repeats</p>
        <div role="group" aria-labelledby="event-repeat-label" className="flex gap-1 rounded-2xl bg-fill p-1 md:bg-white md:ring-1 md:ring-line">
          {[["none", "One-off"], ["weekly", "Every week"]].map(([value, label]) => {
            const on = form.recurrence === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => set("recurrence", value)}
                className={`h-11 flex-1 rounded-xl text-[15px] font-semibold transition-colors md:h-9 md:text-sm ${
                  on
                    ? "bg-white text-ink shadow-[0_1px_3px_rgb(20_30_60/0.12)] md:bg-brand md:text-white md:shadow-none"
                    : "text-muted md:text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-muted">
          {weekly
            ? `${isDateStr(form.dateStr) ? repeatLabel(form) : "Every week"} from the first date, until you stop it.`
            : "Happens once, on the date below."}
        </p>
      </div>

      <div className="flex gap-2.5">
        <Field label={weekly ? "First date" : "Date"} className="min-w-0 flex-[1.4]">
          <input
            type="date"
            value={form.dateStr}
            onChange={(e) => set("dateStr", e.target.value)}
            className={`${fieldInput} min-w-0 px-3`}
          />
        </Field>
        <Field label="Time" className="min-w-0 flex-1">
          <input
            type="time"
            value={form.time}
            onChange={(e) => set("time", e.target.value)}
            className={`${fieldInput} min-w-0 px-3`}
          />
        </Field>
      </div>

      <Field label="Place">
        <input
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="Optional"
          className={fieldInput}
        />
      </Field>

      <button
        type="button"
        role="switch"
        aria-checked={form.isService}
        onClick={() => set("isService", !form.isService)}
        className="flex items-start gap-3 rounded-[18px] bg-brand-soft p-3.5 text-left md:rounded-2xl md:bg-white"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">This is the Sunday service</span>
          <span className="block text-[13px] text-ink-2">Its attendance fills in “No. in Service” on the weekly report.</span>
        </span>
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-7 w-12 shrink-0 items-center rounded-full px-[3px] transition-colors ${
            form.isService ? "justify-end bg-brand" : "justify-start bg-line"
          }`}
        >
          <span className="h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgb(20_30_60/0.3)]" />
        </span>
      </button>

      <div className="flex gap-2.5">
        <Button type="submit" disabled={busy} className="flex-1 shadow-none! max-md:h-12 max-md:rounded-2xl max-md:text-base">
          {busy ? "Saving…" : submitLabel}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy} className="max-md:h-12 max-md:rounded-2xl max-md:px-[18px] max-md:text-base">
          Cancel
        </Button>
      </div>
    </form>
  );
}

// The frame the form sits in: a bottom sheet on phones, a soft panel on laptop.
export function EventFormPanel({ label, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[55] flex flex-col justify-end md:static md:z-auto md:block">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/40 md:hidden"
      />
      <div
        role="dialog"
        aria-label={label}
        className="relative max-h-[92vh] overflow-y-auto rounded-t-[28px] bg-white px-5 pt-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] md:max-h-none md:rounded-3xl md:bg-brand-soft md:px-[22px] md:pb-[22px] md:pt-5"
      >
        {children}
      </div>
    </div>
  );
}
