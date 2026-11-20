"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByMinistry, getCGsByTeam, getAllUsers, addCG, getCoreTeamsByTeam, addCoreTeam, deleteCoreTeam, getPeopleByAssignee, updatePerson } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import SearchBar from "@/components/SearchBar";
import ContactLine from "@/components/ContactActions";
import { Avatar, RoleTag } from "@/components/ui";

const TABS = ["Connect Groups", "Core Team"];

// Tile and dot colour for a ministry team, cycled by its place in the list.
const TEAM_COLORS = [
  { tile: "bg-tint-rose", dot: "bg-tint-rose-ink" },
  { tile: "bg-role-cgl", dot: "bg-role-cgl-ink" },
  { tile: "bg-tint-teal", dot: "bg-tint-teal-ink" },
  { tile: "bg-role-disciple", dot: "bg-role-disciple-ink" },
  { tile: "bg-role-core", dot: "bg-role-core-ink" },
  { tile: "bg-role-contact", dot: "bg-role-contact-ink" },
];

function teamColor(index) {
  return TEAM_COLORS[Math.max(index, 0) % TEAM_COLORS.length];
}

const ICON_PATHS = {
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
  layers: "M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4",
  people: "M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3 19c.6-3.4 3-5 6-5s5.4 1.6 6 5M16.5 6.7a2.4 2.4 0 0 1 0 4.6M17 14c2.2.2 3.6 1.6 4 4",
};

// The line icons the boards draw. A size class in `className` overrides `size`.
function Icon({ name, size = 16, stroke = 2, className = "" }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

// A group or team row: taller and roomier on laptops.
const ROW_CLASS =
  "flex min-h-[68px] w-full items-center gap-3 rounded-[20px] px-3 py-2.5 text-left text-ink transition-colors";
const SEARCH_PHONE = "h-12 rounded-2xl";
const SOFT_INPUT =
  "h-11 w-full rounded-[14px] bg-white px-3.5 text-[15px] font-normal text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand";
const SHEET_INPUT =
  "h-12 w-full rounded-[14px] bg-white px-3.5 text-base font-normal text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand";

function Loading() {
  return (
    <div role="status" aria-label="Loading" className="flex justify-center py-[72px]">
      <span aria-hidden="true" className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
    </div>
  );
}

// Empty list: an outlined card. `plain` drops the card for use inside a panel.
function EmptyPanel({ icon, title, hint, action, plain = false }) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 text-center ${
        plain ? "px-4 pb-8 pt-7" : "rounded-3xl bg-white px-6 py-12 ring-1 ring-line-soft"
      }`}
    >
      <span aria-hidden="true" className="mb-2 flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
        <Icon name={icon} size={26} stroke={1.9} />
      </span>
      <p className="text-[17px] font-bold tracking-[-0.015em]">{title}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// Bottom sheet, phones only: laptops draw the same form inline in the page.
function Sheet({ title, onClose, gap = "gap-3.5", children }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[80vh] w-full flex-col rounded-t-[28px] bg-white px-5 pt-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] ${gap}`}
      >
        <div className="flex items-center justify-between gap-2.5">
          <h2 className="text-xl font-bold tracking-[-0.02em]">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-fill text-ink transition-colors hover:bg-line-soft"
          >
            <Icon name="close" size={18} stroke={2.2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const CG_ROW = "grid grid-cols-[40px_minmax(0,1.5fr)_minmax(0,2fr)_24px] items-center gap-x-3.5 px-3.5";

export default function Groups() {
  const { loading, profile, user } = useRequireAuth();
  const router = useRouter();
  const [tab, setTab] = useState("Connect Groups");
  const [search, setSearch] = useState("");
  // Filters the members of the open team; `search` filters the lists.
  const [rosterSearch, setRosterSearch] = useState("");

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
    let live = true;
    setFetching(true);
    setSearch("");
    setSelectedTeam(null);
    if (tab === "Connect Groups") {
      Promise.all([getCGsByTeam(profile.teamId), getAllUsers()])
        .then(([c, u]) => { setCgs(c); setUsers(u); })
        .finally(() => setFetching(false));
    } else {
      getCoreTeamsByTeam(profile.teamId)
        .then((teams) => {
          setCoreTeams(teams);
          // Laptops show list and team side by side, so open the first team.
          if (live && teams.length > 0 && window.matchMedia("(min-width: 768px)").matches) setSelectedTeam(teams[0]);
        })
        .finally(() => setFetching(false));
    }
    return () => { live = false; };
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

  const isCG = tab === "Connect Groups";
  const drilled = !isCG && !!selectedTeam;

  const filteredCGs = cgs.filter((cg) => cg.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredTeams = coreTeams.filter((t) => t.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredPeople = teamPeople.filter((p) => p.name?.toLowerCase().includes(rosterSearch.toLowerCase()));

  const candidates = allPeople.filter((p) => p.name?.toLowerCase().includes(memberSearch.toLowerCase()));

  // The new-group form of the open tab: a sheet on phones, inline on laptops.
  const add = isCG
    ? { open: showAddCG, setOpen: setShowAddCG, value: newCGName, setValue: setNewCGName, busy: addingCG, submit: handleAddCG, button: "New connect group", title: "New Connect Group", placeholder: "Connect Group name", cta: "Create group" }
    : { open: showAddTeam, setOpen: setShowAddTeam, value: newTeamName, setValue: setNewTeamName, busy: addingTeam, submit: handleAddTeam, button: "New ministry team", title: "New Ministry Team", placeholder: "Team name (e.g. Worship)", cta: "Create team" };
  const closeAdd = () => { add.setOpen(false); add.setValue(""); };
  const toggleAdd = () => { if (add.open) closeAdd(); else add.setOpen(true); };

  const pickTab = (t) => {
    setTab(t);
    setSelectedTeam(null);
    setShowAddCG(false);
    setShowAddTeam(false);
    setNewCGName("");
    setNewTeamName("");
    setShowAddMember(false);
    setRosterSearch("");
  };
  const pickTeam = (team) => { setSelectedTeam(team); setShowAddMember(false); setRosterSearch(""); };
  const backToTeams = () => { setSelectedTeam(null); setSearch(""); setShowAddMember(false); setRosterSearch(""); };
  const toggleAddMember = () => { if (showAddMember) setShowAddMember(false); else openAddMember(); };

  const newButton = (
    <button
      type="button"
      onClick={toggleAdd}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-brand px-[18px] font-semibold text-white transition-colors hover:bg-navy"
    >
      <Icon name="plus" size={17} stroke={2.3} /> {add.button}
    </button>
  );

  return (
    <>
      <PageShell
        title="Groups"
        rightAction={
          <>
            <div className="hidden w-80 max-w-full md:block">
              <SearchBar value={search} onChange={setSearch} placeholder="Search by name" className="h-11 rounded-[14px]" />
            </div>
            <button
              type="button"
              aria-label={add.button}
              aria-expanded={add.open}
              onClick={toggleAdd}
              className={`${drilled ? "hidden md:inline-flex" : "inline-flex"} h-11 w-11 items-center justify-center gap-2 rounded-[14px] bg-brand font-semibold text-white transition-colors hover:bg-navy md:w-auto md:px-[18px] md:shadow-brand`}
            >
              <Icon name="plus" stroke={2.3} className="h-5 w-5 md:h-[17px] md:w-[17px]" />
              <span className="hidden md:inline">{add.button}</span>
            </button>
            {drilled && (
              <button
                type="button"
                aria-label="Delete team"
                onClick={() => handleDeleteTeam(selectedTeam)}
                className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-fill text-warn-ink transition-colors hover:bg-line-soft md:hidden"
              >
                <Icon name="trash" size={19} />
              </button>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-3 md:gap-[18px]">
          {/* Tabs */}
          <div role="tablist" aria-label="Group type" className="flex gap-1 rounded-2xl bg-fill p-1 md:self-start md:rounded-[14px]">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => pickTab(t)}
                className={`h-11 flex-1 rounded-xl text-sm font-semibold transition-colors md:h-10 md:flex-none md:rounded-[10px] md:px-[18px] ${
                  tab === t ? "bg-white text-ink shadow-[0_1px_3px_rgb(20_30_60/0.12)]" : "text-muted hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* New group / team, inline on laptops */}
          {add.open && (
            <form onSubmit={add.submit} className="hidden flex-wrap items-end gap-3 rounded-3xl bg-brand-soft px-5 pb-5 pt-[18px] md:flex">
              <label className="flex flex-[1_1_320px] flex-col gap-1.5 text-sm font-semibold">
                {add.title}
                <input
                  autoFocus
                  value={add.value}
                  onChange={(e) => add.setValue(e.target.value)}
                  placeholder={add.placeholder}
                  className={SOFT_INPUT}
                />
              </label>
              <button
                type="button"
                onClick={closeAdd}
                className="h-11 rounded-[14px] bg-white px-4 font-semibold text-ink ring-1 ring-line transition-colors hover:bg-tint"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={add.busy || !add.value.trim()}
                className="h-11 rounded-[14px] bg-brand px-5 font-semibold text-white transition-colors hover:bg-navy disabled:cursor-not-allowed disabled:opacity-50"
              >
                {add.busy ? "Creating…" : add.cta}
              </button>
            </form>
          )}

          {/* Connect Groups tab */}
          {isCG && (
            <div role="tabpanel" aria-label="Connect Groups" className="flex flex-col gap-3">
              <div className="md:hidden">
                <SearchBar value={search} onChange={setSearch} placeholder="Search by name" className={SEARCH_PHONE} />
              </div>
              {fetching ? <Loading /> : filteredCGs.length === 0 ? (
                <EmptyPanel icon="layers" title="No Connect Groups found." action={newButton} />
              ) : (
                <>
                <ul className="flex flex-col gap-2 md:hidden">
                  {filteredCGs.map((cg) => (
                    <li key={cg.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/cg/${cg.id}`)}
                        className={`${ROW_CLASS} bg-tint hover:bg-fill md:min-h-[76px] md:gap-3.5 md:px-4 md:py-3.5`}
                      >
                        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand md:h-12 md:w-12 md:rounded-[15px]">
                          <Icon name="layers" stroke={1.9} className="h-[21px] w-[21px] md:h-[22px] md:w-[22px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-semibold tracking-[-0.01em]">{cg.name}</span>
                          <span className="block truncate text-[13px] text-muted">{leaderNames(cg)}</span>
                        </span>
                        <Icon name="chevronRight" className="text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
                {/* Laptop: the same table look as My people */}
                <div role="table" aria-label="Connect Groups" className="hidden flex-col gap-0.5 md:flex">
                  <div role="row" className={`${CG_ROW} h-[30px] text-[13px] font-bold`}>
                    <span role="columnheader" />
                    <span role="columnheader">Name</span>
                    <span role="columnheader">Leaders</span>
                    <span role="columnheader" />
                  </div>
                  {filteredCGs.map((cg, i) => (
                    <div
                      key={cg.id}
                      role="row"
                      onClick={() => router.push(`/cg/${cg.id}`)}
                      className={`${CG_ROW} min-h-[62px] cursor-pointer rounded-2xl transition-colors hover:bg-brand-soft ${i % 2 === 0 ? "bg-tint" : "bg-white"}`}
                    >
                      <span role="cell" aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-brand-soft text-brand">
                        <Icon name="layers" stroke={1.9} className="h-5 w-5" />
                      </span>
                      <span role="cell" className="min-w-0">
                        {/* The click is handled by the row; the button makes it reachable by keyboard. */}
                        <button type="button" className="max-w-full truncate text-left text-[15px] font-semibold">{cg.name}</button>
                      </span>
                      <span role="cell" className="truncate text-[15px] text-ink-2">{leaderNames(cg)}</span>
                      <span role="cell" className="flex justify-end text-muted"><Icon name="chevronRight" /></span>
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>
          )}

          {/* Core Team tab: list then team on phones, side by side on laptops */}
          {!isCG && (
            <div role="tabpanel" aria-label="Core Team" className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:gap-4">
              {fetching ? <div className="w-full"><Loading /></div> : (
                <>
                  <div className={`${selectedTeam ? "hidden md:flex" : "flex"} min-w-0 flex-col gap-3 md:flex-[1_1_280px]`}>
                    <div className="md:hidden">
                      <SearchBar value={search} onChange={setSearch} placeholder="Search by name" className={SEARCH_PHONE} />
                    </div>
                    {filteredTeams.length === 0 ? (
                      <EmptyPanel icon="people" title="No teams yet." hint="Tap + to add one." action={newButton} />
                    ) : (
                      <div role="group" aria-label="Ministry teams" className="flex flex-col gap-2">
                        {filteredTeams.map((team) => {
                          const s = teamColor(coreTeams.indexOf(team));
                          const on = selectedTeam?.id === team.id;
                          return (
                            <button
                              key={team.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => pickTeam(team)}
                              className={`${ROW_CLASS} md:min-h-[72px] md:gap-3.5 md:px-4 md:py-3 ${
                                on ? "bg-brand-soft ring-2 ring-inset ring-brand" : "bg-tint hover:bg-fill"
                              }`}
                            >
                              <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${s.tile}`}>
                                <span className={`h-3 w-3 rounded-full ${s.dot}`} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-base font-semibold tracking-[-0.01em]">{team.name}</span>
                                <span className="block text-[13px] text-muted">Ministry team</span>
                              </span>
                              <Icon name="chevronRight" className="text-muted" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedTeam ? (
                    <section
                      aria-label="Selected team"
                      className="flex min-w-0 flex-col gap-2.5 md:flex-[1.7_1_420px] md:gap-3.5 md:rounded-3xl md:bg-white md:px-[22px] md:pb-3.5 md:pt-5 md:shadow-card"
                    >
                      <button
                        type="button"
                        onClick={backToTeams}
                        className="inline-flex h-11 items-center gap-1.5 self-start font-semibold text-brand hover:text-navy md:hidden"
                      >
                        <Icon name="chevronLeft" stroke={2.2} /> All teams
                      </button>

                      <div className="hidden flex-wrap items-center justify-between gap-2.5 md:flex">
                        <h2 className="text-[22px] font-bold tracking-[-0.02em]">{selectedTeam.name}</h2>
                        <button
                          type="button"
                          onClick={() => handleDeleteTeam(selectedTeam)}
                          className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-white px-4 font-semibold text-warn-ink ring-1 ring-line transition-colors hover:bg-tint"
                        >
                          <Icon name="trash" size={17} /> Delete team
                        </button>
                      </div>

                      <div className="flex flex-col gap-1 rounded-[18px] bg-tint px-4 py-3 text-[15px] md:gap-1.5 md:rounded-2xl">
                        <p className="text-[13px] font-bold">Team info</p>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted">Team</span>
                          <span className="text-right font-semibold">{selectedTeam.name}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted">Members</span>
                          <span className="font-semibold">{drillFetching ? "—" : teamPeople.length}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="flex-auto text-[17px] font-bold tracking-[-0.015em]">Members</h3>
                        <div className="order-last w-full md:order-none md:w-[220px]">
                          <SearchBar
                            value={rosterSearch}
                            onChange={setRosterSearch}
                            placeholder="Search by name"
                            className="h-12 rounded-2xl md:h-11 md:rounded-[14px]"
                          />
                        </div>
                        <button
                          type="button"
                          aria-expanded={showAddMember}
                          onClick={toggleAddMember}
                          className="inline-flex h-11 items-center gap-1.5 rounded-[14px] bg-brand-soft px-3.5 text-sm font-semibold text-brand transition-colors hover:bg-role-contact md:gap-2 md:px-4 md:text-[15px]"
                        >
                          <Icon name="plus" stroke={2.2} className="md:h-[17px] md:w-[17px]" /> Add member
                        </button>
                      </div>

                      {/* Add member, inline on laptops */}
                      {showAddMember && (
                        <div className="hidden flex-col gap-2.5 rounded-[18px] bg-brand-soft p-4 md:flex">
                          <div className="flex items-center justify-between gap-2.5">
                            <p className="font-bold">Add to {selectedTeam.name}</p>
                            <button
                              type="button"
                              aria-label="Close add member"
                              onClick={() => setShowAddMember(false)}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-ink transition-colors hover:bg-tint"
                            >
                              <Icon name="close" size={17} stroke={2.2} />
                            </button>
                          </div>
                          <input
                            type="search"
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder="Search people…"
                            aria-label="Search people"
                            className={SOFT_INPUT}
                          />
                          {candidates.length === 0 ? (
                            <p className="py-5 text-center text-sm text-muted">No people to add.</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {candidates.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleAddMember(p)}
                                  disabled={addingMember}
                                  className="flex h-11 items-center justify-between gap-2 rounded-[14px] bg-white px-3.5 text-left font-medium text-ink transition-colors hover:bg-tint disabled:opacity-50"
                                >
                                  <span className="min-w-0 truncate">{p.name}</span>
                                  <Icon name="plus" stroke={2.2} className="text-brand" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {drillFetching ? <Loading /> : filteredPeople.length === 0 ? (
                        <EmptyPanel plain icon="people" title={`No one in ${selectedTeam.name} team.`} />
                      ) : (
                        <ul className="-mt-1 md:mt-0">
                          {filteredPeople.map((p) => {
                            const roles = p.roles || [];
                            return (
                              <li key={p.id} className="flex min-h-16 items-center gap-3 md:min-h-[66px]">
                                <Avatar name={p.name} />
                                {/* The name opens the person; the handle below may be its own link. */}
                                <div className="min-w-0 flex-1 text-ink">
                                  <button type="button" onClick={() => router.push(`/person/${p.id}`)} className="block max-w-full text-left">
                                    <span className="block truncate text-base font-semibold tracking-[-0.01em] md:hidden">{p.name}</span>
                                    <span className="hidden flex-wrap items-center gap-1.5 text-[15px] font-semibold md:flex">
                                      {p.name}
                                      {roles.map((r) => <RoleTag key={r} role={r} className="md:h-[22px] md:px-[9px] md:text-xs" />)}
                                    </span>
                                  </button>
                                  <ContactLine contactType={p.contactType} contact={p.contact} className="mt-0.5" />
                                </div>
                                {/* Everyone listed is Core Team, so phones show the other roles only. */}
                                <span className="flex max-w-[40%] shrink-0 flex-wrap justify-end gap-1 empty:hidden md:hidden">
                                  {roles.filter((r) => r !== "Core Team").map((r) => <RoleTag key={r} role={r} />)}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Remove ${p.name} from team`}
                                  onClick={() => handleRemoveMember(p)}
                                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-fill text-ink transition-colors hover:bg-line-soft"
                                >
                                  <Icon name="close" stroke={2.2} />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  ) : coreTeams.length > 0 && (
                    <section
                      aria-label="Selected team"
                      className="hidden min-w-0 flex-[1.7_1_420px] rounded-3xl bg-white px-[22px] py-12 text-center text-muted shadow-card md:block"
                    >
                      Pick a team to see its members.
                    </section>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </PageShell>

      {/* New group / team sheet (phones) */}
      {add.open && (
        <Sheet title={add.title} onClose={closeAdd}>
          <form onSubmit={add.submit} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Name
              <input
                autoFocus
                value={add.value}
                onChange={(e) => add.setValue(e.target.value)}
                placeholder={add.placeholder}
                className={SHEET_INPUT}
              />
            </label>
            <button
              type="submit"
              disabled={add.busy || !add.value.trim()}
              className="h-12 rounded-2xl bg-brand text-base font-semibold text-white transition-colors hover:bg-navy disabled:cursor-not-allowed disabled:opacity-50"
            >
              {add.busy ? "Creating…" : add.cta}
            </button>
          </form>
        </Sheet>
      )}

      {/* Add member sheet (phones) */}
      {showAddMember && (
        <Sheet title={`Add to ${selectedTeam?.name}`} onClose={() => setShowAddMember(false)} gap="gap-3">
          <input
            type="search"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search people…"
            aria-label="Search people"
            className={`${SHEET_INPUT} shrink-0`}
          />
          <div className="-mx-1 flex flex-1 flex-col gap-3 overflow-y-auto px-1 py-1">
            {candidates.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted">No people to add.</p>
            ) : (
              candidates.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAddMember(p)}
                  disabled={addingMember}
                  className="flex h-12 w-full shrink-0 items-center justify-between gap-2 rounded-[14px] bg-tint px-3.5 text-left font-medium text-ink transition-colors hover:bg-brand-soft disabled:opacity-50"
                >
                  <span className="min-w-0 truncate">{p.name}</span>
                  <Icon name="plus" stroke={2.2} className="text-brand" />
                </button>
              ))
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}
