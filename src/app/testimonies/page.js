"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { addTestimony, deleteTestimony, getTestimoniesByTeam, getPeopleByTeam } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import Spinner from "@/components/Spinner";
import { SIGN_WONDER_TYPES } from "@/lib/report";
import { toDateInput } from "@/lib/dates";
import { Avatar, Button, Field } from "@/components/ui";
import { FiAlertCircle, FiCheck, FiPlus, FiTrash2, FiUsers, FiX, FiZap } from "react-icons/fi";

// A quarter back. Testimonies are read far less often than they're written, so
// the list stays bounded rather than loading a team's whole history.
const LOOKBACK_DAYS = 90;

const MISSING = "Say what happened.";

// Inputs on this page are 44px tall, shorter than the shared input class.
const controlClass =
  "w-full rounded-[14px] bg-white text-base font-normal text-ink ring-1 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand md:text-[15px]";

function todayInput() {
  return toDateInput(new Date());
}

function emptyForm() {
  return { personId: "", description: "", date: todayInput(), signWonder: false, category: SIGN_WONDER_TYPES[0] };
}

export default function Testimonies() {
  const { user, profile, loading } = useRequireAuth();
  const [items, setItems] = useState([]);
  const [people, setPeople] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !profile?.teamId) { if (user) setFetching(false); return; }
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    Promise.all([
      getTestimoniesByTeam(profile.teamId, { since }),
      getPeopleByTeam(profile.teamId),
    ]).then(([t, p]) => {
      setItems(t);
      setPeople(p);
    }).finally(() => setFetching(false));
  }, [user, profile?.teamId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { setError(MISSING); return; }
    setSaving(true); setError("");
    // The person is optional — plenty of testimonies come from someone whose
    // name you never got.
    const person = people.find((p) => p.id === form.personId);
    const payload = {
      personId: form.personId || null,
      personName: person?.name || "",
      description: form.description.trim(),
      date: form.date,
      signWonder: form.signWonder,
      category: form.signWonder ? form.category : null,
      assignedTo: user.uid,
      assignedToName: profile?.name || "",
      teamId: profile.teamId,
    };
    try {
      const id = await addTestimony(payload);
      setItems((prev) => [{ id, ...payload, date: new Date(payload.date) }, ...prev]);
      setForm(emptyForm());
      setOpen(false);
    } catch { setError("Failed to save. Try again."); }
    setSaving(false);
  };

  const remove = async (id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    await deleteTestimony(id);
  };

  if (loading) return null;

  const missing = error === MISSING;
  const hasList = !fetching && profile?.teamId && items.length > 0;

  return (
    <PageShell
      title={
        <span className="flex flex-wrap items-baseline gap-x-3">
          Testimonies
          {hasList && (
            <span className="hidden text-[15px] font-normal leading-normal tracking-normal text-muted md:inline">
              {items.length} from the team in the last {LOOKBACK_DAYS} days
            </span>
          )}
        </span>
      }
      rightAction={
        <Button
          variant={open ? "quiet" : "primary"}
          className={open
            ? "max-md:gap-1.5 max-md:px-3.5 md:bg-white md:ring-1 md:ring-line md:hover:bg-tint"
            : "max-md:gap-1.5 max-md:px-3.5 max-md:shadow-none md:px-[18px]"}
          aria-expanded={open}
          aria-controls="testimony-form"
          onClick={() => { setOpen((o) => !o); setError(""); }}
        >
          {open ? <FiX size={17} aria-hidden="true" /> : <FiPlus size={17} aria-hidden="true" />}
          {open ? "Close" : "Add"}
        </Button>
      }
    >
      {/* The form comes first so it sits above the list on phones; on laptops
          it is ordered after the list and stands to its right. */}
      <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-start md:gap-5">
        {open && (
          <form
            id="testimony-form"
            onSubmit={save}
            className="flex min-w-0 flex-col gap-2.5 rounded-3xl bg-white px-4 pb-4 pt-3.5 shadow-card md:order-2 md:flex-[1_1_320px] md:gap-3.5 md:px-[22px] md:pb-[22px] md:pt-5"
          >
            <h2 className="hidden text-[17px] font-bold tracking-[-0.015em] md:block">Add a testimony</h2>

            <Field label="What happened *">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                aria-invalid={missing || undefined}
                placeholder="Back pain gone after prayer at the station…"
                className={`${controlClass} resize-none px-3.5 py-2.5 ${missing ? "ring-danger-ink" : "ring-line"}`}
              />
              {missing && <span role="alert" className="text-[13px] font-normal text-danger-ink">{error}</span>}
            </Field>

            <div className="grid grid-cols-2 gap-2.5 md:gap-3.5">
              <Field label="Person" className="min-w-0">
                <select value={form.personId} onChange={(e) => set("personId", e.target.value)} className={`${controlClass} h-11 pl-2.5 ring-line md:pl-3`}>
                  <option value="">Don&apos;t know / not listed</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Date" className="min-w-0">
                <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={`${controlClass} h-11 min-w-0 px-2.5 ring-line md:px-3.5`} />
              </Field>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 font-medium">
              <input
                type="checkbox"
                checked={form.signWonder}
                onChange={(e) => set("signWonder", e.target.checked)}
                className="h-5 w-5 accent-brand"
              />
              This was a sign &amp; wonder
            </label>

            {form.signWonder && (
              <div role="group" aria-label="Type of sign and wonder" className="flex flex-wrap gap-2">
                {SIGN_WONDER_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={form.category === t}
                    onClick={() => set("category", t)}
                    className={`inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                      form.category === t
                        ? "bg-warn-soft text-warn-ink"
                        : "bg-fill text-ink hover:bg-line-soft"
                    }`}
                  >
                    {form.category === t && <FiCheck size={15} aria-hidden="true" />}
                    {t}
                  </button>
                ))}
              </div>
            )}

            {error && !missing && (
              <div role="alert" className="flex items-start gap-2.5 rounded-[14px] bg-danger-soft px-3.5 py-3 text-sm font-medium leading-[1.45] text-danger-ink">
                <FiAlertCircle size={17} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span className="min-w-0">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              className="max-md:h-12 max-md:rounded-2xl max-md:px-5 max-md:text-base max-md:shadow-none md:px-5"
            >
              {saving ? "Saving…" : "Save testimony"}
            </Button>

            <p className="hidden text-[13px] text-muted md:block">Signs and wonders count toward section C of the weekly report.</p>
          </form>
        )}

        <div className="min-w-0 md:order-1 md:flex-[1.5_1_400px]">
          {fetching ? (
            <Spinner />
          ) : !profile?.teamId ? (
            <EmptyPanel icon={<FiUsers size={26} aria-hidden="true" />} title="You're not on a team yet." hint="Ask an admin to assign you one." />
          ) : items.length === 0 ? (
            <EmptyPanel icon={<FiZap size={26} aria-hidden="true" />} title="No testimonies yet" hint="Log what God did. It counts toward the weekly report." />
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((t) => {
                const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
                const when = d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
                return (
                  <li key={t.id} className="flex items-start gap-2 rounded-[20px] bg-tint py-3 pl-3.5 pr-1.5 md:gap-3.5 md:rounded-[18px] md:py-3.5 md:pl-4 md:pr-3">
                    <span className="hidden shrink-0 md:block"><Avatar name={t.assignedToName} className="md:text-[15px]" /></span>
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                      <p className="whitespace-pre-wrap">{t.description}</p>
                      {/* Stacked on phones; tag and details share a line on laptops. */}
                      <div className="flex flex-col items-start gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-2">
                        {t.signWonder && (
                          <span className="inline-flex h-6 items-center gap-[5px] whitespace-nowrap rounded-full bg-warn-soft px-2.5 text-[12.5px] font-semibold text-warn-ink">
                            <FiZap size={12} aria-hidden="true" /> {t.category}
                          </span>
                        )}
                        <span className="text-[13px] text-muted">
                          {when}
                          {t.personName && ` · ${t.personName}`}
                          {t.assignedToName && ` · ${t.assignedToName}`}
                        </span>
                      </div>
                    </div>
                    {t.assignedTo === user.uid && (
                      <button
                        type="button"
                        aria-label={`Delete testimony from ${when}`}
                        onClick={() => remove(t.id)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-muted transition-colors hover:bg-danger-soft hover:text-danger-ink"
                      >
                        <FiTrash2 size={18} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
}

// The boards' empty state: a white outlined panel with an icon tile.
function EmptyPanel({ icon, title, hint }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-line-soft">
      <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">{icon}</span>
      <p className="text-[17px] font-bold tracking-[-0.015em]">{title}</p>
      <p className="max-w-[420px] text-sm text-muted">{hint}</p>
    </div>
  );
}
