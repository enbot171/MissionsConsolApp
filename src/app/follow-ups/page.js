"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByAssignee, updatePerson } from "@/lib/firestore";
import { useFollowUpLog } from "@/hooks/useFollowUpLog";
import { classifyPeople } from "@/lib/followUps";
import PageShell from "@/components/PageShell";
import FollowUpCard from "@/components/FollowUpCard";
import { Chip, ChipRow } from "@/components/ui";
import { FiCheck } from "react-icons/fi";
import { DEFAULT_FOLLOW_UP_DAYS, DEFAULT_INACTIVITY_DAYS } from "@/config/app";

export default function FollowUps() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();
  const [people, setPeople] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("all");

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

  const groups = [
    {
      key: "scheduled",
      label: "Scheduled",
      short: "Scheduled",
      people: scheduled,
      badge: (p) => `Scheduled for ${p._scheduled.toLocaleDateString([], { month: "short", day: "numeric" })}`,
      color: () => "text-ink",
    },
    {
      key: "new",
      label: "New contacts",
      short: "New",
      people: newContact,
      badge: (p) => (p._daysOverdue === 0 ? "First follow-up due" : `First follow-up · ${days(p._daysOverdue)} overdue`),
      color: dueColor,
    },
    {
      key: "followUp",
      label: "Follow up",
      short: "Follow up",
      people: followUpDue,
      badge: (p) => (p._daysOverdue === 0 ? "Due today" : `${days(p._daysOverdue)} overdue`),
      color: dueColor,
    },
    {
      key: "inactive",
      label: "Check if still active",
      short: "Inactive",
      hint: `No scheduled meeting or interval set, and not met in ${inactivityDays}+ days.`,
      people: inactive,
      badge: (p) => `${days(p._since)} without contact`,
      color: () => "text-warn-ink",
      checkLabel: "Still active",
    },
  ].filter((g) => g.people.length > 0);

  // A group can empty out while its chip is selected; fall back to everything.
  const activeFilter = groups.some((g) => g.key === filter) ? filter : "all";
  const shown = activeFilter === "all" ? groups : groups.filter((g) => g.key === activeFilter);
  const hasDue = !fetching && totalDue > 0;

  return (
    <PageShell
      title={
        <span className="flex flex-wrap items-baseline gap-x-3">
          Follow-ups
          {hasDue && (
            <span className="hidden text-[15px] font-normal tracking-normal text-muted md:inline">
              {totalDue} {totalDue === 1 ? "person" : "people"} due
            </span>
          )}
        </span>
      }
      rightAction={
        hasDue ? (
          <span className="inline-flex h-8 items-center rounded-full bg-warn-soft px-3 text-[13px] font-semibold text-warn-ink md:hidden">
            {totalDue} due
          </span>
        ) : undefined
      }
    >
      {toast && (
        <div
          role="status"
          className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-2xl bg-navy px-4.5 py-3 text-sm font-semibold text-white shadow-float md:bottom-8"
        >
          {toast}
        </div>
      )}
      {fetching ? (
        <div role="status" className="flex min-h-[360px] items-center justify-center">
          <span aria-hidden="true" className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
          <span className="sr-only">Loading</span>
        </div>
      ) : totalDue === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-3xl bg-white px-6 py-14 text-center ring-1 ring-line-soft">
          <span aria-hidden="true" className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
            <FiCheck size={26} strokeWidth={1.9} />
          </span>
          <p className="mt-1.5 text-[17px] font-bold tracking-[-0.015em] text-ink">Everyone&apos;s up to date!</p>
          <p className="text-sm text-muted">No follow-ups due right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5 md:gap-[18px]">
          <ChipRow label="Filter by reason" className="md:flex-wrap">
            <Chip active={activeFilter === "all"} onClick={() => setFilter("all")} className="md:h-[38px]!">
              All {totalDue}
            </Chip>
            {groups.map((g) => (
              <Chip key={g.key} active={activeFilter === g.key} onClick={() => setFilter(g.key)} className="md:h-[38px]!">
                <span className="md:hidden">{g.short}</span>
                <span className="hidden md:inline">{g.label}</span> {g.people.length}
              </Chip>
            ))}
          </ChipRow>

          {shown.map((g) => (
            <section key={g.key} className="flex flex-col gap-2 md:gap-1.5">
              <h2 className="text-sm font-bold text-ink md:text-[15px]">
                {g.label} <span className="font-medium text-muted">{g.people.length}</span>
              </h2>
              {g.hint && <p className="-mt-0.5 mb-0.5 text-[13px] text-muted">{g.hint}</p>}
              {g.people.map((p) => (
                <FollowUpCard
                  key={p.id}
                  person={p}
                  showRoles
                  badge={g.badge(p)}
                  badgeColor={g.color(p)}
                  onNavigate={() => router.push(`/person/${p.id}`)}
                  onArchive={handleArchive}
                  {...cardProps(p)}
                  onSaveLog={handleSaveLog}
                  checkLabel={g.checkLabel}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}

// Overdue reads in the warning colour, due today in plain ink.
const dueColor = (p) => (p._daysOverdue === 0 ? "text-ink" : "text-warn-ink");

const days = (n) => `${n} ${n === 1 ? "day" : "days"}`;
