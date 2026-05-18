"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByMinistry, getCGsByTeam, getAllUsers, addCG, getCoreTeamsByTeam, addCoreTeam, deleteCoreTeam, getPeopleByAssignee, updatePerson } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import PersonCard from "@/components/PersonCard";
import Spinner from "@/components/Spinner";
import SearchBar from "@/components/SearchBar";
import { FiPlus, FiX, FiChevronRight, FiArrowLeft, FiTrash2 } from "react-icons/fi";
import { FaChurch } from "react-icons/fa";

const TABS = ["Connect Groups", "Core Team"];

const TEAM_COLORS = [
  { bg: "bg-pink-50",   icon: "bg-pink-100",   text: "text-pink-600",   dot: "bg-pink-400"   },
  { bg: "bg-cyan-50",   icon: "bg-cyan-100",    text: "text-cyan-600",   dot: "bg-cyan-400"   },
  { bg: "bg-amber-50",  icon: "bg-amber-100",   text: "text-amber-600",  dot: "bg-amber-400"  },
  { bg: "bg-violet-50", icon: "bg-violet-100",  text: "text-violet-600", dot: "bg-violet-400" },
  { bg: "bg-emerald-50",icon: "bg-emerald-100", text: "text-emerald-600",dot: "bg-emerald-400"},
  { bg: "bg-orange-50", icon: "bg-orange-100",  text: "text-orange-600", dot: "bg-orange-400" },
];

function teamColor(index) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

export default function Groups() {
  const { loading, profile, user } = useRequireAuth();
  const router = useRouter();
  const [tab, setTab] = useState("Connect Groups");
  const [search, setSearch] = useState("");

  // Connect Groups state
  const [cgs, setCgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAddCG, setShowAddCG] = useState(false);
  const [newCGName, setNewCGName] = useState("");
  const [addingCG, setAddingCG] = useState(false);

  // Core Team state
  const [coreTeams, setCoreTeams] = useState([]);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [addingTeam, setAddingTeam] = useState(false);

  // Drill-down state
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamPeople, setTeamPeople] = useState([]);

  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [allPeople, setAllPeople] = useState([]);
  const [addingMember, setAddingMember] = useState(false);

  const [fetching, setFetching] = useState(true);
  const [drillFetching, setDrillFetching] = useState(false);

  useEffect(() => {
    if (!profile?.teamId) return;
    setFetching(true);
    setSearch("");
    setSelectedTeam(null);
    if (tab === "Connect Groups") {
      Promise.all([getCGsByTeam(profile.teamId), getAllUsers()])
        .then(([c, u]) => { setCgs(c); setUsers(u); })
        .finally(() => setFetching(false));
    } else {
      getCoreTeamsByTeam(profile.teamId).then(setCoreTeams).finally(() => setFetching(false));
    }
  }, [tab, profile?.teamId]);

  useEffect(() => {
    if (!selectedTeam || !profile?.teamId) return;
    setDrillFetching(true);
    setSearch("");
    getPeopleByMinistry(selectedTeam.name, profile.teamId).then(setTeamPeople).finally(() => setDrillFetching(false));
  }, [selectedTeam]);

  const handleAddCG = async (e) => {
    e.preventDefault();
    if (!newCGName.trim()) return;
    setAddingCG(true);
    try {
      await addCG({ name: newCGName.trim(), teamId: profile?.teamId || "" });
      setNewCGName("");
      setShowAddCG(false);
      const [c, u] = await Promise.all([getCGsByTeam(profile.teamId), getAllUsers()]);
      setCgs(c); setUsers(u);
    } finally {
      setAddingCG(false);
    }
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setAddingTeam(true);
    try {
      await addCoreTeam({ name: newTeamName.trim(), teamId: profile?.teamId || "" });
      setNewTeamName("");
      setShowAddTeam(false);
      getCoreTeamsByTeam(profile.teamId).then(setCoreTeams);
    } finally {
      setAddingTeam(false);
    }
  };

  const leaderNames = (cg) =>
    (cg.leaders || []).map((uid) => users.find((u) => u.id === uid)?.name || uid).join(", ") || "No leaders";

  const handleDeleteTeam = async (team) => {
    if (!confirm(`Delete "${team.name}" team? This cannot be undone.`)) return;
    const teamMembers = await getPeopleByMinistry(team.name, profile?.teamId);
    await Promise.all(teamMembers.map((p) => {
      const newMinistries = (p.ministries || []).filter((m) => m !== team.name);
      const newRoles = newMinistries.length === 0
        ? (p.roles || []).filter((r) => r !== "Core Team")
        : (p.roles || []);
      return updatePerson(p.id, { ministries: newMinistries, roles: newRoles });
    }));
    await deleteCoreTeam(team.id);
    setCoreTeams((prev) => prev.filter((t) => t.id !== team.id));
    setSelectedTeam(null);
  };

  const handleRemoveMember = async (person) => {
    if (!selectedTeam) return;
    const newMinistries = (person.ministries || []).filter((m) => m !== selectedTeam.name);
    const newRoles = newMinistries.length === 0
      ? (person.roles || []).filter((r) => r !== "Core Team")
      : (person.roles || []);
    await updatePerson(person.id, { ministries: newMinistries, roles: newRoles });
    setTeamPeople((prev) => prev.filter((p) => p.id !== person.id));
  };

  const openAddMember = async () => {
    if (!user || !selectedTeam) return;
    const people = await getPeopleByAssignee(user.uid);
    const inTeam = new Set(teamPeople.map((p) => p.id));
    setAllPeople(people.filter((p) => !inTeam.has(p.id)));
    setMemberSearch("");
    setShowAddMember(true);
  };

  const handleAddMember = async (person) => {
    if (!selectedTeam) return;
    setAddingMember(true);
    const newRoles = [...new Set([...(person.roles || []), "Core Team"])];
    const newMinistries = [...new Set([...(person.ministries || []), selectedTeam.name])];
    await updatePerson(person.id, { roles: newRoles, ministries: newMinistries, teamId: profile?.teamId || "" });
    const updated = await getPeopleByMinistry(selectedTeam.name, profile?.teamId);
    setTeamPeople(updated);
    setAllPeople((prev) => prev.filter((p) => p.id !== person.id));
    setAddingMember(false);
  };

  if (loading) return null;

  const filteredCGs = cgs.filter((cg) => cg.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredTeams = coreTeams.filter((t) => t.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredPeople = teamPeople.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PageShell
        title="Groups"
        rightAction={
          tab === "Connect Groups" && !selectedTeam ? (
            <button onClick={() => setShowAddCG(true)} className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FiPlus size={18} />
            </button>
          ) : tab === "Core Team" && !selectedTeam ? (
            <button onClick={() => setShowAddTeam(true)} className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <FiPlus size={18} />
            </button>
          ) : tab === "Core Team" && selectedTeam ? (
            <button
              onClick={() => handleDeleteTeam(selectedTeam)}
              className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center active:opacity-70"
            >
              <FiTrash2 size={16} />
            </button>
          ) : null
        }
      >
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedTeam(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Connect Groups tab */}
        {tab === "Connect Groups" && (
          <>
            <SearchBar value={search} onChange={setSearch} />
            {fetching ? <Spinner /> : filteredCGs.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-12">No Connect Groups found.</p>
            ) : (
              <div className="space-y-2.5">
                {filteredCGs.map((cg) => (
                  <div key={cg.id} onClick={() => router.push(`/cg/${cg.id}`)}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <FaChurch className="text-blue-500" size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{cg.name}</p>
                      <p className="text-xs text-gray-600 mt-0.5 truncate">{leaderNames(cg)}</p>
                    </div>
                    <FiChevronRight size={16} className="text-gray-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Core Team — list */}
        {tab === "Core Team" && !selectedTeam && (
          <>
            <SearchBar value={search} onChange={setSearch} />
            {fetching ? <Spinner /> : filteredTeams.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-12">No teams yet. Tap + to add one.</p>
            ) : (
              <div className="space-y-2.5">
                {filteredTeams.map((team, i) => {
                  const s = teamColor(i);
                  return (
                    <div key={team.id} onClick={() => setSelectedTeam(team)}
                      className={`${s.bg} rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform`}
                    >
                      <div className={`w-11 h-11 rounded-xl ${s.icon} flex items-center justify-center shrink-0`}>
                        <span className={`w-3 h-3 rounded-full ${s.dot}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold ${s.text}`}>{team.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Ministry Team</p>
                      </div>
                      <FiChevronRight size={16} className="text-gray-400 shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Core Team — drill-down */}
        {tab === "Core Team" && selectedTeam && (
          <>
            <button onClick={() => { setSelectedTeam(null); setSearch(""); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 mb-4"
            >
              <FiArrowLeft size={15} /> All Teams
            </button>
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Team Info</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Team</span>
                <span className="text-gray-900 font-medium">{selectedTeam.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Members</span>
                <span className="text-gray-900 font-medium">{drillFetching ? "—" : teamPeople.length}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Members</p>
              <button
                onClick={openAddMember}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 text-xs font-semibold"
              >
                <FiPlus size={13} /> Add Member
              </button>
            </div>
            <SearchBar value={search} onChange={setSearch} />
            {drillFetching ? <Spinner /> : filteredPeople.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-12">No one in {selectedTeam.name} team.</p>
            ) : (
              <div className="space-y-2.5">
                {filteredPeople.map((p) => <PersonCard key={p.id} person={p} onRemove={handleRemoveMember} />)}
              </div>
            )}
          </>
        )}
      </PageShell>

      {/* Add CG modal */}
      {showAddCG && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowAddCG(false); setNewCGName(""); }} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <p className="font-bold text-gray-900 text-base">New Connect Group</p>
              <button onClick={() => { setShowAddCG(false); setNewCGName(""); }}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <FiX size={15} />
              </button>
            </div>
            <form onSubmit={handleAddCG} className="space-y-3">
              <input
                autoFocus
                value={newCGName}
                onChange={(e) => setNewCGName(e.target.value)}
                placeholder="Connect Group name"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-500"
              />
              <button type="submit" disabled={addingCG || !newCGName.trim()}
                className="w-full py-3 bg-linear-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-opacity">
                {addingCG ? "Creating…" : "Create Group"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Core Team modal */}
      {showAddTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowAddTeam(false); setNewTeamName(""); }} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <p className="font-bold text-gray-900 text-base">New Ministry Team</p>
              <button onClick={() => { setShowAddTeam(false); setNewTeamName(""); }}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <FiX size={15} />
              </button>
            </div>
            <form onSubmit={handleAddTeam} className="space-y-3">
              <input
                autoFocus
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team name (e.g. Worship)"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-orange-400"
              />
              <button type="submit" disabled={addingTeam || !newTeamName.trim()}
                className="w-full py-3 bg-linear-to-r from-orange-400 to-amber-500 text-white font-semibold rounded-xl shadow-md shadow-orange-400/20 disabled:opacity-50 transition-opacity">
                {addingTeam ? "Creating…" : "Create Team"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Member modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddMember(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl flex flex-col" style={{ maxHeight: "70vh" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900">Add to {selectedTeam?.name}</p>
              <button onClick={() => setShowAddMember(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <FiX size={15} />
              </button>
            </div>
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search people…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 mb-3"
            />
            <div className="overflow-y-auto flex-1 space-y-2">
              {allPeople.filter((p) => p.name?.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-6">No people to add.</p>
              ) : (
                allPeople
                  .filter((p) => p.name?.toLowerCase().includes(memberSearch.toLowerCase()))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAddMember(p)}
                      disabled={addingMember}
                      className="w-full text-left px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 hover:bg-orange-50 hover:text-orange-700 transition-colors disabled:opacity-50"
                    >
                      {p.name}
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

