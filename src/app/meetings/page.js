"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getMeetupsByAssignee } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui";
import { FiCalendar, FiChevronRight, FiMapPin } from "react-icons/fi";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Today / This week / Later — near-term meetings are the ones you act on,
// so they get their own headings rather than one long undifferentiated list.
function groupByHorizon(meetups) {
  const start = startOfToday();
  const tomorrow = new Date(start); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(start); weekEnd.setDate(weekEnd.getDate() + 7);

  const today = [], thisWeek = [], later = [];
  meetups.forEach((m) => {
    if (m._d < tomorrow) today.push(m);
    else if (m._d < weekEnd) thisWeek.push(m);
    else later.push(m);
  });
  return { today, thisWeek, later };
}

export default function Meetings() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const [meetups, setMeetups] = useState([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    getMeetupsByAssignee(user.uid, { since: startOfToday() }).then((all) => {
      setMeetups(all.map((m) => ({ ...m, _d: m.date?.toDate ? m.date.toDate() : new Date(m.date) })));
      setFetching(false);
    });
  }, [user]);

  if (loading) return null;

  const { today, thisWeek, later } = groupByHorizon(meetups);

  const openMeetup = (m) => router.push(`/calendar?editMeetup=${m.id}`);
  const scheduleIcon = <FiCalendar size={17} aria-hidden="true" />;

  // The laptop board sets the count beside the title; the phone board has none.
  const title = !fetching && meetups.length > 0 ? (
    <span className="flex flex-wrap items-baseline gap-x-3">
      Meetings
      <span className="hidden text-[15px] font-normal leading-normal tracking-normal text-muted md:inline">
        {meetups.length} coming up
      </span>
    </span>
  ) : "Meetings";

  return (
    <PageShell
      title={title}
      rightAction={
        <Button onClick={() => router.push("/calendar")} className="max-md:shadow-none md:px-[18px]">
          {scheduleIcon} Schedule
        </Button>
      }
    >
      {fetching ? (
        <div role="status" className="flex justify-center py-[72px]">
          <span aria-hidden="true" className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
          <span className="sr-only">Loading</span>
        </div>
      ) : meetups.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-line-soft">
          <span aria-hidden="true" className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
            <FiCalendar size={26} />
          </span>
          <p className="text-[17px] font-bold tracking-[-0.015em]">No meetings coming up</p>
          <p className="text-sm text-muted">Schedule one from the calendar.</p>
          <div className="mt-3">
            <Button onClick={() => router.push("/calendar")} className="px-[18px]! shadow-none!">
              {scheduleIcon} Schedule
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5 md:gap-[22px]">
          <TodayPanel items={today} onOpen={openMeetup} />
          <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-start md:gap-6">
            <MeetingList label="This week" items={thisWeek} onOpen={openMeetup} />
            <MeetingList label="Later" items={later} onOpen={openMeetup} />
          </div>
        </div>
      )}
    </PageShell>
  );
}

// "6:30 pm" as the boards write it (the reader's locale may make it 24-hour).
const timeOf = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
// The phone board's 56px time chip only has room for "18:30".
const shortTimeOf = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Today's meetings are the ones to act on, so they get the dark panel.
function TodayPanel({ items, onOpen }) {
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Today"
      className="flex flex-col gap-2.5 rounded-3xl bg-navy p-3.5 text-white md:gap-3.5 md:px-[22px] md:pb-[22px] md:pt-5 md:shadow-[0_14px_30px_rgb(20_30_60/0.16)]"
    >
      <div>
        <p className="hidden text-[13px] text-nav-muted md:block">
          {new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h2 className="mx-0.5 text-xl font-bold leading-[1.4] tracking-[-0.02em] md:mx-0 md:text-[22px] md:leading-normal">
          Today <span className="font-medium text-nav-muted">{items.length}</span>
        </h2>
      </div>
      <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-2.5">
        {items.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onOpen(m)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-3 py-2.5 text-left transition-colors hover:bg-white/15 md:min-h-[68px] md:gap-3.5 md:px-3.5 md:py-3"
          >
            <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-light/20 text-sm font-bold tabular-nums text-brand-light md:h-10 md:w-[76px]">
              <span className="md:hidden">{shortTimeOf(m._d)}</span>
              <span className="hidden md:inline">{timeOf(m._d)}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-[1.35] md:text-[15px] md:leading-normal">{m.personName}</span>
              {m.location && (
                <span className="flex items-center gap-[5px] text-[13px] text-nav-muted">
                  <FiMapPin size={13} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{m.location}</span>
                </span>
              )}
              {m.notes && <span className="block truncate text-[13px] text-nav-muted">{m.notes}</span>}
            </span>
            <FiChevronRight size={16} className="hidden shrink-0 md:block" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

function MeetingList({ label, items, onOpen }) {
  if (items.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-col gap-1.5 md:flex-[1_1_340px] md:gap-2">
      <h2 className="text-[15px] font-bold md:text-[17px] md:tracking-[-0.015em]">
        {label} <span className="font-medium text-muted">{items.length}</span>
      </h2>
      {items.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onOpen(m)}
          className="flex min-h-[62px] w-full items-center gap-3 rounded-[18px] bg-tint py-2 pl-2 pr-3 text-left transition-colors hover:bg-fill md:min-h-[76px] md:gap-3.5 md:px-4 md:py-3"
        >
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[14px] bg-brand-soft leading-[1.1] text-brand md:h-12 md:w-12 md:rounded-[15px]">
            <span className="text-[10.5px] font-semibold uppercase">{m._d.toLocaleDateString([], { month: "short" })}</span>
            <span className="text-base font-bold leading-[1.1] md:text-[17px]">{m._d.getDate()}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold leading-[1.35] tracking-[-0.01em] md:text-[15px] md:leading-normal md:tracking-normal">{m.personName}</span>
            <span className="flex items-center gap-[5px] text-[13px] text-muted">
              <span className="shrink-0 font-medium text-ink">
                {m._d.toLocaleDateString([], { weekday: "short" })} · {timeOf(m._d)}
              </span>
              {m.location && (
                <>
                  <FiMapPin size={13} className="ml-1 shrink-0 md:ml-1.5" aria-hidden="true" />
                  <span className="min-w-0 truncate">{m.location}</span>
                </>
              )}
            </span>
            {m.notes && <span className="block truncate text-[13px] text-muted">{m.notes}</span>}
          </span>
          <FiChevronRight size={16} className="hidden shrink-0 text-muted md:block" aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}
