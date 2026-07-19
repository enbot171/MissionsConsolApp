"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPerson, updatePerson, getCGsByTeam, getUsersByTeam, getCoreTeamsByTeam, getMeetupsByPerson } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import PageShell from "@/components/PageShell";
import { FaArchive } from "react-icons/fa";
import { FiCalendar } from "react-icons/fi";
import { FaInstagram } from "react-icons/fa";
import { contactLink } from "@/lib/contactLink";
import { CONTACT_TYPES, SOURCES, CONTACT_ROLES, MILESTONES, ROLE_STYLES } from "@/config/app";

export default function PersonView() {
  const { id } = useParams();
  const { loading: authLoading, profile } = useRequireAuth();
  const router = useRouter();

  const [person, setPerson] = useState(null);
  const [cgs, setCgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [coreTeams, setCoreTeams] = useState([]);
  const [meetups, setMeetups] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState("info");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Single unified form state across all tabs
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!profile?.teamId) return;
    Promise.all([
      getPerson(id),
      getCGsByTeam(profile.teamId),
      getUsersByTeam(profile.teamId),
      getCoreTeamsByTeam(profile.teamId),
    ]).then(([p, c, u, ct]) => {
      setPerson(p);
      setForm(p);
      setCgs(c);
      setUsers(u);
      setCoreTeams(ct);
      setFetching(false);
    });
    getMeetupsByPerson(id).then(setMeetups).catch(() => setMeetups([]));
  }, [id, profile?.teamId]);

  const set = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      await updatePerson(id, {
        name: form.name ?? null,
        contactType: form.contactType ?? null,
        contact: form.contact ?? null,
        source: form.source ?? null,
        age: form.age ?? null,
        address: form.address ?? null,
        metAt: form.metAt ?? null,
        description: form.description ?? null,
        roles: form.roles ?? [],
        ministries: form.ministries ?? [],
        teamId: profile?.teamId || form.teamId || "",
        createdAt: form.createdAt instanceof Date
          ? Timestamp.fromDate(form.createdAt)
          : (form.createdAt ?? null),
        gospelShared: form.gospelShared ?? false,
        prayed: form.prayed ?? false,
        saved: form.saved ?? false,
        milestones: form.milestones || {},
        progressRemarks: form.progressRemarks || "",
        followUpRemarks: form.followUpRemarks || "",
        ...(form.followUpDays != null ? { followUpDays: parseInt(form.followUpDays) || null } : {}),
        scheduledFollowUpAt: form.scheduledFollowUpAt instanceof Date
          ? Timestamp.fromDate(form.scheduledFollowUpAt)
          : (form.scheduledFollowUpAt ?? null),
        cgId: form.cgId ?? null,
        assignedTo: form.assignedTo ?? null,
        assignedToName: form.assignedToName ?? null,
      });
      setPerson((p) => ({ ...p, ...form }));
      showSaved();
    } catch { setError("Failed to save."); }
    setSaving(false);
  };

  const handleRemoveFromCG = async () => {
    setSaving(true);
    try {
      await updatePerson(id, { cgId: "" });
      setPerson((p) => ({ ...p, cgId: "" }));
      setForm((f) => ({ ...f, cgId: "" }));
      showSaved();
    } catch { setError("Failed to remove from CG."); }
    setSaving(false);
  };

  const handleArchive = async () => {
    if (!confirm(`Archive ${person.name}?`)) return;
    setSaving(true);
    try {
      await updatePerson(id, { archived: true });
      router.push("/people");
    } catch { setError("Failed to archive."); }
    setSaving(false);
  };

  const handleUnarchive = async () => {
    setSaving(true);
    try {
      await updatePerson(id, { archived: false });
      setPerson((p) => ({ ...p, archived: false }));
      setForm((f) => ({ ...f, archived: false }));
      showSaved();
    } catch { setError("Failed to unarchive."); }
    setSaving(false);
  };

  if (authLoading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!person || !form) return <div className="p-8 text-center text-gray-600">Person not found.</div>;

  return (
    <PageShell
      title={person.name}
      backHref="/people"
      rightAction={
        <button
          onClick={person.archived ? handleUnarchive : handleArchive}
          disabled={saving}
          className={`flex flex-col items-center active:opacity-70 ${person.archived ? "text-blue-500" : "text-red-500"}`}
        >
          <FaArchive size={18} />
          <span className="text-[10px] font-semibold mt-0.5">{person.archived ? "Unarchive" : "Archive"}</span>
        </button>
      }
    >
      {/* Avatar + role chips */}
      <div className="flex flex-col items-center mb-5 pt-2">
        <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-300/40 mb-3">
          <span className="text-white text-3xl font-bold">{person.name?.charAt(0).toUpperCase() || "?"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {(person.roles || []).map((r) => (
            <span key={r} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ROLE_STYLES[r] || "bg-gray-100 text-gray-700"}`}>{r}</span>
          ))}
          {person.archived && <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-gray-100 text-gray-700">Archived</span>}
        </div>
        <p className="text-gray-600 text-sm mt-1">
          {person.contactType ? `${person.contactType} - ${person.contact}` : person.contact}
        </p>
        {(() => {
          const ig = contactLink(person.contactType, person.contact);
          if (!ig) return null;
          return (
            <div className="flex gap-2 mt-2.5">
              <a
                href={ig.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-pink-200 bg-pink-50 text-pink-700 text-xs font-semibold hover:bg-pink-100 transition-colors"
              >
                <FaInstagram size={13} /> Profile
              </a>
            </div>
          );
        })()}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {["info", "progress", "network", "meetings"].map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(""); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </div>
      )}

      {/* ── INFO TAB ── */}
      {tab === "info" && (
        <div className="space-y-3">
          <Card>
            <Field label="Name" value={form.name} onChange={(v) => set("name", v)} />
            <Field label="Contact Type" value={form.contactType} onChange={(v) => set("contactType", v)} select={CONTACT_TYPES} />
            <Field label="Contact Info" value={form.contact} onChange={(v) => set("contact", v)} />
            <Field label="Source" value={form.source || ""} onChange={(v) => set("source", v)} select={SOURCES} />
            <Field label="Age" type="number" value={form.age || ""} onChange={(v) => set("age", v ? parseInt(v) : null)} />
            <Field label="Address" value={form.address || ""} onChange={(v) => set("address", v)} />
            <Field
              label="Date Met"
              type="date"
              value={form.createdAt?.toDate ? form.createdAt.toDate().toISOString().split("T")[0] : form.createdAt instanceof Date ? form.createdAt.toISOString().split("T")[0] : ""}
              onChange={(v) => set("createdAt", v ? new Date(v) : form.createdAt)}
            />
            <Field label="Met At" value={form.metAt || ""} onChange={(v) => set("metAt", v)} />
            <Field label="Remarks" value={form.description || ""} onChange={(v) => set("description", v)} textarea />
            <Field label="Follow Up Remarks" value={form.followUpRemarks || ""} onChange={(v) => set("followUpRemarks", v)} textarea />
            <Field
              label="Subsequent follow-up interval (days)"
              type="number"
              value={form.followUpDays ?? ""}
              onChange={(v) => set("followUpDays", v === "" ? null : parseInt(v) || null)}
              placeholder="None"
            />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Scheduled follow-up</label>
              <p className="text-[11px] text-gray-400">Optional — set a specific date to be reminded to follow up.</p>
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={
                    form.scheduledFollowUpAt instanceof Date
                      ? form.scheduledFollowUpAt.toISOString().split("T")[0]
                      : form.scheduledFollowUpAt?.toDate
                      ? form.scheduledFollowUpAt.toDate().toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) => set("scheduledFollowUpAt", e.target.value ? new Date(e.target.value) : null)}
                  className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
                {form.scheduledFollowUpAt && (
                  <button
                    type="button"
                    onClick={() => set("scheduledFollowUpAt", null)}
                    className="text-xs text-gray-400 hover:text-gray-600 font-semibold shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {form.lastFollowedUpAt && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Last Followed Up</label>
                <p className="text-sm text-gray-600">
                  {(form.lastFollowedUpAt?.toDate ? form.lastFollowedUpAt.toDate() : new Date(form.lastFollowedUpAt))
                    .toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                </p>
              </div>
            )}
          </Card>

          <Card title="Roles">
            <ChipGroup items={CONTACT_ROLES} active={form.roles || []} onToggle={(r) => {
              const cur = form.roles || [];
              if (cur.includes(r)) {
                set("roles", cur.filter((x) => x !== r));
              } else {
                const exclusive = ["Contact", "Disciple"];
                set("roles", exclusive.includes(r)
                  ? [...cur.filter((x) => !exclusive.includes(x)), r]
                  : [...cur, r]);
              }
            }} />
          </Card>

          <Card title="Core Team">
            <div
              onClick={() => {
                const isCT = (form.roles || []).includes("Core Team");
                const newRoles = isCT
                  ? (form.roles || []).filter((r) => r !== "Core Team")
                  : [...(form.roles || []), "Core Team"];
                if (isCT) {
                  setForm((f) => ({ ...f, roles: newRoles, ministries: [] }));
                } else {
                  set("roles", newRoles);
                }
              }}
              className={`flex justify-between items-center rounded-xl px-3.5 py-3 cursor-pointer transition-all border ${
                (form.roles || []).includes("Core Team")
                  ? "bg-orange-50 border-orange-200 text-orange-700"
                  : "bg-gray-50 border-gray-200 text-gray-700"
              }`}
            >
              <span className="text-sm font-semibold">Core Team Member</span>
              <span className={`text-base font-bold ${(form.roles || []).includes("Core Team") ? "text-orange-500" : "text-gray-400"}`}>
                {(form.roles || []).includes("Core Team") ? "✓" : "○"}
              </span>
            </div>
            {(form.roles || []).includes("Core Team") && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Ministry Team</p>
                <ChipGroup items={coreTeams.map((t) => t.name)} active={form.ministries || []} onToggle={(m) => {
                  const cur = form.ministries || [];
                  set("ministries", cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]);
                }} />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── PROGRESS TAB ── */}
      {tab === "progress" && (
        <div className="space-y-3">
          <Card title="Status">
            {[
              { key: "gospelShared", label: "Gospel Shared" },
              { key: "prayed", label: "Prayed" },
              { key: "saved", label: "Saved" },
            ].map(({ key, label }) => (
              <ProgressRow
                key={key}
                label={label}
                checked={!!form[key]}
                onToggle={() => set(key, !form[key])}
              />
            ))}
          </Card>

          <Card title="Milestones">
            <div className="grid grid-cols-2 gap-2">
              {MILESTONES.map((m) => (
                <ProgressRow
                  key={m}
                  label={m}
                  checked={!!form.milestones?.[m]}
                  onToggle={() => set("milestones", { ...form.milestones, [m]: !form.milestones?.[m] })}
                />
              ))}
            </div>
          </Card>

          <Card title="Progress Remarks">
            <textarea
              value={form.progressRemarks || ""}
              onChange={(e) => set("progressRemarks", e.target.value)}
              rows={4}
              placeholder="Enter progress notes…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 resize-none"
            />
          </Card>
        </div>
      )}

      {/* ── NETWORK TAB ── */}
      {tab === "network" && (
        <div className="space-y-3">
          <Card>
            <Field
              label="Connect Group"
              value={form.cgId || ""}
              onChange={(v) => set("cgId", v)}
              select={cgs.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="No CG"
            />
            <Field
              label="Assigned To (POC)"
              value={form.assignedTo || ""}
              onChange={(v) => {
                const u = users.find((u) => u.id === v);
                setForm((f) => ({ ...f, assignedTo: v, assignedToName: u?.name || "" }));
              }}
              select={users.map((u) => ({ value: u.id, label: u.name }))}
            />
          </Card>

          {form.cgId && (
            <button
              onClick={handleRemoveFromCG}
              disabled={saving}
              className="w-full py-3 border border-red-200 text-red-500 font-semibold rounded-xl text-sm hover:bg-red-50 transition-colors"
            >
              Remove from CG
            </button>
          )}
        </div>
      )}

      {/* ── MEETINGS TAB ── */}
      {tab === "meetings" && (
        <div className="space-y-3">
          <button
            onClick={() => router.push(`/calendar?scheduleFor=${id}&name=${encodeURIComponent(person.name)}`)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <FiCalendar size={14} />
            Schedule Meeting
          </button>
          {meetups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <p className="text-sm font-semibold text-gray-700">No meetings yet</p>
              <p className="text-xs text-gray-400 mt-1">Schedule one above.</p>
            </div>
          ) : (
            meetups.map((m) => {
              const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
              const isPast = d < new Date();
              return (
                <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPast ? "bg-gray-100" : "bg-blue-50"}`}>
                    <span className={`text-sm font-bold ${isPast ? "text-gray-500" : "text-blue-600"}`}>{d.getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      {" · "}
                      {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {m.location && <p className="text-xs text-gray-500 mt-0.5">{m.location}</p>}
                    {m.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{m.notes}</p>}
                  </div>
                  {m.completed === true && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">Done</span>
                  )}
                  {m.completed === false && (
                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">Missed</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Single save button — hidden on meetings tab */}
      {tab !== "meetings" && (
        <>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-4 py-3 bg-linear-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          {saved && (
            <p className="text-center text-sm font-medium text-emerald-600 mt-2">Changes saved.</p>
          )}
        </>
      )}
    </PageShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      {title && <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">{title}</p>}
      {children}
    </div>
  );
}

const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white transition-colors";

function Field({ label, value, onChange, type = "text", select, placeholder, textarea }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      {textarea ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} className={`${inputCls} resize-none`} />
      ) : select ? (
        <div className="relative">
          <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} appearance-none pr-9`}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {select.map((o) =>
              typeof o === "string"
                ? <option key={o} value={o}>{o}</option>
                : <option key={o.value} value={o.value}>{o.label}</option>
            )}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
          >
            <path d="M5 8l5 5 5-5H5z" />
          </svg>
        </div>
      ) : (
        <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
      )}
    </div>
  );
}

const ROLE_COLORS = {
  Contact: "bg-blue-500", Disciple: "bg-emerald-500", CGL: "bg-violet-500", "Core Team": "bg-orange-500",
};
const MINISTRY_COLOR_CYCLE = ["bg-pink-500", "bg-cyan-500", "bg-amber-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500"];

function ChipGroup({ items, active, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => {
        const on = active.includes(item);
        const color = ROLE_COLORS[item] || MINISTRY_COLOR_CYCLE[i % MINISTRY_COLOR_CYCLE.length];
        return (
          <button key={item} type="button" onClick={() => onToggle(item)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
              on ? `${color} text-white border-transparent shadow-sm` : "bg-white text-gray-700 border-gray-200"
            }`}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

function ProgressRow({ label, checked, onToggle }) {
  return (
    <div onClick={onToggle} className={`flex justify-between items-center rounded-xl px-3.5 py-3 cursor-pointer transition-all border ${
      checked ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-700"
    }`}>
      <span className="text-sm font-semibold">{label}</span>
      <span className={`text-base font-bold ${checked ? "text-emerald-500" : "text-gray-500"}`}>{checked ? "✓" : "○"}</span>
    </div>
  );
}
