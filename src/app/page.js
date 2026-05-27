"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByAssignee, getUsersByTeam, getNoContactByAssignee, getNoContactByTeam } from "@/lib/firestore";
import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";
import Spinner from "@/components/Spinner";
import { useSidebar } from "@/context/SidebarContext";

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

function countTalkedTo(contacts, noContact, period) {
  const start = getPeriodStart(period);
  const all = [...contacts, ...noContact];
  if (!start) return all.length;
  return all.filter((p) => { const d = toDate(p.createdAt); return d && d >= start; }).length;
}

function computeStats(people, period) {
  const start = getPeriodStart(period);
  const filtered = start
    ? people.filter((p) => { const d = toDate(p.createdAt); return d && d >= start; })
    : people;
  return {
    contacts: filtered.length,
    gospelShared: filtered.filter((p) => p.gospelShared).length,
    prayedFor: filtered.filter((p) => p.prayed).length,
    salvations: filtered.filter((p) => p.saved).length,
  };
}

function StatCard({ label, value, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <p className="text-gray-700 text-sm font-bold leading-tight">{label}</p>
      <p className="text-gray-900 text-3xl font-bold mt-1">{loading ? "—" : value ?? "—"}</p>
    </div>
  );
}


export default function Dashboard() {
  const { user, profile, loading } = useRequireAuth();
  const { collapsed } = useSidebar();
  const ml = collapsed ? "md:ml-16" : "md:ml-60";
  const [myPeople, setMyPeople] = useState([]);
  const [teamPeople, setTeamPeople] = useState([]);
  const [myNoContact, setMyNoContact] = useState([]);
  const [teamNoContact, setTeamNoContact] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [period, setPeriod] = useState("Weekly");

  useEffect(() => {
    if (!user) return;
    setStatsLoading(true);
    const fetchAll = async () => {
      const [mine, myNC, teamUsers] = await Promise.all([
        getPeopleByAssignee(user.uid),
        getNoContactByAssignee(user.uid),
        profile?.teamId ? getUsersByTeam(profile.teamId) : Promise.resolve([]),
      ]);
      setMyPeople(mine);
      setMyNoContact(myNC);
      if (teamUsers.length > 0) {
        const [allSets, teamNC] = await Promise.all([
          Promise.all(teamUsers.map((u) => getPeopleByAssignee(u.id))),
          profile?.teamId ? getNoContactByTeam(profile.teamId) : Promise.resolve([]),
        ]);
        const deduped = [...new Map(allSets.flat().map((p) => [p.id, p])).values()];
        setTeamPeople(deduped);
        setTeamNoContact(teamNC);
      }
    };
    fetchAll().finally(() => setStatsLoading(false));
  }, [user, profile?.teamId]);

  if (loading) return <Spinner fullScreen />;

  const myStats = statsLoading ? null : computeStats(myPeople, period);
  const teamStats = statsLoading ? null : computeStats(teamPeople, period);

  const myDisciples = statsLoading ? null : myPeople.filter((p) => (p.roles || []).includes("Disciple")).length;
  const teamDisciples = statsLoading ? null : teamPeople.filter((p) => (p.roles || []).includes("Disciple")).length;
  const teamCoreTeam = statsLoading ? null : teamPeople.filter((p) => (p.roles || []).includes("Core Team")).length;

  const myTalkedTo = statsLoading ? null : countTalkedTo(myPeople, myNoContact, period);
  const teamTalkedTo = statsLoading ? null : countTalkedTo(teamPeople, teamNoContact, period);

  const myMetrics = [
    { label: "Talked To",       value: myTalkedTo },
    { label: "Contacts Made",   value: myStats?.contacts },
    { label: "Gospel Shared",   value: myStats?.gospelShared },
    { label: "Prayed For",      value: myStats?.prayedFor },
    { label: "Salvations",      value: myStats?.salvations },
    { label: "Active Disciples",value: myDisciples },
  ];

  const teamMetrics = [
    { label: "Talked To",        value: teamTalkedTo },
    { label: "Contacts Made",    value: teamStats?.contacts },
    { label: "Gospel Shared",    value: teamStats?.gospelShared },
    { label: "Prayed For",       value: teamStats?.prayedFor },
    { label: "Salvations",       value: teamStats?.salvations },
    { label: "Active Disciples", value: teamDisciples },
    { label: "Active Core Team", value: teamCoreTeam },
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">My Stats</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {myMetrics.map((m) => (
                <StatCard key={m.label} {...m} loading={statsLoading} />
              ))}
            </div>

            {/* Team Stats */}
            {profile?.teamId && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">Team Stats</p>
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
