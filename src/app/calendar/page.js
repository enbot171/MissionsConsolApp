"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  getPeopleByAssigneeForMonth,
  getMeetupsByAssignee,
  getMeetupsForMonth,
  getMeetup,
  getPeopleByAssignee,
  addMeetup,
  updateMeetup,
  updatePerson,
  deleteMeetup,
} from "@/lib/firestore";
import { serverTimestamp } from "firebase/firestore";
import { callApi } from "@/lib/google/client";
import PageShell from "@/components/PageShell";
import { toLocalDateStr, toDatetimeLocal, formatTime } from "@/lib/dates";
import { FiChevronLeft, FiChevronRight, FiPlus, FiX, FiTrash2, FiEdit3 } from "react-icons/fi";

// Google is best-effort: a sync failure must never block the meetup itself.
const pushToGoogle = (meetupId, action) =>
  callApi("/api/google/sync", { meetupId, action }).catch(() => {});

// How far back the confirmation/upcoming lists look. Bounds the read so the page
// doesn't scan every meetup ever created.
const CONFIRM_WINDOW_DAYS = 120;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function QueryParamHandler({ setForm, setSearch, setModal }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const scheduleFor = searchParams.get("scheduleFor");
    const name = searchParams.get("name");
    if (scheduleFor && name) {
      setForm({ personId: scheduleFor, personName: name, date: "", location: "", notes: "" });
      setSearch(name);
      setModal({ mode: "add" });
      router.replace("/calendar");
      return;
    }
    // Deep link from a person's Meetings tab — open that meetup for editing.
    const editId = searchParams.get("editMeetup");
    if (editId) {
      getMeetup(editId).then((m) => {
        if (!m) return;
        setForm({
          personId: m.personId || "",
          personName: m.personName || "",
          date: toDatetimeLocal(m.date),
          location: m.location || "",
          notes: m.notes || "",
        });
        setSearch(m.personName || "");
        setModal({ mode: "edit", meetup: m });
      });
      router.replace("/calendar");
    }
  }, [searchParams]);
  return null;
}

export default function CalendarPage() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [peopleByDay, setPeopleByDay] = useState({});
  const [monthMeetups, setMonthMeetups] = useState([]);
  const [meetups, setMeetups] = useState([]);
  const [myPeople, setMyPeople] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ personId: "", personName: "", date: "", location: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState(null);

  const windowStart = () => {
    const d = new Date();
    d.setDate(d.getDate() - CONFIRM_WINDOW_DAYS);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const reloadLists = async () => {
    const recent = await getMeetupsByAssignee(user.uid, { since: windowStart() });
    setMeetups(recent);
    return recent;
  };

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPeopleByAssigneeForMonth(user.uid, year, month),
      getMeetupsForMonth(user.uid, year, month),
      getMeetupsByAssignee(user.uid, { since: windowStart() }),
      getPeopleByAssignee(user.uid),
    ]).then(([monthPeople, thisMonthMeetups, recentMeetups, allPeople]) => {
      const byDay = {};
      monthPeople.forEach((p) => {
        const ds = toLocalDateStr(p.createdAt);
        if (ds) { if (!byDay[ds]) byDay[ds] = []; byDay[ds].push(p); }
      });
      setPeopleByDay(byDay);
      setMonthMeetups(thisMonthMeetups);
      setMeetups(recentMeetups);
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
  monthMeetups.forEach((m) => {
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
      const newId = await addMeetup({ ...form, assignedTo: user.uid, teamId: profile?.teamId || "" });
      pushToGoogle(newId, "upsert");
    } else {
      await updateMeetup(modal.meetup.id, form);
      pushToGoogle(modal.meetup.id, "upsert");
    }
    await Promise.all([
      reloadLists(),
      getMeetupsForMonth(user.uid, year, month).then(setMonthMeetups),
    ]);
    setModal(null);
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    // The route reads googleEventId off the doc, so push before it's gone.
    await pushToGoogle(modal.meetup.id, "delete");
    await deleteMeetup(modal.meetup.id);
    setMeetups((prev) => prev.filter((m) => m.id !== modal.meetup.id));
    setMonthMeetups((prev) => prev.filter((m) => m.id !== modal.meetup.id));
    setModal(null);
    setSaving(false);
  };

  // ── Meetup outcome ──────────────────────────────────────────────────────────
  // "Did this happen?" is one action with a record attached, not a bare boolean:
  // happened → capture what came of it and stamp the person as followed up;
  // missed → offer a new date on the spot instead of leaving a dead end.

  const openOutcome = (meetup, happened) =>
    setOutcome({
      meetupId: meetup.id,
      happened,
      outcomeNotes: meetup.outcomeNotes || "",
      alsoFollowUp: true,
      newDate: "",
    });

  const patchMeetup = (id, patch) => {
    setMeetups((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
    setMonthMeetups((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
  };

  const handleHappened = async (meetup) => {
    setSaving(true);
    await updateMeetup(meetup.id, { completed: true, outcomeNotes: outcome.outcomeNotes });
    if (outcome.alsoFollowUp && meetup.personId) {
      // Meeting someone IS following them up — otherwise they stay "overdue"
      // on the follow-ups page right after you saw them.
      await updatePerson(meetup.personId, { lastFollowedUpAt: serverTimestamp() });
    }
    patchMeetup(meetup.id, { completed: true, outcomeNotes: outcome.outcomeNotes });
    setOutcome(null);
    setSaving(false);
  };

  // A meetup that didn't happen isn't a record worth keeping — delete it.
  // A new date is just a new meetup, with no link back to the deleted one.
  const handleMissed = async (meetup) => {
    setSaving(true);
    // The route reads googleEventId off the doc, so push before it's gone.
    await pushToGoogle(meetup.id, "delete");
    await deleteMeetup(meetup.id);
    if (outcome.newDate) {
      const newId = await addMeetup({
        personId: meetup.personId,
        personName: meetup.personName,
        date: outcome.newDate,
        location: meetup.location || "",
        notes: meetup.notes || "",
        assignedTo: user.uid,
        teamId: profile?.teamId || "",
      });
      pushToGoogle(newId, "upsert");
    }
    await Promise.all([
      reloadLists(),
      getMeetupsForMonth(user.uid, year, month).then(setMonthMeetups),
    ]);
    setOutcome(null);
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
      <Suspense fallback={null}>
        <QueryParamHandler setForm={setForm} setSearch={setSearch} setModal={setModal} />
      </Suspense>

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
                // A day with meetups shows them — previously a future meetup day
                // opened the "Schedule" form, hiding what was already booked.
                if (dayMeetups.length > 0) {
                  setModal({ mode: "day", dateStr, meetups: dayMeetups, hasContacts: contacts.length > 0 || isPast });
                } else if (contacts.length > 0 || isPast) {
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
                const open = outcome?.meetupId === m.id;
                return (
                  <div key={m.id} className="bg-white rounded-xl border border-amber-200 shadow-sm px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-amber-600">{d.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{m.personName}</p>
                        <p className="text-xs text-gray-400">
                          {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {formatTime(m.date)}
                          {m.location ? ` · ${m.location}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={(e) => openEdit(m, e)}
                        title="Edit meetup"
                        className="shrink-0 w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center hover:bg-gray-100 transition-colors"
                      >
                        <FiEdit3 size={12} />
                      </button>
                    </div>

                    {!open && (
                      <>
                        <p className="text-xs font-semibold text-gray-500">Did this meetup happen?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openOutcome(m, true)}
                            className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          >
                            ✓ Yes, it happened
                          </button>
                          <button
                            onClick={() => openOutcome(m, false)}
                            className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors"
                          >
                            ✗ Didn't happen
                          </button>
                        </div>
                      </>
                    )}

                    {open && outcome.happened && (
                      <div className="space-y-2 pt-1">
                        <label className="text-xs font-semibold text-gray-700">How did it go?</label>
                        <textarea
                          value={outcome.outcomeNotes}
                          onChange={(e) => setOutcome((o) => ({ ...o, outcomeNotes: e.target.value }))}
                          rows={3}
                          placeholder="What you talked about, prayer points, next steps…"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:border-blue-500 resize-none"
                        />
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={outcome.alsoFollowUp}
                            onChange={(e) => setOutcome((o) => ({ ...o, alsoFollowUp: e.target.checked }))}
                            className="w-4 h-4 accent-emerald-600"
                          />
                          <span className="text-xs text-gray-700 font-medium">
                            Also mark {m.personName} as followed up
                          </span>
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setOutcome(null)}
                            disabled={saving}
                            className="flex-1 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleHappened(m)}
                            disabled={saving}
                            className="flex-2 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    )}

                    {open && !outcome.happened && (
                      <div className="space-y-2 pt-1">
                        <label className="text-xs font-semibold text-gray-700">Reschedule to</label>
                        <input
                          type="datetime-local"
                          value={outcome.newDate}
                          onChange={(e) => setOutcome((o) => ({ ...o, newDate: e.target.value }))}
                          className="w-full min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:border-blue-500"
                        />
                        <p className="text-[11px] text-gray-400">
                          This meetup gets deleted either way. A new date books a fresh meetup.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setOutcome(null)}
                            disabled={saving}
                            className="flex-1 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleMissed(m)}
                            disabled={saving}
                            className="flex-2 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                          >
                            {saving ? "Saving…" : outcome.newDate ? "Reschedule" : "Delete meetup"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Upcoming meetups list */}
      {upcomingMeetups.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-800">Upcoming Meetups</p>
            <button onClick={() => router.push("/meetings")} className="text-xs font-semibold text-blue-600">
              See all →
            </button>
          </div>
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
                        {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {formatTime(m.date)}
                        {m.location ? ` · ${m.location}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Day modal — what's already booked on a day you tapped */}
      {modal?.mode === "day" && (
        <div className="fixed inset-0 z-60 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl md:rounded-2xl shadow-xl flex flex-col" style={{ maxHeight: "85vh" }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-2 shrink-0">
              <p className="font-bold text-gray-900">
                {new Date(modal.dateStr + "T00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <FiX size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 px-6 py-2 space-y-2">
              {modal.meetups.map((m) => (
                <div
                  key={m.id}
                  onClick={(e) => openEdit(m, e)}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-blue-600">{formatTime(m.date).split(" ")[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{m.personName}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {formatTime(m.date)}{m.location ? ` · ${m.location}` : ""}
                    </p>
                    {m.outcomeNotes && (
                      <p className="mt-1 pl-2 border-l-2 border-emerald-400 text-xs text-gray-600 italic line-clamp-2">
                        {m.outcomeNotes}
                      </p>
                    )}
                  </div>
                  {m.completed === true && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">Done</span>
                  )}
                  {m.completed === false && (
                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">Missed</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 px-6 py-4 pb-8 md:pb-4 shrink-0 border-t border-gray-100">
              {modal.hasContacts && (
                <button
                  onClick={() => router.push(`/summary?date=${modal.dateStr}`)}
                  className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Daily summary
                </button>
              )}
              <button
                onClick={() => openAdd(modal.dateStr)}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                Schedule another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meetup modal */}
      {modal && modal.mode !== "day" && (
        <div className="fixed inset-0 z-60 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl md:rounded-2xl shadow-xl flex flex-col" style={{ maxHeight: "85vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2 shrink-0">
              <p className="font-bold text-gray-900">{modal.mode === "add" ? "Schedule Meetup" : "Edit Meetup"}</p>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <FiX size={20} />
              </button>
            </div>

            {/* Scrollable fields */}
            <div className="overflow-y-auto flex-1 min-h-0 px-6 py-2 space-y-4">
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
            </div>

            {/* Pinned action buttons */}
            <div className="flex gap-2 px-6 py-4 pb-8 md:pb-4 shrink-0 border-t border-gray-100">
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
