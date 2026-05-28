"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  getPeopleByAssigneeForMonth,
  getMeetupsByAssignee,
  getPeopleByAssignee,
  addMeetup,
  updateMeetup,
  deleteMeetup,
} from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import { FiChevronLeft, FiChevronRight, FiPlus, FiX, FiTrash2 } from "react-icons/fi";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toLocalDateStr(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().split("T")[0];
}

function toDatetimeLocal(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMeetupTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CalendarPage() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [peopleByDay, setPeopleByDay] = useState({});
  const [meetups, setMeetups] = useState([]);
  const [myPeople, setMyPeople] = useState([]);
  const [modal, setModal] = useState(null); // null | { mode: "add"|"edit", meetup?, date? }
  const [form, setForm] = useState({ personId: "", personName: "", date: "", location: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPeopleByAssigneeForMonth(user.uid, year, month),
      getMeetupsByAssignee(user.uid),
      getPeopleByAssignee(user.uid),
    ]).then(([monthPeople, allMeetups, allPeople]) => {
      const byDay = {};
      monthPeople.forEach((p) => {
        const ds = toLocalDateStr(p.createdAt);
        if (ds) { if (!byDay[ds]) byDay[ds] = []; byDay[ds].push(p); }
      });
      setPeopleByDay(byDay);
      setMeetups(allMeetups);
      setMyPeople(allPeople);
    });
  }, [user, year, month]);

  if (loading) return null;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = (firstDow + 6) % 7; // convert to Mon-start
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const todayStr = today.toISOString().split("T")[0];

  const meetupsByDay = {};
  meetups.forEach((m) => {
    const ds = toLocalDateStr(m.date);
    if (ds) { if (!meetupsByDay[ds]) meetupsByDay[ds] = []; meetupsByDay[ds].push(m); }
  });

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const openAdd = (dateStr) => {
    setForm({ personId: "", personName: "", date: dateStr ? `${dateStr}T09:00` : "", location: "", notes: "" });
    setSearch("");
    setModal({ mode: "add" });
  };

  const openEdit = (meetup, e) => {
    e.stopPropagation();
    setForm({
      personId: meetup.personId || "",
      personName: meetup.personName || "",
      date: toDatetimeLocal(meetup.date),
      location: meetup.location || "",
      notes: meetup.notes || "",
    });
    setSearch(meetup.personName || "");
    setModal({ mode: "edit", meetup });
  };

  const handleSave = async () => {
    if (!form.personId || !form.date) return;
    setSaving(true);
    if (modal.mode === "add") {
      await addMeetup({ ...form, assignedTo: user.uid, teamId: profile?.teamId || "" });
    } else {
      await updateMeetup(modal.meetup.id, form);
    }
    const updated = await getMeetupsByAssignee(user.uid);
    setMeetups(updated);
    setModal(null);
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    await deleteMeetup(modal.meetup.id);
    setMeetups((prev) => prev.filter((m) => m.id !== modal.meetup.id));
    setModal(null);
    setSaving(false);
  };

  const filteredPeople = myPeople.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const needsConfirmation = meetups.filter((m) => {
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
    return d < today && m.completed == null;
  });

  const upcomingMeetups = meetups
    .filter((m) => {
      const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
      return d >= today;
    })
    .slice(0, 10);

  return (
    <PageShell
      title="Calendar"
      rightAction={
        <button
          onClick={() => openAdd("")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          <FiPlus size={14} /> Schedule
        </button>
      }
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <FiChevronLeft size={18} className="text-gray-600" />
        </button>
        <p className="font-bold text-gray-900">{MONTHS[month]} {year}</p>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <FiChevronRight size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <p key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</p>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-2xl overflow-hidden border border-gray-100">
        {Array.from({ length: totalCells }).map((_, i) => {
          const day = i - offset + 1;
          if (day < 1 || day > daysInMonth) {
            return <div key={i} className="bg-gray-50 min-h-[64px]" />;
          }
          const pad = (n) => String(n).padStart(2, "0");
          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
          const contacts = peopleByDay[dateStr] || [];
          const dayMeetups = meetupsByDay[dateStr] || [];
          const isToday = dateStr === todayStr;
          const isPast = dateStr < todayStr;

          return (
            <div
              key={i}
              className={`bg-white min-h-[64px] p-1.5 cursor-pointer transition-colors hover:bg-blue-50 ${isToday ? "bg-blue-50" : ""}`}
              onClick={() => {
                if (contacts.length > 0 || isPast) {
                  router.push(`/summary?date=${dateStr}`);
                } else {
                  openAdd(dateStr);
                }
              }}
            >
              <p className={`text-xs font-bold mb-1 ${isToday ? "text-blue-600" : "text-gray-700"}`}>{day}</p>
              {contacts.length > 0 && (
                <div className="flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                  <span className="text-[10px] font-semibold text-violet-600">{contacts.length}</span>
                </div>
              )}
              {dayMeetups.length > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-[10px] font-semibold text-blue-600">{dayMeetups.length}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-500" />
          <span className="text-xs text-gray-500 font-medium">Contacts met</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-500 font-medium">Meetups</span>
        </div>
      </div>

      {/* Needs confirmation — past meetups with no response */}
      {needsConfirmation.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold text-gray-800 mb-2">Needs Confirmation</p>
          <div className="space-y-2">
            {needsConfirmation.map((m) => {
                const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
                return (
                  <div key={m.id} className="bg-white rounded-xl border border-amber-200 shadow-sm px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-amber-600">{d.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{m.personName}</p>
                        <p className="text-xs text-gray-400">
                          {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {formatMeetupTime(m.date)}
                          {m.location ? ` · ${m.location}` : ""}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-gray-500">Did this meetup happen?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await updateMeetup(m.id, { completed: true });
                          setMeetups((prev) => prev.map((x) => x.id === m.id ? { ...x, completed: true } : x));
                        }}
                        className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        ✓ Yes, it happened
                      </button>
                      <button
                        onClick={async () => {
                          await updateMeetup(m.id, { completed: false });
                          setMeetups((prev) => prev.map((x) => x.id === m.id ? { ...x, completed: false } : x));
                        }}
                        className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        ✗ Didn't happen
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Upcoming meetups list */}
      {upcomingMeetups.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold text-gray-800 mb-2">Upcoming Meetups</p>
          <div className="space-y-2">
            {upcomingMeetups.map((m) => {
                const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
                return (
                  <div
                    key={m.id}
                    onClick={(e) => openEdit(m, e)}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-600">{d.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.personName}</p>
                      <p className="text-xs text-gray-400">
                        {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {formatMeetupTime(m.date)}
                        {m.location ? ` · ${m.location}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Meetup modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl md:rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">{modal.mode === "add" ? "Schedule Meetup" : "Edit Meetup"}</p>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <FiX size={20} />
              </button>
            </div>

            {/* Person picker */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Person *</label>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setForm((f) => ({ ...f, personId: "", personName: "" })); }}
                placeholder="Search contacts…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white"
              />
              {search && !form.personId && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm max-h-36 overflow-y-auto">
                  {filteredPeople.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setForm((f) => ({ ...f, personId: p.id, personName: p.name })); setSearch(p.name); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                    >
                      {p.name}
                    </button>
                  ))}
                  {filteredPeople.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No matches</p>}
                </div>
              )}
              {form.personId && (
                <p className="text-xs text-emerald-600 font-semibold">✓ {form.personName} selected</p>
              )}
            </div>

            {/* Date & time */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Date & Time *</label>
              <input
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            {/* Location */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Where are you meeting?"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="What to discuss, prayer points…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white resize-none"
              />
            </div>

            <div className="flex gap-2">
              {modal.mode === "edit" && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 transition-colors shrink-0"
                >
                  <FiTrash2 size={15} />
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !form.personId || !form.date}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {saving ? "Saving…" : modal.mode === "add" ? "Schedule" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
