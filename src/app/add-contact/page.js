"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useRequireAuth } from "@/hooks/useRequireAuth";
import { addPerson, getCGsByTeam, getCoreTeamsByTeam } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import { CONTACT_TYPES, SOURCES, CONTACT_ROLES } from "@/config/app";

const EXCLUSIVE_ROLES = ["Contact", "Disciple"];

const roleColors = {
  Contact: "bg-blue-500", Disciple: "bg-emerald-500", CGL: "bg-violet-500",
};

const MINISTRY_COLORS = ["bg-pink-500", "bg-cyan-500", "bg-amber-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500"];

export default function AddContact() {
  return (
    <Suspense>
      <AddContactInner />
    </Suspense>
  );
}

function AddContactInner() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCgId = searchParams.get("cgId") || "";
  const prefilledMinistry = searchParams.get("ministry") || "";

  const [cgs, setCgs] = useState([]);
  const [coreTeams, setCoreTeams] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(prefilledCgId || prefilledMinistry ? "full" : "quick");


  const [form, setForm] = useState({
    name: "", contactType: "", contact: "", source: "",
    age: "", address: "", gospelShared: false, prayed: false, saved: false,
    cgId: prefilledCgId, metAt: "", description: "", progressRemarks: "", followUpRemarks: "",
    roles: prefilledMinistry ? ["Core Team"] : ["Contact"],
    ministries: prefilledMinistry ? [prefilledMinistry] : [],
    milestones: {},
    metOn: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (!profile?.teamId) return;
    Promise.all([getCGsByTeam(profile.teamId), getCoreTeamsByTeam(profile.teamId)]).then(([c, ct]) => {
      setCgs(c);
      setCoreTeams(ct);
    });
  }, [profile?.teamId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleRole = (r) => {
    const cur = form.roles;
    if (cur.includes(r)) {
      set("roles", cur.filter((x) => x !== r));
    } else {
      const next = EXCLUSIVE_ROLES.includes(r)
        ? [...cur.filter((x) => !EXCLUSIVE_ROLES.includes(x)), r]
        : [...cur, r];
      set("roles", next);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      if (tab === "no-contact") {
        if (!form.name.trim()) { setError("Name is required."); setSaving(false); return; }
        await addPerson({
          name: form.name.trim(),
          description: form.description,
          createdAt: form.metOn || null,
          gospelShared: form.gospelShared,
          prayed: form.prayed,
          saved: form.saved,
          noContact: true,
          archived: true,
          roles: [],
          ministries: [],
          milestones: {},
          assignedTo: user.uid,
          assignedToName: profile?.name || "",
          teamId: profile?.teamId || "",
        });
        router.push("/people");
        return;
      }
      if (!form.name.trim()) { setError("Name is required."); setSaving(false); return; }
      if (!form.contact.trim()) { setError("Contact info is required."); setSaving(false); return; }
      const id = await addPerson({
        ...form,
        age: form.age ? parseInt(form.age) : null,
        assignedTo: user.uid,
        assignedToName: profile?.name || "",
        teamId: profile?.teamId || "",
        createdAt: form.metOn || null,
      });
      router.push(`/person/${id}`);
    } catch { setError("Failed to save. Try again."); }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <PageShell title="Add Contact">
      <form onSubmit={handleSubmit} className="space-y-3">

        {/* Tab toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {[["quick", "Quick"], ["full", "Full"], ["no-contact", "No Contact"]].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => { setTab(val); setError(""); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                tab === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── QUICK TAB ── */}
        {tab === "quick" && (
          <>
            <Card>
              <Field label="Name *" value={form.name} onChange={(v) => set("name", v)} placeholder="Full name" />
              <Field label="Contact Type" value={form.contactType} onChange={(v) => set("contactType", v)} select={CONTACT_TYPES} placeholder="Select type" />
              <Field label="Contact Info *" value={form.contact} onChange={(v) => set("contact", v)} placeholder="Handle / number" />
              <Field label="Date Met" type="date" value={form.metOn} onChange={(v) => set("metOn", v)} />
              <Field label="Met At" value={form.metAt} onChange={(v) => set("metAt", v)} placeholder="Where you met" />
              <div className="space-y-1">
                <Field label="Remarks" value={form.description} onChange={(v) => set("description", v)} textarea placeholder="Notes…" />
                <Field label="Follow Up Remarks" value={form.followUpRemarks} onChange={(v) => set("followUpRemarks", v)} textarea placeholder="What to follow up on…" />
              </div>
            </Card>

            <Card title="Status">
              {[
                { key: "gospelShared", label: "Gospel Shared" },
                { key: "prayed", label: "Prayed" },
                { key: "saved", label: "Saved" },
              ].map(({ key, label }) => (
                <StatusRow key={key} label={label} checked={form[key]} onToggle={() => set(key, !form[key])} />
              ))}
            </Card>
          </>
        )}

        {/* ── FULL TAB ── */}
        {tab === "full" && (
          <>
            <Card>
              <Field label="Name *" value={form.name} onChange={(v) => set("name", v)} placeholder="Full name" />
              <Field label="Contact Type" value={form.contactType} onChange={(v) => set("contactType", v)} select={CONTACT_TYPES} placeholder="Select type" />
              <Field label="Contact Info *" value={form.contact} onChange={(v) => set("contact", v)} placeholder="Handle / number" />
              <Field label="Source" value={form.source} onChange={(v) => set("source", v)} select={SOURCES} placeholder="Select source" />
              <Field label="Age" type="number" value={form.age} onChange={(v) => set("age", v)} placeholder="Age" />
              <Field label="Address" value={form.address} onChange={(v) => set("address", v)} placeholder="Address" />
              <Field label="Date Met" type="date" value={form.metOn} onChange={(v) => set("metOn", v)} />
              <Field label="Met At" value={form.metAt} onChange={(v) => set("metAt", v)} placeholder="Where you met" />
              <Field label="CG" value={form.cgId} onChange={(v) => set("cgId", v)}
                select={cgs.map((c) => ({ value: c.id, label: c.name }))} placeholder="No CG" />
              <div className="space-y-1">
                <Field label="Remarks" value={form.description} onChange={(v) => set("description", v)} textarea placeholder="Notes…" />
                <Field label="Follow Up Remarks" value={form.followUpRemarks} onChange={(v) => set("followUpRemarks", v)} textarea placeholder="What to follow up on…" />
              </div>
            </Card>

            <Card title="Status">
              {[
                { key: "gospelShared", label: "Gospel Shared" },
                { key: "prayed", label: "Prayed" },
                { key: "saved", label: "Saved" },
              ].map(({ key, label }) => (
                <StatusRow key={key} label={label} checked={form[key]} onToggle={() => set(key, !form[key])} />
              ))}
            </Card>

            <Card title="Role">
              <div className="flex flex-wrap gap-2">
                {CONTACT_ROLES.map((r) => (
                  <Chip key={r} label={r} active={form.roles.includes(r)} color={roleColors[r]} onToggle={() => toggleRole(r)} />
                ))}
              </div>
            </Card>

            <Card title="Core Team">
              <div
                onClick={() => {
                  const isCT = form.roles.includes("Core Team");
                  const newRoles = isCT
                    ? form.roles.filter((r) => r !== "Core Team")
                    : [...form.roles, "Core Team"];
                  if (isCT) {
                    setForm((f) => ({ ...f, roles: newRoles, ministries: [] }));
                  } else {
                    set("roles", newRoles);
                  }
                }}
                className={`flex justify-between items-center rounded-xl px-3.5 py-3 cursor-pointer transition-all border ${
                  form.roles.includes("Core Team")
                    ? "bg-orange-50 border-orange-200 text-orange-700"
                    : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                <span className="text-sm font-semibold">Core Team Member</span>
                <span className={`text-base font-bold ${form.roles.includes("Core Team") ? "text-orange-500" : "text-gray-400"}`}>
                  {form.roles.includes("Core Team") ? "✓" : "○"}
                </span>
              </div>
              {form.roles.includes("Core Team") && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Ministry Team</p>
                  <div className="flex flex-wrap gap-2">
                    {coreTeams.map((t, i) => (
                      <Chip
                        key={t.id}
                        label={t.name}
                        active={form.ministries.includes(t.name)}
                        color={MINISTRY_COLORS[i % MINISTRY_COLORS.length]}
                        onToggle={() => {
                          const cur = form.ministries;
                          set("ministries", cur.includes(t.name) ? cur.filter((x) => x !== t.name) : [...cur, t.name]);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {/* ── NO CONTACT TAB ── */}
        {tab === "no-contact" && (
          <>
            <Card>
              <p className="text-xs text-gray-500">For people you spoke to but didn't get contact info from.</p>
              <Field label="Name *" value={form.name} onChange={(v) => set("name", v)} placeholder="Full name" />
              <Field label="Date Met" type="date" value={form.metOn} onChange={(v) => set("metOn", v)} />
              <div className="space-y-1">
                <Field label="Remarks" value={form.description} onChange={(v) => set("description", v)} textarea placeholder="Notes…" />
                <Field label="Follow Up Remarks" value={form.followUpRemarks} onChange={(v) => set("followUpRemarks", v)} textarea placeholder="What to follow up on…" />
              </div>
            </Card>

            <Card title="Status">
              {[
                { key: "gospelShared", label: "Gospel Shared" },
                { key: "prayed", label: "Prayed" },
                { key: "saved", label: "Saved" },
              ].map(({ key, label }) => (
                <StatusRow key={key} label={label} checked={form[key]} onToggle={() => set(key, !form[key])} />
              ))}
            </Card>
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 bg-linear-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Saving…" : tab === "no-contact" ? "Save (No Contact)" : "Add Contact"}
        </button>
      </form>
    </PageShell>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      {title && <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">{title}</p>}
      {children}
    </div>
  );
}

const inputCls = "w-full min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white transition-colors";

function Field({ label, value, onChange, type = "text", select, placeholder, textarea }) {
  return (
    <div className="space-y-1 min-w-0 overflow-hidden">
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      {textarea ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} className={`${inputCls} resize-none`} />
      ) : select ? (
        <div className="relative">
          <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${inputCls} appearance-none pr-9`}>
            {placeholder && <option value="">{placeholder}</option>}
            {select.map((o) => typeof o === "string"
              ? <option key={o} value={o}>{o}</option>
              : <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M5 8l5 5 5-5H5z" />
          </svg>
        </div>
      ) : (
        <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
      )}
    </div>
  );
}

function StatusRow({ label, checked, onToggle }) {
  return (
    <div onClick={onToggle} className={`flex justify-between items-center rounded-xl px-3.5 py-3 cursor-pointer transition-all border ${
      checked ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
    }`}>
      <span className={`text-sm font-semibold ${checked ? "text-emerald-700" : "text-gray-700"}`}>{label}</span>
      <span className={`text-base font-bold ${checked ? "text-emerald-500" : "text-gray-500"}`}>{checked ? "✓" : "○"}</span>
    </div>
  );
}

function Chip({ label, active, color, onToggle }) {
  return (
    <button type="button" onClick={onToggle}
      className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
        active ? `${color} text-white border-transparent shadow-sm` : "bg-white text-gray-700 border-gray-200"
      }`}
    >{label}</button>
  );
}
