"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getMeetupsByAssignee } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import { FiCalendar, FiMapPin } from "react-icons/fi";

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

  return (
    <PageShell
      title="Meetings"
      rightAction={
        <button
          onClick={() => router.push("/calendar")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          <FiCalendar size={14} /> Schedule
        </button>
      }
    >
      {fetching ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      ) : meetups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-2xl mb-2">📅</p>
          <p className="font-semibold text-gray-800">No meetings coming up</p>
          <p className="text-sm text-gray-400 mt-1">Schedule one from the calendar.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Section label="Today" items={today} accent="text-blue-600" highlight router={router} />
          <Section label="This week" items={thisWeek} accent="text-indigo-500" router={router} />
          <Section label="Later" items={later} accent="text-gray-500" router={router} />
        </div>
      )}
    </PageShell>
  );
}

function Section({ label, items, accent, highlight, router }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-gray-800">
        {label} <span className={`font-semibold text-sm ${accent}`}>({items.length})</span>
      </p>
      {items.map((m) => (
        <div
          key={m.id}
          onClick={() => router.push(`/calendar?editMeetup=${m.id}`)}
          className={`bg-white rounded-xl shadow-sm px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
            highlight
              ? "border-2 border-blue-200 hover:bg-blue-50"
              : "border border-gray-100 hover:bg-gray-50"
          }`}
        >
          <div className={`w-12 shrink-0 flex flex-col items-center justify-center rounded-xl py-1 ${highlight ? "bg-blue-50" : "bg-gray-50"}`}>
            {highlight ? (
              <span className="text-[11px] font-bold text-blue-600 tabular-nums">
                {m._d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : (
              <>
                <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
                  {m._d.toLocaleDateString([], { month: "short" })}
                </span>
                <span className="text-sm font-bold text-gray-800 tabular-nums leading-none">{m._d.getDate()}</span>
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{m.personName}</p>
            <p className="text-xs text-gray-500 truncate">
              {!highlight && `${m._d.toLocaleDateString([], { weekday: "short" })} · `}
              {m._d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            {m.location && (
              <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                <FiMapPin size={10} className="shrink-0" />
                {m.location}
              </p>
            )}
            {m.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{m.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
