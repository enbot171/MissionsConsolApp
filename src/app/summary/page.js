"use client";

import { useEffect, useState, Suspense } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useSearchParams, useRouter } from "next/navigation";
import { getPeopleByAssigneeAndDate, getMeetupsByAssignee, updateMeetup } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import { Avatar } from "@/components/ui";
import { FiCalendar, FiCheck, FiX } from "react-icons/fi";

function toLocalDateStr(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().split("T")[0];
}

function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

export default function Summary() {
  return (
    <Suspense>
      <SummaryInner />
    </Suspense>
  );
}

function SummaryInner() {
  const { user, loading } = useRequireAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [all, setAll] = useState([]);
  const [allMeetups, setAllMeetups] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [date, setDate] = useState(
    searchParams.get("date") || new Date().toISOString().split("T")[0]
  );

  // Fetch all meetups once on mount (few records, cheap to filter client-side)
  useEffect(() => {
    if (!user) return;
    getMeetupsByAssignee(user.uid).then(setAllMeetups);
  }, [user]);

  // Fetch people for the selected date (server-side filtered)
  useEffect(() => {
    if (!user) return;
    setFetching(true);
    getPeopleByAssigneeAndDate(user.uid, date).then((records) => {
      setAll(records);
      setFetching(false);
    });
  }, [user, date]);

  if (loading) return null;

  const sorted = [...all].sort((a, b) => (a.noContact ? 1 : 0) - (b.noContact ? 1 : 0));
  const dayMeetups = allMeetups.filter((m) => toLocalDateStr(m.date) === date);
  const isPastDate = date < new Date().toISOString().split("T")[0];

  const confirmMeetup = async (id, completed) => {
    await updateMeetup(id, { completed });
    setAllMeetups((prev) => prev.map((m) => m.id === id ? { ...m, completed } : m));
  };

  const stats = {
    talkedTo:     all.length,
    contacts:     all.filter((p) => !p.noContact).length,
    gospelShared: all.filter((p) => p.gospelShared).length,
    prayed:       all.filter((p) => p.prayed).length,
    saved:        all.filter((p) => p.saved).length,
    meetups:      dayMeetups.filter((m) => m.completed === true).length,
  };

  const today = new Date().toISOString().split("T")[0];
  const picked = date ? new Date(`${date}T00:00`) : null;
  const dateLabel = picked && !Number.isNaN(picked.getTime())
    ? picked.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })
    : undefined;

  return (
    <PageShell
      title="Daily summary"
      subtitle={dateLabel && <span className="hidden md:inline">{dateLabel}</span>}
      rightAction={
        <label className="hidden items-center gap-2.5 text-sm font-semibold md:flex">
          Date
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 min-w-0 rounded-[14px] bg-white px-3.5 text-[15px] font-normal text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      }
    >
      <div className="flex flex-col gap-3 md:gap-[18px]">
        {/* On phones the date gets its own full-width row under the title. */}
        <label className="flex h-12 items-center gap-2.5 rounded-2xl bg-fill px-3.5 text-sm font-semibold md:hidden">
          <FiCalendar size={18} aria-hidden="true" />
          Date
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 min-w-0 flex-1 bg-transparent text-right text-base font-normal text-ink outline-none"
          />
        </label>

        <dl aria-label="Totals for the day" className="grid grid-cols-3 gap-2 md:grid-cols-[repeat(auto-fit,minmax(118px,1fr))] md:gap-2.5">
          {[
            { label: "Talked to", value: stats.talkedTo },
            { label: "Contacts",  value: stats.contacts },
            { label: "Gospel",    value: stats.gospelShared },
            { label: "Prayed",    value: stats.prayed },
            { label: "Saved",     value: stats.saved },
            { label: "Meetups",   value: stats.meetups },
          ].map((s) => (
            <div key={s.label} className="flex flex-col-reverse rounded-2xl bg-fill px-3 py-2 md:rounded-[18px] md:px-4 md:py-3.5">
              <dt className="text-[13px] text-muted md:mt-1">{s.label}</dt>
              <dd className="text-[22px] font-bold leading-[1.15] tracking-[-0.03em] tabular-nums md:text-[28px] md:leading-[1.1]">{fetching ? "—" : s.value}</dd>
            </div>
          ))}
        </dl>

        {fetching ? (
          <div role="status" className="flex justify-center py-[72px]">
            <span aria-hidden="true" className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
            <span className="sr-only">Loading</span>
          </div>
        ) : all.length === 0 && dayMeetups.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-line-soft">
            <span aria-hidden="true" className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
              <FiCalendar size={26} />
            </span>
            <p className="text-[17px] font-bold tracking-[-0.015em]">No activity recorded for this date.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:gap-5">
            {sorted.length > 0 && (
              <section className="min-w-0 md:flex-[1.5_1_400px]">
                <SectionHeading count={sorted.length}>People</SectionHeading>
                <ul className="md:mt-2.5 md:space-y-2">
                  {sorted.map((person) => (
                    <li key={person.id}>
                      <PersonRow person={person} onClick={() => router.push(`/person/${person.id}`)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {dayMeetups.length > 0 && (
              <section className="min-w-0 md:flex-[1_1_300px]">
                <SectionHeading count={dayMeetups.length}>Meetups</SectionHeading>
                <div className="mt-2 space-y-2 md:mt-2.5">
                  {dayMeetups.map((m) => (
                    <MeetupRow key={m.id} meetup={m} formatTime={formatTime} isPast={isPastDate} onConfirm={confirmMeetup} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function SectionHeading({ count, children }) {
  return (
    <h2 className="text-sm font-bold md:text-[17px] md:tracking-[-0.015em]">
      {children} <span className="font-medium text-muted">{count}</span>
    </h2>
  );
}

const MARKS = [
  { key: "gospelShared", letter: "G", label: "Gospel", on: "Gospel shared", off: "Gospel not shared" },
  { key: "prayed",       letter: "P", label: "Prayed", on: "Prayed",        off: "Not prayed" },
  { key: "saved",        letter: "S", label: "Saved",  on: "Saved",         off: "Not saved" },
];

function Detail({ label, children, quiet = false, labelWidth = "w-21" }) {
  return (
    <span className="flex gap-2 text-[13px]">
      <span className={`${labelWidth} shrink-0 font-semibold text-muted`}>{label}</span>
      <span className={`min-w-0 ${quiet ? "line-clamp-2 text-ink-2" : ""}`}>{children}</span>
    </span>
  );
}

function PersonRow({ person, onClick }) {
  const isNoContact = person.noContact === true;
  const contactLine = isNoContact ? "" : `${person.contactType || "Contact"} · ${person.contact || "—"} · `;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-18 w-full items-center gap-3 py-1 text-left transition-colors md:items-start md:gap-3.5 md:rounded-[18px] md:bg-tint md:px-4 md:py-3.5 md:hover:bg-fill"
    >
      <Avatar name={person.name} className="md:text-[15px]" />
      <span className="flex min-w-0 flex-1 flex-col md:gap-[3px]">
        <span className="flex items-center gap-2 md:flex-wrap">
          <span className="min-w-0 truncate text-base font-semibold tracking-[-0.01em] md:text-[15px] md:tracking-normal">{person.name}</span>
          <span
            className={`inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full px-[9px] text-xs font-semibold ${
              isNoContact ? "bg-line-soft text-muted" : "bg-role-contact text-role-contact-ink"
            }`}
          >
            {isNoContact ? "No contact" : "Contact"}
          </span>
        </span>

        {/* Phone: two clipped lines. Laptop: one labelled line per fact. */}
        <span className="truncate text-[13px] text-muted md:hidden">{contactLine}Met at {person.metAt || "—"}</span>
        <span className="truncate text-[13px] text-ink-2 md:hidden">{person.description || "—"}</span>

        <span className="hidden flex-col gap-[3px] md:flex">
          {!isNoContact && <Detail label={person.contactType || "Contact"}>{person.contact || "—"}</Detail>}
          <Detail label="Met at">{person.metAt || "—"}</Detail>
          <Detail label="Notes" quiet>{person.description || "—"}</Detail>
        </span>
      </span>

      <span className="flex shrink-0 gap-1 md:hidden">
        {MARKS.map((m) => (
          <span
            key={m.key}
            role="img"
            aria-label={person[m.key] ? m.on : m.off}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11.5px] font-bold ${
              person[m.key] ? "bg-brand text-white" : "bg-line-soft text-muted"
            }`}
          >
            {m.letter}
          </span>
        ))}
      </span>
      <span className="hidden shrink-0 flex-col items-end gap-1 md:flex">
        {MARKS.filter((m) => person[m.key]).map((m) => (
          <span key={m.key} className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-brand-soft px-2.5 text-[12.5px] font-semibold text-brand">
            {m.label}
          </span>
        ))}
      </span>
    </button>
  );
}

function MeetupRow({ meetup, formatTime, isPast, onConfirm }) {
  const needsAnswer = isPast && meetup.completed == null;
  const status = meetup.completed === true
    ? { text: "Done", ink: "text-ink", dot: "bg-ok-ink" }
    : meetup.completed === false
    ? { text: "Didn't happen", ink: "text-muted", dot: "bg-muted" }
    : needsAnswer
    ? { text: "Not confirmed", ink: "text-warn-ink", dot: "bg-warn" }
    : null;
  const answerClass =
    "inline-flex h-11 items-center gap-1.5 rounded-[14px] px-4 font-semibold transition-colors md:px-[18px]";

  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-tint py-3 pl-3.5 pr-3 md:gap-3 md:bg-white md:px-4 md:py-3.5 md:shadow-card">
      <div className="flex items-center gap-3 md:items-start">
        <span className="inline-flex h-9 w-18 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-[13px] font-bold tabular-nums text-brand">
          {formatTime(meetup.date) || "—"}
        </span>
        <div className="flex min-w-0 flex-1 flex-col md:gap-[3px]">
          <div className="flex items-center justify-between gap-2 md:flex-wrap">
            <p className="min-w-0 truncate text-base font-semibold tracking-[-0.01em] md:text-[15px] md:tracking-normal">{meetup.personName}</p>
            {status && (
              <span className={`inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold ${status.ink}`}>
                <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${status.dot}`} />
                {status.text}
              </span>
            )}
          </div>

          {/* Phone: one clipped line. Laptop: one labelled line per fact. */}
          <p className="truncate text-[13px] text-muted md:hidden">
            {meetup.location || "—"}{meetup.notes ? ` · ${meetup.notes}` : ""}
          </p>
          <span className="hidden flex-col gap-[3px] md:flex">
            <Detail label="Location" labelWidth="w-16">{meetup.location || "—"}</Detail>
            {meetup.notes && <Detail label="Notes" labelWidth="w-16" quiet>{meetup.notes}</Detail>}
          </span>
        </div>
      </div>

      {needsAnswer && (
        <div
          role="group"
          aria-label={`Confirm meetup with ${meetup.personName}`}
          className="flex items-center gap-2 md:flex-wrap md:rounded-2xl md:bg-tint md:py-2.5 md:pl-3.5 md:pr-2.5"
        >
          <span className="min-w-0 flex-1 text-sm font-semibold md:flex-[1_1_140px]">Did this meetup happen?</span>
          <button type="button" onClick={() => onConfirm(meetup.id, true)} className={`${answerClass} bg-brand text-white hover:bg-navy`}>
            <FiCheck size={16} aria-hidden="true" /> Yes
          </button>
          <button type="button" onClick={() => onConfirm(meetup.id, false)} className={`${answerClass} bg-white text-ink ring-1 ring-line hover:bg-tint`}>
            <FiX size={16} aria-hidden="true" /> No
          </button>
        </div>
      )}
    </div>
  );
}
