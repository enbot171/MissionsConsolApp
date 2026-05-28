"use client";

import { useEffect, useState, Suspense } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useSearchParams } from "next/navigation";
import { getPeopleByAssigneeAndDate, getMeetupsByAssignee, updateMeetup } from "@/lib/firestore";
import PageShell from "@/components/PageShell";

function toLocalDateStr(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().split("T")[0];
}

function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  return (
    <PageShell
      title="Daily Summary"
      rightAction={
        <input
          type="date"
          value={date}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 min-w-0"
        />
      }
    >
      <div className="space-y-4">
        {/* Stats grid — 3 per row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Talked To", value: stats.talkedTo,     color: "text-violet-600" },
            { label: "Contacts",  value: stats.contacts,     color: "text-blue-600"   },
            { label: "Gospel",    value: stats.gospelShared, color: "text-indigo-600" },
            { label: "Prayed",    value: stats.prayed,       color: "text-teal-600"   },
            { label: "Saved",     value: stats.saved,        color: "text-amber-600"  },
            { label: "Meetups",   value: stats.meetups,      color: "text-pink-600"   },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{fetching ? "—" : s.value}</p>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* People list */}
        {fetching ? (
          <p className="text-center text-gray-400 text-sm py-8">Loading…</p>
        ) : all.length === 0 && dayMeetups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-400 text-sm">No activity recorded for this date.</p>
          </div>
        ) : (
          <>
            {sorted.length > 0 && (
              <div className="space-y-2">
                {sorted.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </div>
            )}

            {/* Meetups section */}
            {dayMeetups.length > 0 && (
              <div className="space-y-2">
                <p className="text-lg font-bold text-gray-800">
                  Meetups <span className="text-gray-400 font-semibold text-base">({dayMeetups.length})</span>
                </p>
                {dayMeetups.map((m) => (
                  <MeetupRow key={m.id} meetup={m} formatTime={formatTime} isPast={isPastDate} onConfirm={confirmMeetup} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

function PersonRow({ person }) {
  const isNoContact = person.noContact === true;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-sm">{person.name}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isNoContact ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-600"
            }`}>
              {isNoContact ? "No Contact" : "Contact"}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {!isNoContact && (
              <div className="flex gap-1.5">
                <span className="text-xs font-semibold text-gray-400 shrink-0">{person.contactType || "Contact"}</span>
                <span className="text-xs text-gray-600">{person.contact || "—"}</span>
              </div>
            )}
            <div className="flex gap-1.5">
              <span className="text-xs font-semibold text-gray-400 shrink-0">Met At</span>
              <span className="text-xs text-gray-600">{person.metAt || "—"}</span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-xs font-semibold text-gray-400 shrink-0">Notes</span>
              <span className="text-xs text-gray-600 line-clamp-2">{person.description || "—"}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0 items-end">
          {person.gospelShared && <Badge label="Gospel" color="bg-indigo-100 text-indigo-700" />}
          {person.prayed        && <Badge label="Prayed" color="bg-teal-100 text-teal-700"    />}
          {person.saved         && <Badge label="Saved"  color="bg-amber-100 text-amber-700"  />}
        </div>
      </div>
    </div>
  );
}

function MeetupRow({ meetup, formatTime, isPast, onConfirm }) {
  const statusBadge = meetup.completed === true
    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Done</span>
    : meetup.completed === false
    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Didn't happen</span>
    : null;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${isPast && meetup.completed == null ? "border-amber-200" : "border-pink-100"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-sm">{meetup.personName}</p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-600">Meetup</span>
            {statusBadge}
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex gap-1.5">
              <span className="text-xs font-semibold text-gray-400 shrink-0">Time</span>
              <span className="text-xs text-gray-600">{formatTime(meetup.date) || "—"}</span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-xs font-semibold text-gray-400 shrink-0">Location</span>
              <span className="text-xs text-gray-600">{meetup.location || "—"}</span>
            </div>
            {meetup.notes && (
              <div className="flex gap-1.5">
                <span className="text-xs font-semibold text-gray-400 shrink-0">Notes</span>
                <span className="text-xs text-gray-600 line-clamp-2">{meetup.notes}</span>
              </div>
            )}
          </div>
          {isPast && meetup.completed == null && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-semibold text-gray-500">Did this meetup happen?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onConfirm(meetup.id, true)}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  ✓ Yes
                </button>
                <button
                  onClick={() => onConfirm(meetup.id, false)}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  ✗ No
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ label, color }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
  );
}
