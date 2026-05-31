"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByAssignee, updatePerson } from "@/lib/firestore";
import { serverTimestamp } from "firebase/firestore";
import PageShell from "@/components/PageShell";
import { FiArchive, FiCheck } from "react-icons/fi";
import { DEFAULT_FOLLOW_UP_DAYS, DEFAULT_INACTIVITY_DAYS, ROLE_STYLES } from "@/config/app";

function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function classifyPeople(people, firstFollowUpDays, inactivityDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scheduled = [], newContact = [], followUpDue = [], inactive = [];

  people.forEach((p) => {
    const lastFollowedUp = p.lastFollowedUpAt?.toDate ? p.lastFollowedUpAt.toDate() : null;
    const created = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : null);
    const scheduledDate = p.scheduledFollowUpAt?.toDate
      ? p.scheduledFollowUpAt.toDate()
      : (p.scheduledFollowUpAt ? new Date(p.scheduledFollowUpAt) : null);
    const interval = p.followUpDays ?? null;

    // Scheduled date takes full control — only show when past due
    if (scheduledDate) {
      const dueIn = Math.ceil((scheduledDate - today) / (1000 * 60 * 60 * 24));
      if (dueIn <= 0) scheduled.push({ ...p, _scheduled: scheduledDate });
      return;
    }

    // Interval-based (uses lastFollowedUpAt if exists, else createdAt)
    if (interval) {
      const ref = lastFollowedUp || created;
      const since = ref ? daysSince(ref) : null;
      if (since !== null && since >= interval) followUpDue.push({ ...p, _daysOverdue: since - interval });
      return;
    }

    // No schedule, no interval
    if (!lastFollowedUp) {
      // New contact — use global first follow-up threshold
      const since = created ? daysSince(created) : null;
      if (since !== null && since >= firstFollowUpDays) newContact.push({ ...p, _daysOverdue: since - firstFollowUpDays });
      return;
    }

    // Has been followed up, chose no interval/schedule → inactivity
    const since = daysSince(lastFollowedUp);
    if (since >= inactivityDays) inactive.push({ ...p, _since: since });
  });

  scheduled.sort((a, b) => a._scheduled - b._scheduled);
  newContact.sort((a, b) => b._daysOverdue - a._daysOverdue);
  followUpDue.sort((a, b) => b._daysOverdue - a._daysOverdue);
  inactive.sort((a, b) => b._since - a._since);

  return { scheduled, newContact, followUpDue, inactive };
}

export default function FollowUps() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();
  const [people, setPeople] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [acting, setActing] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (!user) return;
    getPeopleByAssignee(user.uid).then((all) => {
      setPeople(all.filter((p) => !p.noContact));
      setFetching(false);
    });
  }, [user]);

  if (loading) return null;

  const followUpDays = profile?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS;
  const inactivityDays = profile?.inactivityCheckDays ?? DEFAULT_INACTIVITY_DAYS;

  const { scheduled, newContact, followUpDue, inactive } = classifyPeople(people, followUpDays, inactivityDays);
  const totalDue = scheduled.length + newContact.length + followUpDue.length + inactive.length;

  const setAct = (id, val) => setActing((prev) => ({ ...prev, [id]: val }));
  const clearAct = (id) => setActing((prev) => { const n = { ...prev }; delete n[id]; return n; });

  const handleCheck = async (person) => {
    setAct(person.id, "checking");
    await updatePerson(person.id, {
      lastFollowedUpAt: serverTimestamp(),
      ...(person.scheduledFollowUpAt ? { scheduledFollowUpAt: null } : {}),
    });
    setPeople((prev) => prev.map((p) =>
      p.id === person.id
        ? { ...p, lastFollowedUpAt: { toDate: () => new Date() }, scheduledFollowUpAt: null }
        : p
    ));
    clearAct(person.id);
  };

  const handleArchive = async (person) => {
    setAct(person.id, "archiving");
    await updatePerson(person.id, { archived: true });
    setPeople((prev) => prev.filter((p) => p.id !== person.id));
    clearAct(person.id);
    showToast(`${person.name} archived`);
  };

  return (
    <PageShell title="Follow-ups">
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-xl whitespace-nowrap">
          {toast}
        </div>
      )}
      {fetching ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      ) : totalDue === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="font-semibold text-gray-800">Everyone's up to date!</p>
          <p className="text-sm text-gray-400 mt-1">No follow-ups due right now.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {scheduled.length > 0 && (
            <Section label="Scheduled" count={scheduled.length} accent="text-blue-600">
              {scheduled.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  badge={`Scheduled · ${p._scheduled.toLocaleDateString([], { month: "short", day: "numeric" })}`}
                  badgeColor="text-blue-500"
                  onNavigate={() => router.push(`/person/${p.id}`)}
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  acting={acting[p.id]}
                />
              ))}
            </Section>
          )}

          {newContact.length > 0 && (
            <Section label="New contacts" count={newContact.length} accent="text-rose-500">
              {newContact.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  badge={p._daysOverdue === 0 ? "First follow-up due" : `First follow-up · ${p._daysOverdue}d overdue`}
                  badgeColor="text-rose-500"
                  onNavigate={() => router.push(`/person/${p.id}`)}
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  acting={acting[p.id]}
                />
              ))}
            </Section>
          )}

          {followUpDue.length > 0 && (
            <Section label="Follow up" count={followUpDue.length} accent="text-indigo-500">
              {followUpDue.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  badge={p._daysOverdue === 0 ? "Due today" : `${p._daysOverdue}d overdue`}
                  badgeColor="text-indigo-500"
                  onNavigate={() => router.push(`/person/${p.id}`)}
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  acting={acting[p.id]}
                />
              ))}
            </Section>
          )}

          {inactive.length > 0 && (
            <Section label="Check if still active" count={inactive.length} accent="text-orange-500">
              <p className="text-xs text-gray-400 -mt-1">
                No scheduled meeting or interval set — haven't been met in {inactivityDays}+ days.
              </p>
              {inactive.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  badge={`${p._since}d without contact`}
                  badgeColor="text-orange-500"
                  onNavigate={() => router.push(`/person/${p.id}`)}
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  acting={acting[p.id]}
                  checkLabel="Still active"
                />
              ))}
            </Section>
          )}

        </div>
      )}
    </PageShell>
  );
}

function Section({ label, count, accent, children }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-gray-800">
        {label} <span className={`font-semibold text-sm ${accent}`}>({count})</span>
      </p>
      {children}
    </div>
  );
}

function PersonRow({ person, badge, badgeColor, onNavigate, onCheck, onArchive, acting, checkLabel }) {
  const isChecking = acting === "checking";
  const isArchiving = acting === "archiving";
  const busy = !!acting;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
        <p className="font-semibold text-gray-900 truncate">{person.name}</p>
        <p className="text-sm text-gray-500 truncate">
          {person.contactType && <span className="text-gray-400">Contact Type: </span>}
          {person.contactType && <span>{person.contactType}</span>}
          {person.contactType && person.contact && <span> · </span>}
          {person.contact}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {(person.roles || []).map((r) => (
            <span key={r} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_STYLES[r] || "bg-gray-100 text-gray-700"}`}>
              {r}
            </span>
          ))}
          <span className={`text-[10px] font-semibold ${badgeColor}`}>{badge}</span>
          {person.followUpDays && (
            <span className="text-[10px] text-gray-400">· every {person.followUpDays}d</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onArchive(person)}
        disabled={busy}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
      >
        {isArchiving
          ? <span className="w-3 h-3 rounded-full border border-red-400 border-t-transparent animate-spin" />
          : <FiArchive size={12} className="text-red-500" />}
        <span className="text-xs font-semibold text-red-500">Archive</span>
      </button>

      <button
        onClick={() => onCheck(person)}
        disabled={busy}
        title={checkLabel || "Mark as followed up"}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 ${
          isChecking ? "bg-emerald-500 border-emerald-500" : "border-gray-300 hover:border-emerald-400"
        }`}
      >
        {isChecking && <FiCheck size={11} className="text-white" />}
      </button>
    </div>
  );
}
