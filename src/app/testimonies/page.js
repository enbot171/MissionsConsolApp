"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { addTestimony, deleteTestimony, getTestimoniesByTeam, getPeopleByTeam } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import Spinner from "@/components/Spinner";
import { SIGN_WONDER_TYPES } from "@/lib/report";
import { toDateInput } from "@/lib/dates";
import { FiPlus, FiTrash2, FiZap } from "react-icons/fi";

// A quarter back. Testimonies are read far less often than they're written, so
// the list stays bounded rather than loading a team's whole history.
const LOOKBACK_DAYS = 90;

const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500";

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
    if (!form.description.trim()) { setError("Say what happened."); return; }
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

  return (
    <PageShell
      title="Testimonies"
      rightAction={
        <button
          onClick={() => { setOpen((o) => !o); setError(""); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          <FiPlus size={14} /> {open ? "Close" : "Add"}
        </button>
      }
    >
      {open && (
        <form onSubmit={save} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-700">What happened *</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder="Back pain gone after prayer at the station…"
              className={`${inputCls} resize-none mt-1`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700">Person</label>
              <select value={form.personId} onChange={(e) => set("personId", e.target.value)} className={`${inputCls} appearance-none mt-1`}>
                <option value="">Don&apos;t know / not listed</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Date</label>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={`${inputCls} mt-1`} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.signWonder}
              onChange={(e) => set("signWonder", e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            <span className="text-sm text-gray-700 font-medium">This was a sign &amp; wonder</span>
          </label>

          {form.signWonder && (
            <div className="flex flex-wrap gap-1.5">
              {SIGN_WONDER_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("category", t)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                    form.category === t
                      ? "bg-amber-50 border-amber-300 text-amber-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save testimony"}
          </button>
        </form>
      )}

      {fetching ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !profile?.teamId ? (
        <Empty text="You're not on a team yet." hint="Ask an admin to assign you one." />
      ) : items.length === 0 ? (
        <Empty text="No testimonies yet" hint="Log what God did — it counts toward the weekly report." />
      ) : (
        <div className="space-y-2">
          {items.map((t) => {
            const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{t.description}</p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
                      {t.personName && ` · ${t.personName}`}
                      {t.assignedToName && ` · ${t.assignedToName}`}
                    </p>
                  </div>
                  {t.assignedTo === user.uid && (
                    <button
                      onClick={() => remove(t.id)}
                      className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  )}
                </div>
                {t.signWonder && (
                  <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                    <FiZap size={10} /> {t.category}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

function Empty({ text, hint }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
      <p className="text-2xl mb-2">🙌</p>
      <p className="font-semibold text-gray-800">{text}</p>
      <p className="text-sm text-gray-400 mt-1">{hint}</p>
    </div>
  );
}
