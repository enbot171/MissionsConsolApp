"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByAssignee, updatePerson } from "@/lib/firestore";
import { serverTimestamp } from "firebase/firestore";
import PageShell from "@/components/PageShell";
import { FiCheck } from "react-icons/fi";

const DEFAULT_FOLLOW_UP_DAYS = 3;

function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function getRefDate(person) {
  if (person.lastFollowedUpAt?.toDate) return person.lastFollowedUpAt.toDate();
  if (person.createdAt?.toDate) return person.createdAt.toDate();
  if (person.createdAt) return new Date(person.createdAt);
  return null;
}

function computeDaysUntilDue(person, followUpDays) {
  const ref = getRefDate(person);
  if (!ref) return null;
  return followUpDays - daysSince(ref);
}

const roleStyles = {
  Contact: "bg-blue-50 text-blue-600",
  Disciple: "bg-emerald-50 text-emerald-600",
  CGL: "bg-violet-50 text-violet-600",
  "Core Team": "bg-orange-50 text-orange-600",
};

export default function FollowUps() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();
  const [people, setPeople] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [texting, setTexting] = useState(new Set());

  useEffect(() => {
    if (!user) return;
    getPeopleByAssignee(user.uid).then((all) => {
      setPeople(all.filter((p) => !p.noContact));
      setFetching(false);
    });
  }, [user]);

  if (loading) return null;

  const followUpDays = profile?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS;

  const withDue = people
    .map((p) => ({ ...p, _due: computeDaysUntilDue(p, followUpDays) }))
    .filter((p) => p._due !== null);

  const overdue = withDue
    .filter((p) => p._due <= 0)
    .sort((a, b) => a._due - b._due);

  const upcoming = withDue
    .filter((p) => p._due > 0 && p._due <= 7)
    .sort((a, b) => a._due - b._due);

  const handleTexted = async (person) => {
    setTexting((prev) => new Set([...prev, person.id]));
    await updatePerson(person.id, { lastFollowedUpAt: serverTimestamp() });
    setPeople((prev) => prev.map((p) =>
      p.id === person.id ? { ...p, lastFollowedUpAt: { toDate: () => new Date() } } : p
    ));
    setTexting((prev) => { const n = new Set(prev); n.delete(person.id); return n; });
  };

  return (
    <PageShell title="Follow-ups">
      {fetching ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      ) : overdue.length === 0 && upcoming.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="font-semibold text-gray-800">Everyone's up to date!</p>
          <p className="text-sm text-gray-400 mt-1">No follow-ups due in the next 7 days.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-800">
                Overdue <span className="text-gray-400 font-semibold">({overdue.length})</span>
              </p>
              {overdue.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  onNavigate={() => router.push(`/person/${p.id}`)}
                  onTexted={handleTexted}
                  isTexting={texting.has(p.id)}
                />
              ))}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-800">
                Coming up <span className="text-gray-400 font-semibold">({upcoming.length})</span>
              </p>
              {upcoming.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  onNavigate={() => router.push(`/person/${p.id}`)}
                  onTexted={handleTexted}
                  isTexting={texting.has(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

function PersonRow({ person, onNavigate, onTexted, isTexting }) {
  const due = person._due;
  const isOverdue = due <= 0;
  const daysOverdue = Math.abs(due);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div
        onClick={onNavigate}
        className="w-11 h-11 rounded-xl bg-linear-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm cursor-pointer"
      >
        <span className="text-white font-bold text-base">
          {person.name?.charAt(0).toUpperCase() || "?"}
        </span>
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
        <p className="font-semibold text-gray-900 truncate">{person.name}</p>
        <p className="text-sm text-gray-500 truncate">
          {person.contactType && <span>{person.contactType} · </span>}
          {person.contact}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {(person.roles || []).map((r) => (
            <span key={r} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${roleStyles[r] || "bg-gray-100 text-gray-700"}`}>
              {r}
            </span>
          ))}
          <span className={`text-[10px] font-semibold ${isOverdue ? "text-rose-500" : "text-amber-500"}`}>
            {isOverdue
              ? daysOverdue === 0 ? "Due today" : `${daysOverdue}d overdue`
              : `Due in ${due}d`}
          </span>
        </div>
      </div>

      <button
        onClick={() => onTexted(person)}
        disabled={isTexting}
        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 transition-colors"
      >
        <FiCheck size={13} />
        Texted
      </button>
    </div>
  );
}
