"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByAssignee, getTeamPeopleAndNoContact, getNoContactByAssignee, getMeetupsByAssignee } from "@/lib/firestore";
import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";
import Spinner from "@/components/Spinner";
import { useSidebar } from "@/context/SidebarContext";
import { FiClipboard, FiCalendar } from "react-icons/fi";

const PERIODS = ["Daily", "Weekly", "All Time"];

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

function countMeetups(meetups, period) {
  const start = getPeriodStart(period);
  if (!start) return meetups.length;
  return meetups.filter((m) => {
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
    return d >= start;
  }).length;
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

function StatCard({ label, value, border, loading }) {
  return (
    <div className={`bg-white rounded-2xl border-2 ${border} p-4 shadow-sm`}>
      <p className="text-gray-700 text-sm font-bold leading-tight">{label}</p>
      <p className="text-gray-900 text-3xl font-bold mt-1">{loading ? "—" : value ?? "—"}</p>
    </div>
  );
}


export default function Dashboard() {
  const { user, profile, loading } = useRequireAuth();
  const { collapsed } = useSidebar();
  const router = useRouter();
  const ml = collapsed ? "md:ml-16" : "md:ml-60";
  const [myPeople, setMyPeople] = useState([]);
  const [teamPeople, setTeamPeople] = useState([]);
  const [myNoContact, setMyNoContact] = useState([]);
  const [teamNoContact, setTeamNoContact] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [period, setPeriod] = useState("Weekly");
  const [allMeetups, setAllMeetups] = useState([]);
  const [upcomingMeetups, setUpcomingMeetups] = useState([]);

  useEffect(() => {
    if (!user) return;
    setStatsLoading(true);
    const fetchAll = async () => {
      const [mine, myNC, teamResult, meetups] = await Promise.all([
        getPeopleByAssignee(user.uid),
        getNoContactByAssignee(user.uid),
        profile?.teamId
          ? getTeamPeopleAndNoContact(profile.teamId)
          : Promise.resolve({ people: [], noContact: [] }),
        getMeetupsByAssignee(user.uid),
      ]);
      setMyPeople(mine);
      setMyNoContact(myNC);
      setTeamPeople(teamResult.people);
      setTeamNoContact(teamResult.noContact);
      setAllMeetups(meetups);
      const now = new Date();
      setUpcomingMeetups(meetups.filter((m) => {
        const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
        return d >= now;
      }).slice(0, 3));
    };
    fetchAll().finally(() => setStatsLoading(false));
  }, [user, profile?.teamId]);

  if (loading) return <Spinner fullScreen />;

  const myStats = statsLoading ? null : computeStats(myPeople, period, myNoContact);
  const teamStats = statsLoading ? null : computeStats(teamPeople, period, teamNoContact);

  const myDisciples = statsLoading ? null : myPeople.filter((p) => (p.roles || []).includes("Disciple")).length;
  const teamDisciples = statsLoading ? null : teamPeople.filter((p) => (p.roles || []).includes("Disciple")).length;
  const teamCoreTeam = statsLoading ? null : teamPeople.filter((p) => (p.roles || []).includes("Core Team")).length;

  const myTalkedTo = statsLoading ? null : countTalkedTo(myPeople, myNoContact, period);
  const teamTalkedTo = statsLoading ? null : countTalkedTo(teamPeople, teamNoContact, period);
  const myMeetupCount = statsLoading ? null : countMeetups(allMeetups, period);

  const myMetrics = [
    { label: "Talked To",        value: myTalkedTo,           border: "border-violet-600" },
    { label: "Contacts Made",    value: myStats?.contacts,    border: "border-blue-600" },
    { label: "Gospel Shared",    value: myStats?.gospelShared,border: "border-indigo-600" },
    { label: "Prayed For",       value: myStats?.prayedFor,   border: "border-teal-600" },
    { label: "Salvations",       value: myStats?.salvations,  border: "border-amber-600" },
    { label: "Active Disciples", value: myDisciples,          border: "border-emerald-700" },
    { label: "Meetups",          value: myMeetupCount,        border: "border-pink-600" },
  ];

  const teamMetrics = [
    { label: "Talked To",        value: teamTalkedTo,          border: "border-violet-600" },
    { label: "Contacts Made",    value: teamStats?.contacts,   border: "border-blue-600" },
    { label: "Gospel Shared",    value: teamStats?.gospelShared,border: "border-indigo-600" },
    { label: "Prayed For",       value: teamStats?.prayedFor,  border: "border-teal-600" },
    { label: "Salvations",       value: teamStats?.salvations, border: "border-amber-600" },
    { label: "Active Disciples", value: teamDisciples,         border: "border-emerald-700" },
    { label: "Active Core Team", value: teamCoreTeam,          border: "border-orange-700" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SideNav />

      <div className={`flex-1 flex flex-col transition-all duration-200 ${ml}`}>
        {/* Hero header */}
        <div className="bg-linear-to-br from-blue-600 to-indigo-700 px-5 pt-12 pb-8">
          <div className="max-w-lg mx-auto md:max-w-3xl">
            <p className="text-blue-200 text-sm font-medium">Welcome back</p>
            <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">
              {profile?.name || "—"}
            </h1>
            <span className="inline-block mt-2 text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium">
              {profile?.role || "Member"}
            </span>
          </div>
        </div>

        <main className="flex-1 pb-24 md:pb-10 -mt-4">
          <div className="px-4 max-w-lg mx-auto md:max-w-3xl space-y-4">

            {/* Shortcuts row */}
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/summary")}
                className="flex-1 flex items-center gap-2 px-3 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <FiClipboard className="text-indigo-600" size={13} />
                </div>
                <span className="text-sm font-semibold text-gray-800">Daily Summary</span>
              </button>
              <button
                onClick={() => router.push("/calendar")}
                className="flex-1 flex items-center gap-2 px-3 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <FiCalendar className="text-blue-600" size={13} />
                </div>
                <span className="text-sm font-semibold text-gray-800">Calendar</span>
              </button>
            </div>

            {/* Upcoming meetups */}
            {upcomingMeetups.length > 0 && (
              <div>
                <p className="text-sm font-bold text-gray-800 mb-2">Upcoming Meetups</p>
                <div className="space-y-2">
                  {upcomingMeetups.map((m) => {
                    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
                    return (
                      <div
                        key={m.id}
                        onClick={() => router.push("/calendar")}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-blue-600">{d.getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{m.personName}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {m.location ? ` · ${m.location}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={() => router.push("/calendar")} className="w-full text-center text-xs font-semibold text-blue-600 py-1">
                    See all →
                  </button>
                </div>
              </div>
            )}

            {/* Period selector */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    period === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* My Stats */}
            <p className="text-lg font-bold text-gray-800">My Stats</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {myMetrics.map((m) => (
                <StatCard key={m.label} {...m} loading={statsLoading} />
              ))}
            </div>

            {/* Team Stats */}
            {profile?.teamId && (
              <>
                <p className="text-lg font-bold text-gray-800 pt-1">Team Stats</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {teamMetrics.map((m) => (
                    <StatCard key={m.label} {...m} loading={statsLoading} />
                  ))}
                </div>
              </>
            )}

          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
