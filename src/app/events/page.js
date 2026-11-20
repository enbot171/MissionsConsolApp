"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiPlus } from "react-icons/fi";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { createEvent, getAttendanceByTeam, getEventsByTeam } from "@/lib/firestore";
import {
  addDays, attendanceTotal, daysBetween, describeEvent, eventDates, isMarked, parseDateStr, recordDetail,
} from "@/lib/events";
import { weekStart } from "@/lib/report";
import { toDateInput } from "@/lib/dates";
import PageShell from "@/components/PageShell";
import Spinner from "@/components/Spinner";
import EventForm, { EventFormPanel } from "@/components/EventForm";
import { Banner, Button, EmptyState } from "@/components/ui";

const WEEKS_BACK = 8;
const WEEKS_AHEAD = 4;

// Monday and Sunday of the current week, and the full span the page shows.
function windowFor(now) {
  const monday = toDateInput(weekStart(now));
  const sunday = addDays(monday, 6);
  return { monday, sunday, from: addDays(monday, -WEEKS_BACK * 7), to: addDays(sunday, WEEKS_AHEAD * 7) };
}

const shortDay = (dateStr) => parseDateStr(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// One row per event per date: what the event's pattern produces in the window,
// plus any date in it that already has attendance saved.
function buildRows(events, records, fromStr, toStr) {
  const byEvent = new Map();
  records.forEach((r) => {
    if (!byEvent.has(r.eventId)) byEvent.set(r.eventId, new Map());
    byEvent.get(r.eventId).set(r.dateStr, r);
  });

  return events.flatMap((event) => {
    const saved = byEvent.get(event.id) || new Map();
    const savedInRange = [...saved.keys()].filter((d) => d >= fromStr && d <= toStr);
    return eventDates(event, savedInRange, fromStr, toStr).map((dateStr) => ({
      key: `${event.id}_${dateStr}`,
      event,
      dateStr,
      record: saved.get(dateStr) || null,
    }));
  });
}

const byDate = (a, b) => (a.dateStr < b.dateStr ? -1 : a.dateStr > b.dateStr ? 1 : (a.event.time || "").localeCompare(b.event.time || ""));

function EventRow({ row, today }) {
  const { event, dateStr, record } = row;
  const day = parseDateStr(dateStr);
  const ahead = daysBetween(today, dateStr);

  let status;
  let tone;
  if (isMarked(record)) {
    const total = attendanceTotal(record);
    status = `${total} came`;
    tone = "bg-ok-soft text-ok-ink";
  } else if (ahead > 0) {
    status = ahead === 1 ? "Tomorrow" : `In ${ahead} days`;
    tone = "bg-white text-muted ring-1 ring-line-soft";
  } else {
    status = <span>Mark<span className="hidden md:inline"> attendance</span></span>;
    tone = "bg-brand text-white";
  }

  // Before attendance is taken the row says who is invited; after, how it went.
  const invited = (record?.invited || []).length;
  const detail = [
    isMarked(record) ? recordDetail(record) : invited > 0 ? `${invited} invited` : "",
    describeEvent(event),
  ].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/events/${event.id}?date=${dateStr}`}
      className="flex min-h-[68px] items-center gap-3 rounded-[18px] bg-tint py-2 pl-2 pr-3 text-ink transition-colors hover:bg-fill md:min-h-[72px] md:gap-3.5 md:py-2.5 md:pl-2.5 md:pr-4"
    >
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[15px] bg-white leading-[1.1] ring-1 ring-line-soft md:h-[52px] md:w-[52px] md:rounded-2xl">
        <span className="text-[11px] font-semibold text-muted">{day.toLocaleDateString("en-GB", { weekday: "short" })}</span>
        <span className="text-[17px] font-bold tabular-nums md:text-lg">{day.getDate()}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-base font-semibold tracking-[-0.01em]">{event.name}</span>
          {event.isService && (
            <span className="hidden h-[22px] shrink-0 items-center rounded-full bg-role-contact px-[9px] text-xs font-semibold text-brand-ink md:inline-flex">
              Sunday service
            </span>
          )}
        </span>
        <span className="block truncate text-[13px] text-muted">
          <span className="sr-only">{shortDay(dateStr)}. </span>
          {detail}
        </span>
      </span>
      <span className={`inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold md:h-8 ${tone}`}>
        {status}
      </span>
    </Link>
  );
}

function Group({ title, note, rows, today }) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-1.5 md:gap-2">
      <h2 className="text-base font-bold tracking-[-0.01em] md:text-[17px] md:tracking-[-0.015em]">
        {title} {note && <span className="font-medium text-muted">{note}</span>}
      </h2>
      {rows.map((row) => <EventRow key={row.key} row={row} today={today} />)}
    </section>
  );
}

export default function EventsPage() {
  const router = useRouter();
  const { loading: authLoading, profile, user } = useRequireAuth();
  const teamId = profile?.teamId;

  const [events, setEvents] = useState([]);
  const [records, setRecords] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Bumped by "Try again" to run the load once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading || !teamId) return;
    let current = true;
    const { from, to } = windowFor(new Date());
    Promise.all([getEventsByTeam(teamId), getAttendanceByTeam(teamId, from, to)])
      .then(([ev, att]) => {
        if (!current) return;
        setEvents(ev);
        setRecords(att);
        setFailed(false);
      })
      .catch((err) => {
        console.error("Could not load events", err);
        if (current) setFailed(true);
      })
      .finally(() => { if (current) setFetching(false); });
    return () => { current = false; };
  }, [authLoading, teamId, attempt]);

  const retry = () => { setFetching(true); setAttempt((n) => n + 1); };

  if (authLoading) return null;

  const handleCreate = async (data) => {
    const id = await createEvent(teamId, data, user.uid);
    // Straight to the new event, on a date that makes sense for it.
    router.push(`/events/${id}`);
  };

  const today = toDateInput(new Date());
  const { monday, sunday, from, to } = windowFor(new Date());

  const thisWeek = buildRows(events, records, monday, sunday).sort(byDate);
  // Only each event's next date: four rows of the same weekly service say nothing.
  const comingUp = buildRows(events, records, addDays(sunday, 1), to)
    .sort(byDate)
    .filter((row, i, rows) => rows.findIndex((r) => r.event.id === row.event.id) === i);
  const earlier = buildRows(events, records, from, addDays(monday, -1)).sort(byDate).reverse();

  const newButton = teamId && !fetching && !failed && (
    <Button onClick={() => setShowForm(true)} aria-expanded={showForm} className="max-md:gap-1.5 max-md:px-4 max-md:shadow-none md:px-[18px]">
      <FiPlus size={18} strokeWidth={2.3} aria-hidden="true" />
      <span>New<span className="hidden md:inline"> event</span></span>
    </Button>
  );

  let body;
  if (!teamId) {
    body = <EmptyState title="You are not on a team yet." hint="Events belong to a team. Ask an admin to add you to one." />;
  } else if (fetching) {
    body = <Spinner />;
  } else if (failed) {
    body = (
      <Banner tone="error" className="flex flex-wrap items-center justify-between gap-3">
        Could not load events.
        <Button variant="outline" onClick={retry}>Try again</Button>
      </Banner>
    );
  } else {
    const empty = events.length === 0;
    body = (
      <div className="md:flex md:flex-wrap md:items-start md:gap-4">
        <div className="flex min-w-0 flex-col gap-4 md:flex-[1.5_1_420px] md:gap-[22px]">
          {empty ? (
            <EmptyState
              title="No events yet."
              hint="Create one for your Sunday service, a weekly gathering or a one-off outreach, then mark who came."
              action={<Button onClick={() => setShowForm(true)}>New event</Button>}
            />
          ) : (
            <>
              <Group title="This week" note={`${shortDay(monday)} to ${shortDay(sunday)}`} rows={thisWeek} today={today} />
              <Group title="Coming up" rows={comingUp} today={today} />
              <Group title="Earlier" rows={earlier} today={today} />
              {thisWeek.length + comingUp.length + earlier.length === 0 && (
                <EmptyState title="Nothing in the last 8 weeks or the next 4." hint="Older events still count on the weekly report for their own weeks." />
              )}
            </>
          )}
        </div>

        {showForm && (
          <div className="min-w-0 md:flex-[1_1_320px]">
            <EventFormPanel label="New event" onClose={() => setShowForm(false)}>
              <EventForm
                title="New event"
                submitLabel="Create event"
                onSubmit={handleCreate}
                onCancel={() => setShowForm(false)}
              />
            </EventFormPanel>
          </div>
        )}
      </div>
    );
  }

  return (
    <PageShell title="Events" subtitle="Services, gatherings and one-off events" rightAction={newButton}>
      {body}
    </PageShell>
  );
}
