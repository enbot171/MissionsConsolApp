"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByAssignee, getTeamPeopleAndNoContact, getNoContactByAssignee, getMeetupsByAssignee, countCompletedMeetups } from "@/lib/firestore";
import { useFollowUpLog } from "@/hooks/useFollowUpLog";
import { dueList, dueBadge } from "@/lib/followUps";
import PageShell from "@/components/PageShell";
import Spinner from "@/components/Spinner";
import SearchBar from "@/components/SearchBar";
import { Avatar, Button } from "@/components/ui";
import { FiCheck, FiChevronRight, FiClipboard } from "react-icons/fi";

const PERIODS = ["Daily", "Weekly", "All Time"];
const PERIOD_LABELS = { "All Time": "All time" };

function getPeriodStart(period) {
  const now = new Date();
  if (period === "Daily") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === "Weekly") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    return monday;
  }
  return null;
}

function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
}

function countTalkedTo(contacts, noContact, period) {
  const start = getPeriodStart(period);
  const all = [...contacts, ...noContact];
  if (!start) return all.length;
  return all.filter((p) => { const d = toDate(p.createdAt); return d && d >= start; }).length;
}

function computeStats(people, period, noContact = []) {
  const start = getPeriodStart(period);
  const filtered = start
    ? people.filter((p) => { const d = toDate(p.createdAt); return d && d >= start; })
    : people;
  const filteredNC = start
    ? noContact.filter((p) => { const d = toDate(p.createdAt); return d && d >= start; })
    : noContact;
  const all = [...filtered, ...filteredNC];
  return {
    contacts: filtered.length,
    gospelShared: all.filter((p) => p.gospelShared).length,
    prayedFor: all.filter((p) => p.prayed).length,
    salvations: all.filter((p) => p.saved).length,
  };
}

const TILE_TONES = {
  mine: { tile: "bg-fill", value: "text-ink", label: "text-muted" },
  team: { tile: "bg-brand-soft", value: "text-navy", label: "text-ink-2" },
};

function StatGrid({ metrics, tone, loading }) {
  const t = TILE_TONES[tone];
  return (
    <dl className="grid grid-cols-3 gap-2 md:grid-cols-[repeat(auto-fit,minmax(118px,1fr))] md:gap-2.5">
      {metrics.map((m) => (
        <div key={m.label} className={`flex min-w-0 flex-col-reverse justify-end rounded-2xl p-3 md:rounded-[18px] md:px-4 md:py-3.5 ${t.tile}`}>
          <dt className={`mt-0.5 truncate text-[12.5px] md:mt-1 md:overflow-visible md:whitespace-normal md:text-[13px] ${t.label}`}>
            {m.short ? (
              <>
                <span className="md:hidden">{m.short}</span>
                <span className="hidden md:inline">{m.label}</span>
              </>
            ) : m.label}
          </dt>
          <dd className={`text-2xl font-bold leading-[1.1] tracking-[-0.03em] tabular-nums md:text-[28px] ${t.value}`}>
            {loading ? "—" : m.value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// "See all" keeps a 44px hit area; on laptop the negative margin stops it
// stretching the heading row.
const linkClass = "inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:text-navy md:-my-2.5";
const spinnerClass = "h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent";
const countClass = "inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-2 text-[13px] font-bold text-white";

function dateLine() {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-GB", { weekday: "long" });
  const month = now.toLocaleDateString("en-GB", { month: "long" });
  return `${weekday} ${now.getDate()} ${month}`;
}

export default function Dashboard() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();
  const [peopleSearch, setPeopleSearch] = useState("");
  const [myPeople, setMyPeople] = useState([]);
  const [teamPeople, setTeamPeople] = useState([]);
  const [myNoContact, setMyNoContact] = useState([]);
  const [teamNoContact, setTeamNoContact] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [period, setPeriod] = useState("Weekly");
  const [todayMeetups, setTodayMeetups] = useState([]);
  const [upcomingMeetups, setUpcomingMeetups] = useState([]);
  const [meetupStat, setMeetupStat] = useState({ period: null, count: null });

  const patchPerson = useCallback((id, patch) => {
    setMyPeople((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  }, []);

  const { cardProps } = useFollowUpLog(patchPerson);

  useEffect(() => {
    if (!user) return;
    setStatsLoading(true);
    const fetchAll = async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const [mine, myNC, teamResult, meetups] = await Promise.all([
        getPeopleByAssignee(user.uid),
        getNoContactByAssignee(user.uid),
        profile?.teamId
          ? getTeamPeopleAndNoContact(profile.teamId)
          : Promise.resolve({ people: [], noContact: [] }),
        // Only today onward — the dashboard never renders past meetups.
        getMeetupsByAssignee(user.uid, { since: startOfToday }),
      ]);
      setMyPeople(mine);
      setMyNoContact(myNC);
      setTeamPeople(teamResult.people);
      setTeamNoContact(teamResult.noContact);

      const endOfToday = new Date(startOfToday);
      endOfToday.setDate(endOfToday.getDate() + 1);
      const withDate = meetups.map((m) => ({ ...m, _d: m.date?.toDate ? m.date.toDate() : new Date(m.date) }));
      setTodayMeetups(withDate.filter((m) => m._d < endOfToday));
      setUpcomingMeetups(withDate.filter((m) => m._d >= endOfToday).slice(0, 3));
    };
    fetchAll().finally(() => setStatsLoading(false));
  }, [user, profile?.teamId]);

  // Counted server-side so the all-time stat doesn't require downloading every meetup.
  useEffect(() => {
    if (!user) return;
    // Tagged with its period so a stale in-flight count can't paint the wrong number.
    countCompletedMeetups(user.uid, getPeriodStart(period))
      .then((count) => setMeetupStat({ period, count }));
  }, [user, period]);

  if (loading) return <Spinner fullScreen />;

  // getPeopleByAssignee keeps no-contact people; the team query drops them and
  // adds them back via teamNoContact. Match that here, or every no-contact person
  // is counted twice on the "My" side and mine reads higher than the team's.
  const myActive = myPeople.filter((p) => !p.noContact);

  const myStats = statsLoading ? null : computeStats(myActive, period, myNoContact);
  const teamStats = statsLoading ? null : computeStats(teamPeople, period, teamNoContact);

  const myDisciples = statsLoading ? null : myActive.filter((p) => (p.roles || []).includes("Disciple")).length;
  const teamDisciples = statsLoading ? null : teamPeople.filter((p) => (p.roles || []).includes("Disciple")).length;
  const teamCoreTeam = statsLoading ? null : teamPeople.filter((p) => (p.roles || []).includes("Core Team")).length;

  const myTalkedTo = statsLoading ? null : countTalkedTo(myActive, myNoContact, period);
  const teamTalkedTo = statsLoading ? null : countTalkedTo(teamPeople, teamNoContact, period);
  // Same rules as /follow-ups and the nav badge — one classifier, so the three
  // can never disagree about who is due.
  const overduePeople = statsLoading ? [] : dueList(myPeople, profile);
  const overdueCount = overduePeople.length;

  const myMetrics = [
    { label: "Talked to",        value: myTalkedTo },
    { label: "Contacts made",    value: myStats?.contacts },
    { label: "Gospel shared",    value: myStats?.gospelShared },
    { label: "Prayed for",       value: myStats?.prayedFor },
    { label: "Salvations",       value: myStats?.salvations },
    { label: "Active disciples", short: "Disciples", value: myDisciples },
    { label: "Meetups",          value: meetupStat.period === period ? meetupStat.count : null },
  ];

  const teamMetrics = [
    { label: "Talked to",        value: teamTalkedTo },
    { label: "Contacts made",    value: teamStats?.contacts },
    { label: "Gospel shared",    value: teamStats?.gospelShared },
    { label: "Prayed for",       value: teamStats?.prayedFor },
    { label: "Salvations",       value: teamStats?.salvations },
    { label: "Active disciples", short: "Disciples", value: teamDisciples },
    { label: "Active core team", short: "Core team", value: teamCoreTeam },
  ];

  const hasMeetups = todayMeetups.length > 0 || upcomingMeetups.length > 0;
  const hasDue = overduePeople.length > 0;

  const firstName = profile?.name?.trim().split(/\s+/)[0] || "";
  const meetupWord = todayMeetups.length === 1 ? "meetup" : "meetups";

  return (
    <PageShell
      subtitle={
        <>
          {firstName && <span className="md:hidden">Welcome back</span>}
          <span className="hidden md:inline">{dateLine()}</span>
        </>
      }
      title={
        firstName ? (
          <>
            <span className="hidden md:inline">Welcome back, </span>
            {firstName}
          </>
        ) : "Welcome back"
      }
      rightAction={
        <>
        {/* Laptop: search hands the query to the People page */}
        <form
          role="search"
          className="hidden md:block"
          onSubmit={(e) => {
            e.preventDefault();
            const q = peopleSearch.trim();
            router.push(q ? `/people?q=${encodeURIComponent(q)}` : "/people");
          }}
        >
          <SearchBar
            value={peopleSearch}
            onChange={setPeopleSearch}
            placeholder="Search people"
            className="h-11 w-[280px] max-w-full rounded-[14px] [&>input]:text-[15px]"
          />
        </form>
        <span className="flex items-center gap-2.5 md:hidden">
          <span className="inline-flex h-8 items-center rounded-full bg-brand-soft px-3 text-[13px] font-semibold text-brand">
            {profile?.role || "Member"}
          </span>
          <Link
            href="/settings"
            aria-label="Account"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white"
          >
            {firstName[0]?.toUpperCase() || "?"}
          </Link>
        </span>
        </>
      }
    >
      {(hasMeetups || hasDue) && (
        <div className="mb-[18px] flex flex-col gap-[18px] md:mb-[22px] md:flex-row md:flex-wrap md:items-start md:gap-4">
          {hasMeetups && (
            <div className="contents md:flex md:min-w-0 md:flex-[1.5_1_380px] md:flex-col md:gap-4">
              {/* Today's meetups: the thing you need before you need anything else */}
              {todayMeetups.length > 0 && (
                <section
                  aria-label="Today"
                  className="order-1 flex flex-col gap-2.5 rounded-3xl bg-navy p-4 text-white shadow-[0_14px_30px_rgb(20_30_60/0.16)] md:order-none md:gap-3.5 md:px-[22px] md:py-5"
                >
                  {/* Phone: one line with a text link */}
                  <div className="flex items-baseline justify-between gap-3 md:hidden">
                    <h2 className="text-lg font-bold tracking-[-0.015em]">
                      Today · {todayMeetups.length} {meetupWord}
                    </h2>
                    <Link href="/calendar" className="-my-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-light hover:text-white">
                      Calendar
                    </Link>
                  </div>
                  {/* Laptop: stacked heading with a button */}
                  <div className="hidden items-center justify-between gap-3 md:flex">
                    <div>
                      <p className="text-[13px] text-nav-muted">Today</p>
                      <h2 className="text-[22px] font-bold tracking-[-0.02em]">
                        {todayMeetups.length} {meetupWord}
                      </h2>
                    </div>
                    <Link
                      href="/calendar"
                      className="inline-flex h-11 items-center rounded-[14px] bg-white px-[18px] font-semibold text-navy transition-colors hover:bg-brand-soft"
                    >
                      Open calendar
                    </Link>
                  </div>
                  {todayMeetups.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => router.push(`/calendar?editMeetup=${m.id}`)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-3 py-2.5 text-left transition-colors hover:bg-white/15 md:gap-3.5 md:px-3.5 md:py-3"
                    >
                      <span className="inline-flex h-9 w-[58px] shrink-0 items-center justify-center rounded-xl bg-brand-light/20 text-sm font-bold tabular-nums text-brand-light md:w-16">
                        {m._d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{m.personName}</span>
                        {(m.location || m.notes) && (
                          <span className="block truncate text-[13px] text-nav-muted">
                            {m.location || m.notes}
                            {m.location && m.notes && <span className="hidden md:inline"> · {m.notes}</span>}
                          </span>
                        )}
                      </span>
                      <FiChevronRight size={16} aria-hidden="true" className="hidden shrink-0 md:block" />
                    </button>
                  ))}
                </section>
              )}

              {upcomingMeetups.length > 0 && (
                <section
                  aria-label="Upcoming meetups"
                  className="order-3 flex flex-col gap-1 rounded-3xl bg-white px-4 pb-2 pt-4 shadow-card md:order-none md:px-5 md:pb-2.5 md:pt-[18px]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold tracking-[-0.015em] md:text-[17px]">Upcoming meetups</h2>
                    <button type="button" onClick={() => router.push("/meetings")} className={linkClass}>
                      See all
                    </button>
                  </div>
                  {upcomingMeetups.map((m) => {
                    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => router.push(`/calendar?editMeetup=${m.id}`)}
                        className="flex min-h-[60px] w-full items-center gap-3 text-left"
                      >
                        <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[14px] bg-brand-soft leading-[1.1] text-brand">
                          <span className="text-[11.5px] font-semibold uppercase">{d.toLocaleDateString([], { weekday: "short" })}</span>
                          <span className="text-base font-bold">{d.getDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-ink">{m.personName}</span>
                          <span className="block truncate text-[13px] text-muted">
                            {d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()}
                            {m.location ? ` · ${m.location}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </section>
              )}
            </div>
          )}

          {hasDue && (
            <section
              aria-label="Follow-ups due"
              className="order-2 flex min-w-0 flex-col gap-0.5 md:order-none md:flex-[1_1_320px] md:gap-1.5 md:rounded-3xl md:bg-brand-soft md:px-5 md:pb-3 md:pt-[18px]"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-bold tracking-[-0.015em] md:text-[17px]">
                  Follow-ups due
                  <span className={countClass}>{overdueCount}</span>
                </h2>
                <button type="button" onClick={() => router.push("/follow-ups")} className={linkClass}>
                  See all
                </button>
              </div>
              {/* The board lists two on the phone and five on the laptop. */}
              {overduePeople.slice(0, 5).map((p, i) => {
                const { acting, onCheck } = cardProps(p);
                const late = p._daysOverdue > 0;
                const checkText = p._reason === "inactive" ? "still active" : "followed up";
                return (
                  <div key={p.id} className={`min-h-16 items-center gap-3 md:min-h-[68px] ${i < 2 ? "flex" : "hidden md:flex"}`}>
                    <Avatar name={p.name} />
                    <button
                      type="button"
                      onClick={() => router.push(`/person/${p.id}`)}
                      className="min-w-0 flex-1 self-stretch text-left"
                    >
                      <span className="block truncate text-base font-semibold tracking-[-0.01em] text-ink md:text-[15px] md:tracking-normal">
                        {p.name}
                      </span>
                      <span className={`block truncate text-[13px] font-medium ${late ? "text-warn-ink" : "text-ink"}`}>
                        {dueBadge(p)}
                        {p.followUpDays ? ` · every ${p.followUpDays} days` : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCheck(p)}
                      disabled={!!acting}
                      aria-label={`Mark ${p.name} ${checkText}`}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand transition-colors hover:bg-role-contact disabled:cursor-not-allowed disabled:opacity-50 md:bg-white md:ring-1 md:ring-navy/10 md:hover:bg-tint"
                    >
                      {acting === "checking"
                        ? <span className={spinnerClass} />
                        : <FiCheck size={18} strokeWidth={2.4} aria-hidden="true" />}
                    </button>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      )}

      <section aria-label="Stats" className="flex flex-col gap-2.5 md:gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
          <h2 className="text-lg font-bold tracking-[-0.015em] md:text-[22px] md:tracking-[-0.02em]">
            <span className="md:hidden">My stats</span>
            <span className="hidden md:inline">Stats</span>
          </h2>
          {/* One control: a segmented switch on the phone, separate pills on the laptop. */}
          <div role="group" aria-label="Period" className="flex gap-1 rounded-[14px] bg-fill p-1 md:gap-2 md:rounded-none md:bg-transparent md:p-0">
            {PERIODS.map((p) => (
              <button
                type="button"
                key={p}
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={`h-9 whitespace-nowrap rounded-[10px] px-2.5 text-[13px] font-semibold transition-colors md:h-[38px] md:rounded-full md:px-4 md:text-sm ${
                  period === p
                    ? "bg-white text-ink shadow-[0_1px_3px_rgb(20_30_60/0.12)] md:bg-brand md:text-white md:shadow-none"
                    : "text-muted md:bg-fill md:text-ink md:hover:bg-line-soft"
                }`}
              >
                {PERIOD_LABELS[p] || p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="hidden text-[13px] font-bold md:block">Mine</h3>
          <StatGrid metrics={myMetrics} tone="mine" loading={statsLoading} />
        </div>
        {profile?.teamId && (
          <div className="mt-2 flex flex-col gap-2.5 md:mt-0 md:gap-2">
            <h3 className="text-lg font-bold tracking-[-0.015em] md:text-[13px] md:tracking-normal">
              <span className="md:hidden">Team stats</span>
              <span className="hidden md:inline">Team</span>
            </h3>
            <StatGrid metrics={teamMetrics} tone="team" loading={statsLoading} />
          </div>
        )}
      </section>

      {/* Not on the board: kept from the old shortcut row, below everything the board draws. */}
      <Button variant="quiet" className="mt-[18px] md:mt-[22px]" onClick={() => router.push("/summary")}>
        <FiClipboard size={16} aria-hidden="true" /> Daily summary
      </Button>
    </PageShell>
  );
}
