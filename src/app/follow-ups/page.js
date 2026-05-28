"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByAssignee, updatePerson } from "@/lib/firestore";
import { serverTimestamp } from "firebase/firestore";
import PageShell from "@/components/PageShell";
import { FiArchive, FiCheck } from "react-icons/fi";

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

function computeDaysUntilDue(person, globalFollowUpDays) {
  const ref = getRefDate(person);
  if (!ref) return null;
  const interval = person.followUpDays ?? globalFollowUpDays;
  return interval - daysSince(ref);
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
  const [checking, setChecking] = useState(new Set());
  const [archiving, setArchiving] = useState(new Set());

  useEffect(() => {
    if (!user) return;
    getPeopleByAssignee(user.uid).then((all) => {
      setPeople(all.filter((p) => !p.noContact));
      setFetching(false);
    });
  }, [user]);

  if (loading) return null;

  const globalFollowUpDays = profile?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS;

  const withDue = people
    .map((p) => ({ ...p, _due: computeDaysUntilDue(p, globalFollowUpDays) }))
    .filter((p) => p._due !== null);

  const overdue = withDue
    .filter((p) => p._due <= 0)
    .sort((a, b) => a._due - b._due);

  const upcoming = withDue
    .filter((p) => p._due > 0 && p._due <= 7)
    .sort((a, b) => a._due - b._due);

  const handleCheck = async (person) => {
    setChecking((prev) => new Set([...prev, person.id]));
    await updatePerson(person.id, { lastFollowedUpAt: serverTimestamp() });
    setPeople((prev) => prev.map((p) =>
      p.id === person.id ? { ...p, lastFollowedUpAt: { toDate: () => new Date() } } : p
    ));
    setChecking((prev) => { const n = new Set(prev); n.delete(person.id); return n; });
  };

  const handleArchive = async (person) => {
    setArchiving((prev) => new Set([...prev, person.id]));
    await updatePerson(person.id, { archived: true });
    setPeople((prev) => prev.filter((p) => p.id !== person.id));
    setArchiving((prev) => { const n = new Set(prev); n.delete(person.id); return n; });
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
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  isChecking={checking.has(p.id)}
                  isArchiving={archiving.has(p.id)}
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
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  isChecking={checking.has(p.id)}
                  isArchiving={archiving.has(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

function PersonRow({ person, onNavigate, onCheck, onArchive, isChecking, isArchiving }) {
  const due = person._due;
  const isOverdue = due <= 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      {/* Checkbox */}
      <button
        onClick={() => onCheck(person)}
        disabled={isChecking || isArchiving}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 ${
          isChecking
            ? "bg-emerald-500 border-emerald-500"
            : "border-gray-300 hover:border-emerald-400"
        }`}
      >
        {isChecking && <FiCheck size={11} className="text-white" />}
      </button>

      {/* Info */}
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
              ? Math.abs(due) === 0 ? "Due today" : `${Math.abs(due)}d overdue`
              : `Due in ${due}d`}
          </span>
          {person.followUpDays && (
            <span className="text-[10px] text-gray-400">· every {person.followUpDays}d</span>
          )}
        </div>
      </div>

      {/* Archive button */}
      <button
        onClick={() => onArchive(person)}
        disabled={isArchiving || isChecking}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 transition-colors"
        title="Archive"
      >
        {isArchiving
          ? <span className="w-3 h-3 rounded-full border border-gray-400 border-t-transparent animate-spin" />
          : <FiArchive size={13} />}
      </button>
    </div>
  );
}
