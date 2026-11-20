"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  FiCheck, FiChevronLeft, FiChevronRight, FiEdit2, FiMinus, FiPlus, FiStar, FiTrash2,
} from "react-icons/fi";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { confirmLeave, useLeaveGuard } from "@/hooks/useLeaveGuard";
import {
  EVENT_GONE, countEventAttendance, deleteEvent, getAttendanceByEvent, getEvent, getTeamPeopleAndNoContact,
  resumeEvent, saveEventAttendance, stopEvent, updateEvent,
} from "@/lib/firestore";
import {
  addDays, attendanceChanges, attendanceDetail, attendanceTotal, describeEvent, eventDates,
  formatEventDay, isDateStr, isWeekly, occurrencesBetween, repeatLabel,
} from "@/lib/events";
import { toDateInput } from "@/lib/dates";
import PageShell from "@/components/PageShell";
import SearchBar from "@/components/SearchBar";
import Spinner from "@/components/Spinner";
import EventForm, { EventFormPanel } from "@/components/EventForm";
import { Avatar, Banner, Button } from "@/components/ui";

const iconButton =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-fill text-ink transition-colors hover:bg-line-soft disabled:opacity-40";

const byName = (a, b) => (a.name || "").localeCompare(b.name || "");

function EventDetail() {
  const { id } = useParams();
  const router = useRouter();
  const wantedDate = useSearchParams().get("date");
  const { loading: authLoading, user } = useRequireAuth();

  const [event, setEvent] = useState(null);
  const [people, setPeople] = useState([]);
  const [records, setRecords] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // `picked` is the date chosen by hand; until then the page works one out.
  // `draft` holds ticks and walk-ins not saved yet, together with the date they
  // are for. It only applies while that date is on screen, so unsaved ticks can
  // never end up saved against a different date.
  const [picked, setPicked] = useState("");
  const [draft, setDraft] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { tone, text }

  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);

  const today = toDateInput(new Date());

  useEffect(() => {
    if (authLoading) return;
    let current = true;
    (async () => {
      const ev = await getEvent(id);
      if (!ev) return { ev };
      const [team, att] = await Promise.all([getTeamPeopleAndNoContact(ev.teamId), getAttendanceByEvent(id)]);
      return { ev, team, att };
    })()
      .then(({ ev, team, att }) => {
        if (!current) return;
        if (ev) {
          setPeople(team.people.sort(byName));
          setRecords(att);
        }
        setEvent(ev);
        setLoadFailed(false);
      })
      .catch(() => { if (current) setLoadFailed(true); })
      .finally(() => { if (current) setFetching(false); });
    return () => { current = false; };
  }, [authLoading, id, attempt]);

  const retry = () => { setFetching(true); setAttempt((n) => n + 1); };

  const recordFor = useCallback((d) => records.find((r) => r.dateStr === d) || null, [records]);

  // Dates you can step through: from the first date (or the earliest saved one)
  // up to a week ahead, plus the date asked for in the link.
  const dates = useMemo(() => {
    if (!event) return [];
    const saved = records.map((r) => r.dateStr);
    const from = [event.dateStr, ...saved].sort()[0];
    const all = eventDates(event, saved, from, addDays(today, 7));
    // A one-off event in the future is still its own date.
    if (all.length === 0 && isDateStr(event.dateStr)) all.push(event.dateStr);
    // A date from a link counts only if the event really falls on it (or it
    // already has a record), so a hand-edited link cannot open a stray date.
    if (isDateStr(wantedDate) && !all.includes(wantedDate)
      && occurrencesBetween(event, wantedDate, wantedDate).length > 0) all.push(wantedDate);
    return all.sort();
  }, [event, records, today, wantedDate]);

  const showDate = (d) => {
    setPicked(d);
    setDraft(null);
    setNotice(null);
  };

  // Until a date is picked: the one in the link, else the latest that has happened.
  // A picked date that an edit has since moved off the list is let go of.
  const pastDates = dates.filter((d) => d <= today);
  const dateStr = (picked && dates.includes(picked) && picked)
    || (dates.includes(wantedDate) ? wantedDate : pastDates[pastDates.length - 1] || dates[0] || "");

  const loaded = recordFor(dateStr);
  const ownDraft = draft?.dateStr === dateStr ? draft : null;
  const present = ownDraft?.present ?? loaded?.present ?? [];
  const walkIns = ownDraft?.walkIns ?? (Number(loaded?.walkIns) || 0);
  const changes = attendanceChanges(loaded, present, walkIns);
  const dirty = changes.ticked.length > 0 || changes.unticked.length > 0 || changes.walkInsDelta !== 0;
  useLeaveGuard(dirty, "You have unsaved attendance. Leave without saving?");

  if (authLoading) return null;

  const shell = (children) => (
    <PageShell title={<span className="sr-only">Event</span>} backHref="/events" backLabel="Events">
      {children}
    </PageShell>
  );

  if (fetching) return shell(<Spinner />);
  if (loadFailed) {
    return shell(
      <Banner tone="error" className="flex flex-wrap items-center justify-between gap-3">
        Could not load this event.
        <Button variant="outline" onClick={retry}>Try again</Button>
      </Banner>
    );
  }
  if (!event) {
    return shell(
      <div className="flex flex-col items-center gap-1.5 rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-line-soft">
        <p className="text-[17px] font-bold tracking-[-0.015em]">Event not found.</p>
        <p className="text-sm text-muted">It may have been deleted.</p>
        <Link href="/events" className="mt-3 inline-flex h-11 items-center justify-center rounded-[14px] bg-brand px-[18px] font-semibold text-white transition-colors hover:bg-navy">
          Back to Events
        </Link>
      </div>
    );
  }

  const index = dates.indexOf(dateStr);
  const step = (by) => {
    const next = dates[index + by];
    if (next && confirmLeave()) showDate(next);
  };

  // Edits wait while a save is running: the save sends the changes as they were
  // when it started, and anything changed meanwhile would be dropped with the draft.
  const toggle = (pid) => {
    if (saving) return;
    setNotice(null);
    setDraft({ dateStr, present: present.includes(pid) ? present.filter((x) => x !== pid) : [...present, pid], walkIns });
  };
  const setWalk = (n) => {
    if (saving) return;
    setNotice(null);
    setDraft({ dateStr, present, walkIns: Math.max(0, Math.min(9999, Number.isFinite(n) ? Math.round(n) : 0)) });
  };

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const saved = await saveEventAttendance(event, dateStr, changes, user.uid);
      setRecords((rs) => [saved, ...rs.filter((r) => r.dateStr !== dateStr)].sort((a, b) => (a.dateStr < b.dateStr ? 1 : -1)));
      // Someone else may have ticked people in the meantime: dropping the draft
      // shows the merged record that was actually saved.
      setPicked(dateStr);
      setDraft(null);
      setNotice({ tone: "success", text: `Saved. ${attendanceTotal(saved)} came on ${formatEventDay(dateStr)}.` });
    } catch (err) {
      setNotice({
        tone: "error",
        text: err?.message === EVENT_GONE
          ? "This event has been deleted, so attendance cannot be saved."
          : "Could not save attendance. Check your connection and try again.",
      });
    }
    setSaving(false);
  };

  const handleEdit = async (data) => {
    const updated = await updateEvent(event, data);
    setEvent(updated);
    setRecords((rs) => rs.map((r) => ({ ...r, eventName: updated.name, isService: updated.isService })));
    setEditing(false);
  };

  const run = async (action, failText) => {
    setWorking(true);
    setNotice(null);
    try {
      await action();
    } catch {
      setNotice({ tone: "error", text: failText });
    }
    setWorking(false);
  };

  const handleStop = () => {
    if (!window.confirm(`Stop repeating "${event.name}" after today? Everything already recorded is kept.`)) return;
    run(async () => {
      await stopEvent(event.id, today);
      setEvent((e) => ({ ...e, endedOn: today }));
    }, "Could not stop the event. Try again.");
  };

  const handleResume = () =>
    run(async () => {
      await resumeEvent(event.id);
      setEvent((e) => ({ ...e, endedOn: null }));
    }, "Could not resume the event. Try again.");

  const handleDelete = () =>
    run(async () => {
      const n = await countEventAttendance(event.id);
      const what = n === 0
        ? "No attendance has been recorded for it."
        : `Its ${n} attendance record${n === 1 ? "" : "s"} will be deleted too, and the weekly report and people's pages will stop counting them.`;
      if (!window.confirm(`Delete "${event.name}"? ${what} This cannot be undone.`)) return;
      if (!confirmLeave()) return;
      await deleteEvent(event.id);
      router.push("/events");
    }, "Could not delete the event. Nothing may have been removed; try again.");

  const visibleIds = new Set(people.map((p) => p.id));
  const hiddenTicked = present.filter((pid) => !visibleIds.has(pid)).length;
  const q = search.trim().toLowerCase();
  const shown = q ? people.filter((p) => (p.name || "").toLowerCase().includes(q)) : people;

  const total = present.length + walkIns;
  const summary = `${attendanceDetail({ present, walkIns })} = ${total}${event.isService ? " in service" : ""}`;
  const ended = isWeekly(event) && event.endedOn;
  const subline = `${describeEvent(event)}${ended ? ` · stopped after ${formatEventDay(event.endedOn)}` : ""}`;

  const saveButton = (className = "") => (
    <Button onClick={handleSave} disabled={saving || !dirty} className={className}>
      {saving ? "Saving…" : dirty || !loaded ? "Save attendance" : "Saved"}
    </Button>
  );

  return (
    <PageShell
      title={
        <span className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-brand-soft text-brand md:inline-flex">
            <FiStar size={28} strokeWidth={1.9} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 leading-[1.2] md:leading-[1.15]">
              {event.name}
              {event.isService && (
                <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-role-contact px-2.5 text-[12.5px] font-semibold tracking-normal text-brand-ink">
                  Sunday service
                </span>
              )}
            </span>
            <span className="hidden text-[15px] font-normal leading-normal tracking-normal text-muted md:block">{subline}</span>
          </span>
        </span>
      }
      backHref="/events"
      backLabel="Events"
      rightAction={
        <>
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit event" title="Edit event" className={`${iconButton} md:bg-white md:ring-1 md:ring-line`}>
            <FiEdit2 size={18} aria-hidden="true" />
          </button>
          {isWeekly(event) && (
            <Button variant="outline" onClick={ended ? handleResume : handleStop} disabled={working} className="max-md:px-3.5 max-md:text-sm">
              {ended ? "Resume" : "Stop repeating"}
            </Button>
          )}
          <button type="button" onClick={handleDelete} disabled={working} aria-label="Delete event" title="Delete event" className={`${iconButton} text-warn-ink hover:bg-warn-soft md:bg-white md:ring-1 md:ring-line`}>
            <FiTrash2 size={18} aria-hidden="true" />
          </button>
        </>
      }
      bottomBar={
        <div className="flex w-full flex-col gap-2">
          <p className="text-center text-sm text-ink-2">{summary}</p>
          {saveButton("h-13 w-full rounded-2xl text-base shadow-none!")}
        </div>
      }
    >
      <p className="-mt-3 mb-3 text-sm text-muted md:hidden">{subline}</p>

      <div className="md:flex md:flex-wrap md:items-start md:gap-4">
        <section className="flex min-w-0 flex-col gap-2.5 md:flex-[1.5_1_420px] md:gap-3.5 md:rounded-3xl md:bg-white md:px-[22px] md:pb-[22px] md:pt-5 md:shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h2 className="hidden text-[17px] font-bold tracking-[-0.015em] md:block">Mark attendance</h2>
            <div className="flex w-full items-center gap-1.5 rounded-2xl bg-fill p-1 md:w-auto md:bg-transparent md:p-0">
              <button type="button" onClick={() => step(-1)} disabled={index <= 0} aria-label="Earlier date" className={`${iconButton} max-md:bg-transparent`}>
                <FiChevronLeft size={18} aria-hidden="true" />
              </button>
              <span aria-live="polite" className="min-w-0 flex-1 text-center text-base font-semibold md:min-w-[160px] md:text-[15px]">
                {formatEventDay(dateStr)}
              </span>
              <button type="button" onClick={() => step(1)} disabled={index < 0 || index >= dates.length - 1} aria-label="Later date" className={`${iconButton} max-md:bg-transparent`}>
                <FiChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

          <SearchBar value={search} onChange={setSearch} placeholder="Search people…" className="h-12 rounded-[14px] md:h-11" />

          {people.length === 0 ? (
            <p className="py-4 text-muted">No people on this team yet. Add contacts first, then mark who came. Walk-ins can still be counted below.</p>
          ) : (
            <div role="group" aria-label="People, tap everyone who came" className="flex flex-col gap-1.5">
              <p className="flex justify-between gap-3 text-[13px] text-muted">
                <span>Tap everyone who came</span>
                <span>{present.length} of {people.length + hiddenTicked} ticked</span>
              </p>
              {shown.length === 0 && <p className="py-3 text-center text-sm text-muted">Nobody matches “{search}”.</p>}
              {shown.map((p) => {
                const here = present.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={here}
                    disabled={saving}
                    onClick={() => toggle(p.id)}
                    className={`flex min-h-[52px] w-full items-center gap-3 rounded-[18px] py-1.5 pl-1.5 pr-3 text-left transition-colors md:min-h-14 md:pl-2 md:pr-3.5 ${
                      here ? "bg-ok-soft/45 hover:bg-ok-soft/70" : "bg-tint hover:bg-fill"
                    }`}
                  >
                    <Avatar name={p.name} className="max-md:h-10 max-md:w-10 max-md:rounded-[13px] max-md:text-[15px] md:text-[15px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold md:text-[15px]">{p.name}</span>
                      {(p.roles || []).length > 0 && (
                        <span className="hidden truncate text-[13px] text-muted md:block">{p.roles.join(" · ")}</span>
                      )}
                    </span>
                    <span
                      className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${
                        here ? "bg-ok-soft text-ok-ink" : "bg-white text-muted ring-1 ring-line"
                      }`}
                    >
                      {here && <FiCheck size={14} strokeWidth={2.6} aria-hidden="true" />}
                      {here ? "Present" : "Not marked"}
                    </span>
                  </button>
                );
              })}
              {hiddenTicked > 0 && (
                <p className="text-[13px] text-muted">
                  {hiddenTicked} more {hiddenTicked === 1 ? "person was" : "people were"} ticked earlier and {hiddenTicked === 1 ? "is" : "are"} archived or no longer on this list. Still counted.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-[18px] bg-brand-soft py-2.5 pl-3.5 pr-3">
            <div className="min-w-0">
              <p id="walkins-label" className="text-base font-semibold md:text-[15px]">Walk-ins</p>
              <p className="text-[13px] text-ink-2">Came, but not in the app. Just a number.</p>
            </div>
            <div role="group" aria-labelledby="walkins-label" className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => setWalk(walkIns - 1)} disabled={saving || walkIns <= 0} aria-label="One fewer walk-in" className={`${iconButton} bg-white`}>
                <FiMinus size={17} aria-hidden="true" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                aria-label="Number of walk-ins"
                disabled={saving}
                value={walkIns}
                onChange={(e) => setWalk(parseInt(e.target.value, 10))}
                onFocus={(e) => e.target.select()}
                className="h-11 w-14 rounded-[14px] bg-white text-center text-[17px] font-bold tabular-nums text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button type="button" onClick={() => setWalk(walkIns + 1)} disabled={saving} aria-label="One more walk-in" className={`${iconButton} bg-white`}>
                <FiPlus size={17} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="hidden flex-wrap items-center gap-3.5 md:flex">
            {saveButton("px-5")}
            <span className="text-ink-2">{summary}</span>
          </div>
        </section>

        <div className="mt-4 flex min-w-0 flex-col gap-4 md:mt-0 md:flex-[1_1_300px]">
          {editing ? (
            <EventFormPanel label="Edit event" onClose={() => setEditing(false)}>
              <EventForm
                initial={event}
                title="Edit event"
                submitLabel="Save changes"
                onSubmit={handleEdit}
                onCancel={() => setEditing(false)}
              />
            </EventFormPanel>
          ) : (
            <section className="flex flex-col gap-1.5 rounded-[20px] bg-brand-soft px-4 py-3.5 md:gap-2 md:rounded-3xl md:px-[22px] md:pb-[22px] md:pt-5">
              <h2 className="mb-0.5 text-sm font-bold md:mb-1 md:text-[17px] md:tracking-[-0.015em]">Event info</h2>
              {[
                ["Repeats", repeatLabel(event)],
                ["Time", event.time || "Not set"],
                ["Place", event.location || "Not set"],
                [isWeekly(event) ? "Started" : "Date", formatEventDay(event.dateStr)],
                ...(ended ? [["Stopped after", formatEventDay(event.endedOn)]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <span className="text-ink-2">{label}</span>
                  <span className="text-right font-semibold">{value}</span>
                </div>
              ))}
              <p className="mt-1.5 rounded-[14px] bg-white px-3 py-2.5 text-[13.5px] text-ink-2">
                {event.isService
                  ? <>Counts toward <b className="text-ink">No. in Service</b> on the weekly report.</>
                  : "Not counted in No. in Service. Only the Sunday service is."}
              </p>
            </section>
          )}

          {records.length > 0 && (
            <section className="flex flex-col gap-1 md:rounded-3xl md:bg-white md:px-[22px] md:py-5 md:shadow-card">
              <div className="mb-1 flex items-center justify-between gap-2.5">
                <h2 className="text-[17px] font-bold tracking-[-0.015em]">Recorded dates</h2>
                <span className="text-[13px] text-muted">Tap to open</span>
              </div>
              {records.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => { if (rec.dateStr !== dateStr && confirmLeave()) showDate(rec.dateStr); }}
                  aria-current={rec.dateStr === dateStr ? "true" : undefined}
                  className={`-mx-2 flex min-h-[52px] items-center justify-between gap-3 rounded-[14px] px-2 text-left transition-colors hover:bg-tint ${
                    rec.dateStr === dateStr ? "bg-tint" : ""
                  }`}
                >
                  <span>
                    <span className="block font-semibold">{formatEventDay(rec.dateStr)}</span>
                    <span className="block text-[13px] text-muted">{attendanceDetail(rec)}</span>
                  </span>
                  <span className="text-xl font-bold tabular-nums">{attendanceTotal(rec)}</span>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </PageShell>
  );
}

// useSearchParams needs a Suspense boundary above it for the production build.
export default function EventPage() {
  return (
    <Suspense fallback={<Spinner fullScreen />}>
      <EventDetail />
    </Suspense>
  );
}
