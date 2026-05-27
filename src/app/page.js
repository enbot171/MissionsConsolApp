"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByAssignee, getUsersByTeam, getNoContactByAssignee, getNoContactByTeam } from "@/lib/firestore";
import BottomNav from "@/components/BottomNav";
import Spinner from "@/components/Spinner";

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

function StatCard({ label, value, border, text, loading }) {
  return (
    <div className={`bg-white rounded-2xl border-2 ${border} p-4`}>
      <p className="text-gray-600 text-xs font-medium leading-tight">{label}</p>
      <p className={`${text} text-3xl font-bold mt-1`}>{loading ? "—" : value}</p>
    </div>
  );
}

function CountBadge({ label, value, loading }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-4 py-3">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <span className="text-xl font-bold text-gray-900">{loading ? "—" : value}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile, loading } = useRequireAuth();
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

  const myDisciples = myPeople.filter((p) => (p.roles || []).includes("Disciple")).length;
  const teamDisciples = teamPeople.filter((p) => (p.roles || []).includes("Disciple")).length;
  const teamCoreTeam = teamPeople.filter((p) => (p.roles || []).includes("Core Team")).length;

  const myMetrics = [
    { label: "Contacts Made", value: myStats?.contacts, border: "border-blue-400", text: "text-blue-600" },
    { label: "Gospel Shared", value: myStats?.gospelShared, border: "border-indigo-400", text: "text-indigo-600" },
    { label: "Prayed For", value: myStats?.prayedFor, border: "border-emerald-400", text: "text-emerald-600" },
    { label: "Salvations", value: myStats?.salvations, border: "border-amber-400", text: "text-amber-600" },
  ];

  const teamMetrics = [
    { label: "Contacts Made", value: teamStats?.contacts, border: "border-blue-400", text: "text-blue-600" },
    { label: "Gospel Shared", value: teamStats?.gospelShared, border: "border-indigo-400", text: "text-indigo-600" },
    { label: "Prayed For", value: teamStats?.prayedFor, border: "border-emerald-400", text: "text-emerald-600" },
    { label: "Salvations", value: teamStats?.salvations, border: "border-amber-400", text: "text-amber-600" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="bg-linear-to-br from-blue-600 to-indigo-700 px-5 pt-12 pb-8">
        <div className="max-w-lg mx-auto">
          <p className="text-blue-200 text-sm font-medium">Welcome back</p>
          <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">
            {profile?.name || "—"}
          </h1>
          <span className="inline-block mt-2 text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium">
            {profile?.role || "Member"}
          </span>
        </div>
      </div>

      <main className="flex-1 pb-24 -mt-4">
        <div className="px-4 max-w-lg mx-auto space-y-4">

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
          <div className="grid grid-cols-2 gap-3">
            {myMetrics.map((m) => (
              <StatCard key={m.label} {...m} loading={statsLoading} />
            ))}
          </div>
          <CountBadge label="Talked To (incl. no contact)" value={statsLoading ? null : countTalkedTo(myPeople, myNoContact, period)} loading={statsLoading} />
          <CountBadge label="Active Disciples" value={myDisciples} loading={statsLoading} />

          {/* Team Stats */}
          {profile?.teamId && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">Team Stats</p>
              <div className="grid grid-cols-2 gap-3">
                {teamMetrics.map((m) => (
                  <StatCard key={m.label} {...m} loading={statsLoading} />
                ))}
              </div>
              <CountBadge label="Talked To (incl. no contact)" value={statsLoading ? null : countTalkedTo(teamPeople, teamNoContact, period)} loading={statsLoading} />
              <CountBadge label="Active Disciples" value={teamDisciples} loading={statsLoading} />
              <CountBadge label="Active Core Team" value={teamCoreTeam} loading={statsLoading} />
            </>
          )}

        </div>
      </main>

      <BottomNav />
    </div>
  );
}
