"use client";

import { useEffect, useRef, useState, Suspense } from "react";
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
import { Button, Field, inputClass } from "@/components/ui";
import { toLocalDateStr, toDatetimeLocal, formatTime } from "@/lib/dates";
import { FiChevronLeft, FiChevronRight, FiPlus, FiX, FiTrash2, FiEdit3, FiCheck } from "react-icons/fi";

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
  // The day whose meetups are listed. On a laptop this is a panel beside the
  // month that stays open while a meetup is edited; on a phone it is the sheet
  // that `modal.mode === "day"` already drove.
  const [dayPanel, setDayPanel] = useState(null);
  const dayRef = useRef(null);
  const formRef = useRef(null);

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

  // The side panels can open below the fold (or under the month when the
  // columns stack). Bring them into view; on a phone they are fixed sheets and
  // this does nothing.
  useEffect(() => {
    if (modal && modal.mode !== "day") formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [modal]);
  useEffect(() => {
    if (dayPanel) dayRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [dayPanel]);

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
      // What came of the meeting, as counts rather than prose — the weekly
      // report's Connection Time section has no other source for these.
      metPrayed: !!meetup.metPrayed,
      metGospel: !!meetup.metGospel,
      metSaved: !!meetup.metSaved,
    });

  const patchMeetup = (id, patch) => {
    setMeetups((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
    setMonthMeetups((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
  };

  const handleHappened = async (meetup) => {
    setSaving(true);
    const record = {
      completed: true,
      outcomeNotes: outcome.outcomeNotes,
      metPrayed: outcome.metPrayed,
      metGospel: outcome.metGospel,
      metSaved: outcome.metSaved,
    };
    await updateMeetup(meetup.id, record);
    if (outcome.alsoFollowUp && meetup.personId) {
      // Meeting someone IS following them up — otherwise they stay "overdue"
      // on the follow-ups page right after you saw them.
      await updatePerson(meetup.personId, { lastFollowedUpAt: serverTimestamp() });
    }
    patchMeetup(meetup.id, record);
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

  const monthLabel = `${MONTHS[month]} ${year}`;
  const toDate = (m) => (m.date?.toDate ? m.date.toDate() : new Date(m.date));
  const whenLine = (m, d) =>
    `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${formatTime(m.date)}${m.location ? ` · ${m.location}` : ""}`;

  // Day panel: the phone sheet follows `modal`, the laptop panel follows
  // `dayPanel` and only while its month is the one on screen.
  const daySheetOpen = modal?.mode === "day" && !!dayPanel;
  const dayInView = !!dayPanel && dayPanel.dateStr.startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`);
  const dayPanelMeetups = dayPanel ? meetupsByDay[dayPanel.dateStr] || [] : [];
  const closeDay = () => {
    setDayPanel(null);
    if (modal?.mode === "day") setModal(null);
  };
  const formOpen = !!modal && modal.mode !== "day";
  const showSide = daySheetOpen || dayInView || formOpen || upcomingMeetups.length > 0;

  const legend = (
    <>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-[9px] w-[9px] rounded-full bg-role-cgl-ink" />
        Contacts met
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-[9px] w-[9px] rounded-full bg-brand" />
        Meetups
      </span>
    </>
  );

  return (
    <PageShell
      title="Calendar"
      rightAction={
        <Button className="max-md:shadow-none md:px-[18px]" onClick={() => openAdd("")}>
          <FiPlus size={17} aria-hidden="true" /> Schedule
        </Button>
      }
    >
      <Suspense fallback={null}>
        <QueryParamHandler setForm={setForm} setSearch={setSearch} setModal={setModal} />
      </Suspense>

      <div className="flex flex-col gap-2 text-[15px] md:flex-row md:flex-wrap md:items-start md:gap-5">
        <div className="flex min-w-0 flex-col gap-2 md:flex-[2_1_480px] md:gap-6">
          {/* Month */}
          <section aria-label="Month" className="flex flex-col gap-2 md:gap-2.5">
            <div className="flex items-center justify-between gap-2.5 md:flex-wrap md:justify-start">
              <button type="button" aria-label="Previous month" onClick={prevMonth} className={MONTH_BUTTON}>
                <FiChevronLeft size={18} aria-hidden="true" />
              </button>
              <h2 aria-live="polite" className="text-lg font-bold tracking-[-0.015em] md:min-w-[190px] md:text-center md:text-[22px] md:tracking-[-0.02em]">
                {monthLabel}
              </h2>
              <button type="button" aria-label="Next month" onClick={nextMonth} className={MONTH_BUTTON}>
                <FiChevronRight size={18} aria-hidden="true" />
              </button>
              <span className="hidden flex-1 md:block" />
              <span className="hidden items-center gap-4 text-[13px] text-muted md:inline-flex">{legend}</span>
            </div>

            {/* Day headers */}
            <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center text-[12.5px] font-bold md:gap-1.5 md:text-[13px]">
              {DAYS.map((d) => <span key={d}>{d}</span>)}
            </div>

            {/* Calendar grid */}
            <div role="group" aria-label={monthLabel} className="grid grid-cols-7 gap-1 md:gap-1.5">
              {Array.from({ length: totalCells }).map((_, i) => {
                const day = i - offset + 1;
                if (day < 1 || day > daysInMonth) {
                  return <div key={i} aria-hidden="true" className="h-11 rounded-xl bg-white ring-1 ring-inset ring-line-soft md:h-auto md:min-h-[84px] md:rounded-[14px]" />;
                }
                const pad = (n) => String(n).padStart(2, "0");
                const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                const contacts = peopleByDay[dateStr] || [];
                const dayMeetups = meetupsByDay[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                const isSelected = dayPanel?.dateStr === dateStr;
                const cellLabel = [
                  `${day} ${MONTHS[month]}`,
                  isToday && "today",
                  contacts.length > 0 && `${contacts.length} contacts met`,
                  dayMeetups.length > 0 && `${dayMeetups.length} ${dayMeetups.length === 1 ? "meetup" : "meetups"}`,
                ].filter(Boolean).join(", ");

                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={cellLabel}
                    aria-pressed={isSelected}
                    className={`flex h-11 flex-col items-center gap-px rounded-xl px-0.5 py-1 leading-[1.2] transition-colors md:h-auto md:min-h-[84px] md:items-stretch md:justify-between md:gap-1.5 md:rounded-[14px] md:p-2 md:text-left md:leading-normal ${
                      isToday
                        ? "bg-brand text-white hover:bg-navy md:bg-brand-soft md:text-ink md:hover:bg-role-contact"
                        : "bg-tint text-ink hover:bg-brand-soft"
                    } ${isSelected ? "md:ring-2 md:ring-inset md:ring-brand" : ""}`}
                    onClick={() => {
                      // A day with meetups shows them — previously a future meetup day
                      // opened the "Schedule" form, hiding what was already booked.
                      if (dayMeetups.length > 0) {
                        setModal({ mode: "day", dateStr, meetups: dayMeetups, hasContacts: contacts.length > 0 || isPast });
                        setDayPanel({ dateStr, hasContacts: contacts.length > 0 || isPast });
                      } else if (contacts.length > 0 || isPast) {
                        router.push(`/summary?date=${dateStr}`);
                      } else {
                        openAdd(dateStr);
                      }
                    }}
                  >
                    <span className={`text-sm font-bold md:inline-flex md:h-[26px] md:min-w-[26px] md:items-center md:justify-center md:self-start md:rounded-full md:px-1.5 ${isToday ? "md:bg-brand md:text-white" : ""}`}>
                      {day}
                    </span>

                    {/* Phone: dots and counts */}
                    <span className="flex gap-[5px] text-[11.5px] font-bold leading-[1.2] md:hidden">
                      {contacts.length > 0 && (
                        <span className={`inline-flex items-center gap-0.5 ${isToday ? "text-white" : "text-role-cgl-ink"}`}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                          {contacts.length}
                        </span>
                      )}
                      {dayMeetups.length > 0 && (
                        <span className={`inline-flex items-center gap-0.5 ${isToday ? "text-white" : "text-brand"}`}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                          {dayMeetups.length}
                        </span>
                      )}
                    </span>

                    {/* Laptop: count pills */}
                    <span className="hidden min-h-[22px] flex-wrap gap-1 md:flex">
                      {contacts.length > 0 && (
                        <span className="inline-flex h-[22px] items-center gap-[5px] rounded-full bg-role-cgl px-2 text-[12.5px] font-bold text-role-cgl-ink">
                          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
                          {contacts.length}
                        </span>
                      )}
                      {dayMeetups.length > 0 && (
                        <span className="inline-flex h-[22px] items-center gap-[5px] rounded-full bg-role-contact px-2 text-[12.5px] font-bold text-brand">
                          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
                          {dayMeetups.length}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Legend (phone; on laptop it sits beside the month) */}
            <div className="flex items-center gap-4 text-[13px] text-muted md:hidden">{legend}</div>
          </section>

          {/* Needs confirmation — past meetups with no response */}
          {needsConfirmation.length > 0 && (
            <section className="mt-1 flex flex-col gap-1.5 md:mt-0 md:gap-2.5">
              <h2 className="text-[15px] font-bold md:text-[17px] md:tracking-[-0.015em]">
                Needs confirmation <span className="font-medium text-muted">{needsConfirmation.length}</span>
              </h2>
              {needsConfirmation.map((m) => {
                const d = toDate(m);
                const open = outcome?.meetupId === m.id;
                return (
                  <div key={m.id} className="flex flex-col gap-2 rounded-[20px] bg-tint px-3 pb-3 pt-2.5 md:gap-3 md:px-4 md:pb-4 md:pt-3.5">
                    <div className="flex items-center gap-3">
                      <DateTile date={d} tone="warn" />
                      <div className="min-w-0 flex-1">
                        <p className={PERSON_NAME}>{m.personName}</p>
                        <p className="truncate text-[13px] text-muted md:whitespace-normal">{whenLine(m, d)}</p>
                      </div>
                      {open && (
                        <span className={`hidden h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold md:inline-flex ${outcome.happened ? "bg-ok-soft text-ok-ink" : "bg-line-soft text-ink"}`}>
                          {outcome.happened ? <FiCheck size={14} aria-hidden="true" /> : <FiX size={14} aria-hidden="true" />}
                          {outcome.happened ? "It happened" : "Didn't happen"}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={(e) => openEdit(m, e)}
                        title="Edit meetup"
                        aria-label={`Edit meetup with ${m.personName}`}
                      >
                        <FiEdit3 size={17} aria-hidden="true" />
                      </Button>
                    </div>

                    {!open && (
                      <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
                        <p className="w-full text-[13px] font-semibold md:w-auto md:flex-[1_1_200px] md:text-[15px]">Did this meetup happen?</p>
                        <button
                          type="button"
                          onClick={() => openOutcome(m, true)}
                          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-ok-soft px-2 text-sm font-semibold text-ok-ink transition-colors hover:bg-role-disciple md:flex-none md:gap-2 md:px-4 md:text-[15px]"
                        >
                          <FiCheck aria-hidden="true" className={ANSWER_ICON} /> Yes, it happened
                        </button>
                        <Button
                          variant="outline"
                          className="flex-1 max-md:gap-1.5 max-md:px-2 max-md:text-sm md:flex-none"
                          onClick={() => openOutcome(m, false)}
                        >
                          <FiX aria-hidden="true" className={ANSWER_ICON} /> Didn&apos;t happen
                        </Button>
                      </div>
                    )}

                    {open && outcome.happened && (
                      <>
                        <Field label="How did it go?">
                          <textarea
                            value={outcome.outcomeNotes}
                            onChange={(e) => setOutcome((o) => ({ ...o, outcomeNotes: e.target.value }))}
                            rows={3}
                            placeholder="What you talked about, prayer points, next steps…"
                            className={TEXTAREA}
                          />
                        </Field>
                        <div role="group" aria-label="What came of the meeting" className="flex flex-wrap gap-x-5 gap-y-1">
                          {[
                            ["metPrayed", "Prayed for them"],
                            ["metGospel", "Shared the gospel"],
                            ["metSaved", "Received salvation"],
                          ].map(([key, label]) => (
                            <label key={key} className={CHECK_LABEL}>
                              <input
                                type="checkbox"
                                checked={outcome[key]}
                                onChange={(e) => setOutcome((o) => ({ ...o, [key]: e.target.checked }))}
                                className="h-5 w-5 shrink-0 accent-brand"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <label className={`${CHECK_LABEL} basis-full md:flex-[1_1_260px]`}>
                            <input
                              type="checkbox"
                              checked={outcome.alsoFollowUp}
                              onChange={(e) => setOutcome((o) => ({ ...o, alsoFollowUp: e.target.checked }))}
                              className="h-5 w-5 shrink-0 accent-brand"
                            />
                            Also mark {m.personName} as followed up
                          </label>
                          <Button variant="outline" className="flex-1 md:flex-none" onClick={() => setOutcome(null)} disabled={saving}>
                            Cancel
                          </Button>
                          <Button className={`${FLAT} flex-2 md:flex-none md:px-6`} onClick={() => handleHappened(m)} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </>
                    )}

                    {open && !outcome.happened && (
                      <>
                        <div className="flex flex-wrap items-end gap-2.5">
                          <Field label="Reschedule to" className="basis-full md:flex-[1_1_240px]">
                            <input
                              type="datetime-local"
                              value={outcome.newDate}
                              onChange={(e) => setOutcome((o) => ({ ...o, newDate: e.target.value }))}
                              className={`${INPUT} min-w-0`}
                            />
                          </Field>
                          <Button variant="outline" className="flex-1 md:flex-none" onClick={() => setOutcome(null)} disabled={saving}>
                            Cancel
                          </Button>
                          <Button className={`${FLAT} flex-2 md:flex-none md:px-5`} onClick={() => handleMissed(m)} disabled={saving}>
                            {saving ? "Saving…" : outcome.newDate ? "Reschedule" : "Delete meetup"}
                          </Button>
                        </div>
                        <p className="text-[13px] text-muted">
                          This meetup gets deleted either way. A new date books a fresh meetup.
                          {outcome.newDate && " Leave the date empty and the button reads Delete meetup."}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </div>

        {/* Side column: selected day, meetup form, upcoming. On a phone the
            first two are bottom sheets and only the list sits in the page. */}
        {showSide && (
          <div className="flex min-w-0 flex-col md:flex-[1_1_300px] md:gap-4">
            {/* Selected day — what's already booked on a day you tapped */}
            {(daySheetOpen || dayInView) && (
              <div
                className={`${daySheetOpen ? SHEET_WRAP : "max-md:hidden"} ${dayInView ? "md:static md:z-auto md:block" : "md:hidden"}`}
              >
                <div className={SHEET_BACKDROP} onClick={closeDay} />
                <section
                  ref={dayRef}
                  role="dialog"
                  aria-label="Meetups on this day"
                  className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-t-[28px] bg-brand-soft md:max-h-none md:max-w-none md:gap-2.5 md:rounded-3xl md:px-[18px] md:pb-[18px] md:pt-4"
                >
                  <div className="flex shrink-0 items-center justify-between gap-2.5 px-5 pb-2 pt-4 md:p-0">
                    <h2 className="text-[17px] font-bold tracking-[-0.015em]">
                      {new Date(dayPanel.dateStr + "T00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                    </h2>
                    <button type="button" aria-label="Close day" onClick={closeDay} className={`${CLOSE_BUTTON} bg-white hover:bg-tint`}>
                      <FiX size={17} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-1 md:flex-none md:overflow-visible md:p-0">
                    {dayPanelMeetups.map((m) => {
                      const editing = modal?.mode === "edit" && modal.meetup.id === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          aria-current={editing ? "true" : undefined}
                          onClick={(e) => openEdit(m, e)}
                          className={`flex w-full items-start gap-3 rounded-2xl bg-white px-3 py-2.5 text-left transition-colors hover:bg-tint ${editing ? "md:ring-2 md:ring-inset md:ring-brand" : ""}`}
                        >
                          <span aria-hidden="true" className="inline-flex h-10 w-[52px] shrink-0 items-center justify-center rounded-xl bg-brand-soft text-[13px] font-bold tabular-nums text-brand">
                            {formatTime(m.date).split(" ")[0]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="min-w-0 font-semibold">{m.personName}</span>
                              {m.completed === true && (
                                <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-ok-soft px-[9px] text-xs font-semibold text-ok-ink">Done</span>
                              )}
                              {m.completed === false && (
                                <span className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full bg-warn-soft px-[9px] text-xs font-semibold text-warn-ink">
                                  <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-warn" />
                                  Missed
                                </span>
                              )}
                            </span>
                            <span className="block text-[13px] text-muted">
                              {formatTime(m.date)}{m.location ? ` · ${m.location}` : ""}
                            </span>
                            {m.outcomeNotes && (
                              <span className="mt-1 block text-[13px] text-ink-2 max-md:line-clamp-2">{m.outcomeNotes}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                    {dayPanelMeetups.length === 0 && (
                      <p className="flex min-h-11 items-center text-[13px] text-muted">No meetups on this day</p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2 px-5 pb-8 pt-3 md:mt-0.5 md:flex-wrap md:p-0">
                    {dayPanel.hasContacts && (
                      <Button variant="outline" className="flex-auto px-3.5" onClick={() => router.push(`/summary?date=${dayPanel.dateStr}`)}>
                        Daily summary
                      </Button>
                    )}
                    <Button className={`${FLAT} flex-auto px-3.5`} onClick={() => openAdd(dayPanel.dateStr)}>
                      Schedule another
                    </Button>
                  </div>
                </section>
              </div>
            )}

            {/* Meetup form */}
            {formOpen && (
              <div className={`${SHEET_WRAP} md:static md:z-auto md:block`}>
                <div className={SHEET_BACKDROP} onClick={() => setModal(null)} />
                <section
                  ref={formRef}
                  role="dialog"
                  aria-label={modal.mode === "add" ? "Schedule meetup" : "Edit meetup"}
                  className="relative flex max-h-[85vh] w-full max-w-md flex-col gap-3 rounded-t-[28px] bg-white pb-7 pt-[18px] md:max-h-none md:max-w-none md:gap-3.5 md:rounded-3xl md:px-[18px] md:pb-[18px] md:pt-4 md:shadow-card"
                >
                  {/* Header */}
                  <div className="flex shrink-0 items-center justify-between gap-2.5 px-5 md:px-0">
                    <h2 className="text-xl font-bold tracking-[-0.02em] md:text-[17px] md:tracking-[-0.015em]">
                      {modal.mode === "add" ? "Schedule meetup" : "Edit meetup"}
                    </h2>
                    <button type="button" aria-label="Close form" onClick={() => setModal(null)} className={`${CLOSE_BUTTON} bg-fill hover:bg-line-soft`}>
                      <FiX size={18} aria-hidden="true" className="md:h-[17px] md:w-[17px]" />
                    </button>
                  </div>

                  {/* Fields (they scroll inside the sheet on a phone) */}
                  <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-0.5 md:flex-none md:gap-3.5 md:overflow-visible md:p-0">
                    {/* Person picker */}
                    <div className="flex flex-col gap-1 md:gap-1.5">
                      <Field label="Person *">
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => { setSearch(e.target.value); setForm((f) => ({ ...f, personId: "", personName: "" })); }}
                          placeholder="Search contacts…"
                          className={INPUT}
                        />
                      </Field>
                      {search && !form.personId && (
                        <div className="flex flex-col rounded-[14px] bg-white p-1 shadow-[0_8px_30px_rgb(20_30_60/0.12),0_0_0_1px_var(--color-line)]">
                          {filteredPeople.slice(0, 6).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setForm((f) => ({ ...f, personId: p.id, personName: p.name })); setSearch(p.name); }}
                              className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left font-medium text-ink hover:bg-brand-soft"
                            >
                              {p.name}
                            </button>
                          ))}
                          {filteredPeople.length === 0 && <p role="status" className="flex min-h-11 items-center px-3 text-muted">No matches</p>}
                        </div>
                      )}
                      {form.personId && (
                        <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok-ink">
                          <FiCheck size={14} aria-hidden="true" /> {form.personName} selected
                        </p>
                      )}
                    </div>

                    {/* Date & time */}
                    <Field label="Date & time *">
                      <input
                        type="datetime-local"
                        value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                        className={`${INPUT} min-w-0`}
                      />
                    </Field>

                    {/* Location */}
                    <Field label="Location">
                      <input
                        type="text"
                        value={form.location}
                        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="Where are you meeting?"
                        className={INPUT}
                      />
                    </Field>

                    {/* Notes */}
                    <Field label="Notes">
                      <textarea
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        rows={2}
                        placeholder="What to discuss, prayer points…"
                        className={TEXTAREA}
                      />
                    </Field>
                  </div>

                  {/* Actions */}
                  <div className="mt-1 flex shrink-0 items-center gap-2.5 px-5 md:mt-0 md:px-0">
                    {modal.mode === "edit" && (
                      <button type="button" aria-label="Delete meetup" onClick={handleDelete} disabled={saving} className={DELETE_BUTTON}>
                        <FiTrash2 size={17} aria-hidden="true" />
                      </button>
                    )}
                    <Button
                      className="flex-1 disabled:shadow-none max-md:h-12 max-md:rounded-2xl max-md:text-base max-md:shadow-none"
                      onClick={handleSave}
                      disabled={saving || !form.personId || !form.date}
                    >
                      {saving ? "Saving…" : modal.mode === "add" ? "Schedule" : "Save changes"}
                    </Button>
                  </div>
                </section>
              </div>
            )}

            {/* Upcoming meetups list */}
            {upcomingMeetups.length > 0 && (
              <section aria-label="Upcoming meetups" className="flex min-w-0 flex-col md:gap-0.5 md:rounded-3xl md:bg-white md:px-[18px] md:pb-2 md:pt-4 md:shadow-card">
                <div className="flex items-center justify-between gap-2.5">
                  <h2 className="text-[15px] font-bold md:text-[17px] md:tracking-[-0.015em]">Upcoming meetups</h2>
                  <button
                    type="button"
                    onClick={() => router.push("/meetings")}
                    className="-my-1.5 inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:text-navy md:my-0"
                  >
                    See all
                  </button>
                </div>
                {upcomingMeetups.map((m) => {
                  const d = toDate(m);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={(e) => openEdit(m, e)}
                      className="-mx-2 flex min-h-[52px] items-center gap-3 rounded-2xl px-2 text-left transition-colors hover:bg-tint md:min-h-[60px]"
                    >
                      <DateTile date={d} />
                      <span className="min-w-0 flex-1">
                        <span className={`block ${PERSON_NAME}`}>{m.personName}</span>
                        <span className="block truncate text-[13px] text-muted">{whenLine(m, d)}</span>
                      </span>
                    </button>
                  );
                })}
              </section>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}

const MONTH_BUTTON =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-fill text-ink transition-colors hover:bg-line-soft";
const CLOSE_BUTTON =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-ink transition-colors";
const DELETE_BUTTON =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-warn-ink ring-1 ring-line transition-colors hover:bg-warn-soft disabled:cursor-not-allowed disabled:opacity-50";
const CHECK_LABEL = "inline-flex min-h-11 cursor-pointer items-center gap-2 font-medium";
// Phone: 16px name on a tighter line. Laptop: the 15px body size.
const PERSON_NAME = "text-base font-semibold leading-[1.35] md:text-[15px] md:leading-normal";
// Inputs are 48px/16px on a phone (no zoom on focus) and 44px/15px on a laptop.
const INPUT = `${inputClass} font-normal md:min-h-11 md:text-[15px]`;
const TEXTAREA = `${INPUT} resize-none py-2.5 md:resize-y`;
// The boards keep the brand shadow for the page's main button only.
const FLAT = "shadow-none!";
const ANSWER_ICON = "h-[15px] w-[15px] shrink-0 md:h-4 md:w-4";
// A bottom sheet on a phone; the same element sits in the side column on a laptop.
const SHEET_WRAP = "fixed inset-0 z-60 flex items-end justify-center";
const SHEET_BACKDROP = "absolute inset-0 bg-ink/40 md:hidden";

// Square date badge beside a meetup: short month over the day number.
function DateTile({ date, tone = "brand" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[14px] leading-[1.1] ${
        tone === "warn" ? "bg-warn-soft text-warn-ink" : "bg-brand-soft text-brand"
      }`}
    >
      <span className="text-[11.5px] font-semibold uppercase">{date.toLocaleDateString([], { month: "short" })}</span>
      <span className="text-base font-bold">{date.getDate()}</span>
    </span>
  );
}
