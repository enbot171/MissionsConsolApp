"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByAssignee, updatePerson } from "@/lib/firestore";
import { useFollowUpLog } from "@/hooks/useFollowUpLog";
import { classifyPeople } from "@/lib/followUps";
import PageShell from "@/components/PageShell";
import FollowUpCard from "@/components/FollowUpCard";
import { DEFAULT_FOLLOW_UP_DAYS, DEFAULT_INACTIVITY_DAYS } from "@/config/app";

export default function FollowUps() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();
  const [people, setPeople] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const patchPerson = useCallback((id, patch) => {
    setPeople((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  }, []);

  const { setAct, clearAct, saveLog, cardProps } = useFollowUpLog(patchPerson);

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

  const handleSaveLog = async (person, d, alsoCheck) => {
    await saveLog(person, d, alsoCheck);
    showToast(alsoCheck ? `${person.name} followed up` : "Saved");
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
                <FollowUpCard
                  key={p.id}
                  person={p}
                  showRoles
                  badge={`Scheduled · ${p._scheduled.toLocaleDateString([], { month: "short", day: "numeric" })}`}
                  badgeColor="text-blue-500"
                  onNavigate={() => router.push(`/person/${p.id}`)}
                  onArchive={handleArchive}
                  {...cardProps(p)}
                  onSaveLog={handleSaveLog}
                />
              ))}
            </Section>
          )}

          {newContact.length > 0 && (
            <Section label="New contacts" count={newContact.length} accent="text-rose-500">
              {newContact.map((p) => (
                <FollowUpCard
                  key={p.id}
                  person={p}
                  showRoles
                  badge={p._daysOverdue === 0 ? "First follow-up due" : `First follow-up · ${p._daysOverdue}d overdue`}
                  badgeColor="text-rose-500"
                  onNavigate={() => router.push(`/person/${p.id}`)}
                  onArchive={handleArchive}
                  {...cardProps(p)}
                  onSaveLog={handleSaveLog}
                />
              ))}
            </Section>
          )}

          {followUpDue.length > 0 && (
            <Section label="Follow up" count={followUpDue.length} accent="text-indigo-500">
              {followUpDue.map((p) => (
                <FollowUpCard
                  key={p.id}
                  person={p}
                  showRoles
                  badge={p._daysOverdue === 0 ? "Due today" : `${p._daysOverdue}d overdue`}
                  badgeColor="text-indigo-500"
                  onNavigate={() => router.push(`/person/${p.id}`)}
                  onArchive={handleArchive}
                  {...cardProps(p)}
                  onSaveLog={handleSaveLog}
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
                <FollowUpCard
                  key={p.id}
                  person={p}
                  showRoles
                  badge={`${p._since}d without contact`}
                  badgeColor="text-orange-500"
                  onNavigate={() => router.push(`/person/${p.id}`)}
                  onArchive={handleArchive}
                  {...cardProps(p)}
                  onSaveLog={handleSaveLog}
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

