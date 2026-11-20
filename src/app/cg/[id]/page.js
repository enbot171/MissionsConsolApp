"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  getCG, updateCG, deleteCG, getUsersByTeam, getPeopleByCG, markAttendance, getAttendanceByCG,
  getPeopleByAssignee, updatePerson,
} from "@/lib/firestore";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import ContactLine from "@/components/ContactActions";
import Spinner from "@/components/Spinner";
import { Avatar, Button, Chip, Field, RoleTag, inputClass } from "@/components/ui";

// Icon paths taken from the design boards.
const I = {
  layers: "M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  cross: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  pencil: "M4 20h4l10-10-4-4L4 16zM13 7l4 4",
  people: "M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3 19c.6-3.4 3-5 6-5s5.4 1.6 6 5M16.5 6.7a2.4 2.4 0 0 1 0 4.6M17 14c2.2.2 3.6 1.6 4 4",
};

function Icon({ d, size = 17, sw = 2, className }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

const TABS = [["att", "Attendance"], ["members", "Members"], ["details", "Details"]];

// "2026-11-12" -> "12 Nov 2026". Anything else is shown as stored.
const formatDay = (dateStr = "") => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export default function CGDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { loading: authLoading, profile, user } = useRequireAuth();

  const [cg, setCg] = useState(null);
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fetching, setFetching] = useState(true);

  // Phone only: which section is showing. Laptop shows all three at once.
  const [tab, setTab] = useState("att");

  const [showAttendance, setShowAttendance] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [present, setPresent] = useState([]);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const [editing, setEditing] = useState(false);
  const [cgName, setCgName] = useState("");
  const [selectedLeaders, setSelectedLeaders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [allPeople, setAllPeople] = useState([]);
  const [addingMember, setAddingMember] = useState(false);

  const fetchAll = async () => {
    setFetching(true);
    const cgData = await getCG(id);
    const teamId = cgData?.teamId || profile?.teamId;
    const [allUsers, cgMembers, att] = await Promise.all([
      teamId ? getUsersByTeam(teamId) : [],
      getPeopleByCG(id),
      getAttendanceByCG(id),
    ]);
    setCg(cgData);
    setCgName(cgData?.name || "");
    setSelectedLeaders(cgData?.leaders || []);
    setUsers(allUsers);
    setMembers(cgMembers);
    setAttendance(att);
    setPresent(cgMembers.map((m) => m.id));
    setFetching(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  if (authLoading) return null;
  if (fetching) {
    return (
      <PageShell title={<span className="sr-only">Connect group</span>} backHref="/groups" backLabel="Groups">
        <Spinner />
      </PageShell>
    );
  }
  if (!cg) {
    return (
      <PageShell title={<span className="sr-only">Connect group</span>} backHref="/groups" backLabel="Groups">
        <div className="-mt-0.5 flex flex-col items-center gap-1.5 rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-line-soft md:-mt-2.5">
          <span aria-hidden="true" className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
            <Icon d={I.layers} size={26} sw={1.9} />
          </span>
          <p className="text-[17px] font-bold tracking-[-0.015em]">CG not found.</p>
          <Link href="/groups" className="mt-3 inline-flex h-11 items-center justify-center rounded-[14px] bg-brand px-[18px] font-semibold text-white transition-colors hover:bg-navy">
            Back to Groups
          </Link>
        </div>
      </PageShell>
    );
  }

  const leaderNames = (cg.leaders || [])
    .map((uid) => users.find((u) => u.id === uid)?.name || uid)
    .join(", ") || "No leaders";

  const handleSaveCG = async () => {
    setSaving(true);
    await updateCG(id, { name: cgName, leaders: selectedLeaders });
    setCg((c) => ({ ...c, name: cgName, leaders: selectedLeaders }));
    setEditing(false);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDeleteCG = async () => {
    if (!confirm("Delete this CG? This cannot be undone.")) return;
    await Promise.all(members.map((m) => updatePerson(m.id, { cgId: "" })));
    await deleteCG(id);
    router.push("/groups");
  };

  const toggleLeader = (uid) => {
    setSelectedLeaders((l) => l.includes(uid) ? l.filter((x) => x !== uid) : [...l, uid]);
  };

  const togglePresent = (pid) => {
    setPresent((p) => p.includes(pid) ? p.filter((x) => x !== pid) : [...p, pid]);
  };

  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    const absent = members.map((m) => m.id).filter((mid) => !present.includes(mid));
    await markAttendance(id, new Date(attendanceDate), present, absent);
    await getAttendanceByCG(id).then(setAttendance);
    setShowAttendance(false);
    setSavingAttendance(false);
  };

  const handleRemoveMember = async (person) => {
    await updatePerson(person.id, { cgId: "" });
    setMembers((prev) => prev.filter((m) => m.id !== person.id));
    setPresent((prev) => prev.filter((pid) => pid !== person.id));
  };

  const openAddMember = async () => {
    if (!user) return;
    const people = await getPeopleByAssignee(user.uid);
    const memberIds = new Set(members.map((m) => m.id));
    setAllPeople(people.filter((p) => !memberIds.has(p.id)));
    setMemberSearch("");
    setShowAddMember(true);
  };

  const handleAddMember = async (person) => {
    setAddingMember(true);
    await updatePerson(person.id, { cgId: id });
    const updated = await getPeopleByCG(id);
    setMembers(updated);
    setPresent(updated.map((m) => m.id));
    setAllPeople((prev) => prev.filter((p) => p.id !== person.id));
    setAddingMember(false);
  };

  const filteredPeople = allPeople.filter((p) =>
    p.name?.toLowerCase().includes(memberSearch.toLowerCase())
  );


  const nPresent = members.filter((m) => present.includes(m.id)).length;
  const attSummary = `${nPresent} present, ${members.length - nPresent} absent`;
  const ledBy = (cg.leaders || []).length > 0 ? `Led by ${leaderNames}` : "No leaders";
  const memberCount = `${members.length} member${members.length === 1 ? "" : "s"}`;

  // On phones only the picked tab's section shows; from md up every section does.
  const shown = (name) => (tab === name ? "flex" : "hidden");

  return (
    <PageShell
      title={
        <span className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-brand-soft text-brand md:inline-flex">
            <Icon d={I.layers} size={28} sw={1.9} />
          </span>
          <span className="min-w-0">
            <span className="block leading-[1.2] md:leading-[1.15]">{cg.name}</span>
            <span className="hidden text-[15px] font-normal leading-normal tracking-normal text-muted md:block">
              Connect Group · {ledBy} · {memberCount}
            </span>
          </span>
        </span>
      }
      backHref="/groups"
      backLabel="Groups"
      rightAction={
        <button
          type="button"
          onClick={handleDeleteCG}
          aria-label="Delete CG"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-[14px] bg-fill font-semibold text-warn-ink transition-colors hover:bg-warn-soft md:w-auto md:bg-white md:px-4 md:ring-1 md:ring-line"
        >
          <Icon d={I.trash} className="size-[19px] md:size-[17px]" />
          <span className="hidden md:inline">Delete CG</span>
        </button>
      }
    >
      <p className="-mt-4 mb-3 text-sm text-muted md:hidden">{ledBy} · {memberCount}</p>

      <div role="tablist" aria-label="Group sections" className="mb-3 flex gap-1 rounded-2xl bg-fill p-1 md:hidden">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`h-11 flex-1 rounded-xl text-sm font-semibold transition-colors ${
              tab === key ? "bg-white text-ink shadow-[0_1px_3px_rgb(20_30_60/0.12)]" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="md:flex md:flex-wrap md:items-start md:gap-4">
        <div className={`${shown("att")} min-w-0 flex-col gap-2.5 md:flex md:flex-[1.4_1_400px] md:gap-4`}>
          {/* Attendance: a collapsible card on laptop, always open on phone */}
          <section className="flex flex-col gap-2.5 md:gap-3.5 md:rounded-3xl md:bg-white md:px-[22px] md:py-3.5 md:shadow-card">
            <button
              type="button"
              aria-expanded={showAttendance}
              onClick={() => setShowAttendance((s) => !s)}
              className="hidden min-h-11 w-full items-center justify-between gap-2.5 text-left md:flex"
            >
              <span className="text-[17px] font-bold tracking-[-0.015em]">Mark attendance</span>
              <span className="inline-flex items-center gap-2.5 text-[13px] text-muted">
                {attSummary}
                <Icon d={showAttendance ? I.up : I.down} size={18} sw={2.2} className="text-ink" />
              </span>
            </button>

            <div className={`flex flex-col gap-2.5 md:gap-3.5 md:pb-2 ${showAttendance ? "" : "md:hidden"}`}>
              <label className="flex items-center justify-between gap-3 text-base font-bold tracking-[-0.01em] md:max-w-60 md:flex-col md:items-stretch md:justify-start md:gap-1.5 md:text-sm md:font-semibold md:tracking-normal">
                <span className="md:hidden">Mark attendance</span>
                <span className="hidden md:inline">Date</span>
                <input
                  type="date"
                  aria-label="Date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className={`${inputClass} shrink-0 font-normal tracking-normal max-md:w-[170px] max-md:px-3 md:min-h-11 md:text-[15px]`}
                />
              </label>

              {members.length === 0 ? (
                <p className="text-muted">No members in this CG.</p>
              ) : (
                <div role="group" aria-label="Members, tap to mark absent" className="flex flex-col gap-1.5">
                  <p className="text-[13px] text-muted">Members (tap to mark absent)</p>
                  {members.map((m) => {
                    const isPresent = present.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={isPresent}
                        onClick={() => togglePresent(m.id)}
                        className="flex min-h-[52px] w-full items-center gap-3 rounded-[18px] bg-tint py-1.5 pl-1.5 pr-3 text-left transition-colors hover:bg-fill md:min-h-14 md:pl-2 md:pr-3.5"
                      >
                        <Avatar name={m.name} className="max-md:h-10 max-md:w-10 max-md:rounded-[13px] max-md:text-[15px] md:text-[15px]" />
                        <span className="min-w-0 flex-1 truncate text-base font-semibold md:text-[15px]">{m.name}</span>
                        <span
                          className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${
                            isPresent ? "bg-ok-soft text-ok-ink" : "bg-warn-soft text-warn-ink"
                          }`}
                        >
                          <Icon d={isPresent ? I.check : I.cross} size={14} sw={2.6} />
                          {isPresent ? "Present" : "Absent"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <Button
                onClick={handleSaveAttendance}
                disabled={savingAttendance}
                className="max-md:h-12 max-md:rounded-2xl max-md:text-base max-md:shadow-none md:self-start md:px-5"
              >
                {savingAttendance ? "Saving..." : <>Save attendance<span className="md:hidden"> · {attSummary}</span></>}
              </Button>
            </div>
          </section>

          {/* Attendance history: a soft panel on phone, a card with bars on laptop */}
          {attendance.length > 0 && (
            <section className="mt-1 flex flex-col gap-0.5 rounded-[20px] bg-brand-soft px-4 py-3 md:mt-0 md:gap-1.5 md:rounded-3xl md:bg-white md:px-[22px] md:py-5 md:shadow-card">
              <div className="mb-0.5 flex items-center justify-between gap-2.5 md:mb-1">
                <h2 className="text-sm font-bold md:text-[17px] md:tracking-[-0.015em]">Attendance history</h2>
                <span className="hidden text-[13px] text-muted md:inline">Last 5 records</span>
              </div>
              {attendance.slice(0, 5).map((rec) => {
                const p = (rec.present || []).length;
                const a = (rec.absent || []).length;
                const pct = p + a > 0 ? Math.round((p / (p + a)) * 100) : 0;
                return (
                  <div key={rec.id} className="flex justify-between gap-3 text-sm leading-[1.7] md:min-h-11 md:items-center md:justify-start md:gap-3.5 md:text-[15px] md:leading-normal">
                    <span className="text-ink-2 md:w-[110px] md:shrink-0 md:font-semibold md:text-ink">{formatDay(rec.dateStr)}</span>
                    <span aria-hidden="true" className="hidden h-2 min-w-0 flex-1 overflow-hidden rounded bg-line-soft md:block">
                      <span className="block h-2 rounded bg-brand" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-right font-semibold md:shrink-0 md:text-sm md:font-normal">{p} present, {a} absent</span>
                  </div>
                );
              })}
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:flex-[1_1_320px]">
          {/* CG info, with the edit form inside the panel on laptop and under it on phone */}
          <section className={`${shown("details")} flex-col gap-3 md:flex md:gap-3.5 md:rounded-3xl md:bg-brand-soft md:px-[22px] md:pb-[22px] md:pt-5`}>
            <div className="flex flex-col gap-1 rounded-[20px] bg-brand-soft px-4 py-3.5 md:gap-3.5 md:rounded-none md:bg-transparent md:p-0">
              <h2 className="mb-0.5 text-sm font-bold md:mb-0 md:text-[17px] md:tracking-[-0.015em]">CG info</h2>
              <div className="flex flex-col gap-1 md:gap-1.5">
                <div className="flex justify-between gap-3">
                  <span className="text-ink-2">Leaders</span>
                  <span className="text-right font-semibold">{leaderNames}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-ink-2">Members</span>
                  <span className="font-semibold">{members.length}</span>
                </div>
              </div>
            </div>

            {!editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(true)} className="max-md:h-12 max-md:rounded-2xl max-md:text-base">
                  <Icon d={I.pencil} /> Edit CG
                </Button>
                {saved && (
                  <div role="status" className="flex items-center gap-2.5 rounded-[14px] bg-ok-soft px-3.5 py-3 font-medium text-ok-ink">
                    <Icon d={I.check} size={18} sw={2.4} /> Changes saved.
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-3.5">
                <h2 className="text-[17px] font-bold tracking-[-0.015em] md:text-[13px] md:tracking-normal">Edit CG</h2>
                <Field label="Name">
                  <input
                    value={cgName}
                    onChange={(e) => setCgName(e.target.value)}
                    className={`${inputClass} font-normal md:min-h-11 md:text-[15px]`}
                  />
                </Field>
                <div className="flex flex-col gap-2">
                  <p id="cg-leaders-label" className="text-sm font-semibold">Leaders</p>
                  <div role="group" aria-labelledby="cg-leaders-label" className="flex flex-wrap gap-2">
                    {users.map((u) => {
                      const on = selectedLeaders.includes(u.id);
                      return (
                        <Chip key={u.id} active={on} onClick={() => toggleLeader(u.id)} className={on ? "" : "md:bg-white"}>
                          {u.name}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2.5 md:flex-wrap">
                  <Button onClick={handleSaveCG} disabled={saving} className="flex-1 shadow-none! max-md:h-12 max-md:rounded-2xl max-md:text-base md:px-5">
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)} className="max-md:h-12 max-md:rounded-2xl max-md:px-[18px] max-md:text-base">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Members: a plain list on phone, a card on laptop */}
          <section className={`${shown("members")} flex-col gap-1.5 md:flex md:gap-2 md:rounded-3xl md:bg-white md:px-[22px] md:pb-2.5 md:pt-5 md:shadow-card`}>
            <div className="flex items-center justify-between gap-2.5">
              <h2 className="text-[17px] font-bold tracking-[-0.015em]">
                Members <span className="font-medium text-muted">{members.length}</span>
              </h2>
              <Button
                variant="soft"
                aria-expanded={showAddMember}
                onClick={() => (showAddMember ? setShowAddMember(false) : openAddMember())}
                className="max-md:gap-1.5 max-md:px-3.5 max-md:text-sm"
              >
                <Icon d={I.plus} sw={2.2} className="size-4 md:size-[17px]" /> Add members
              </Button>
            </div>

            {/* Add member: a bottom sheet on phone, an inline panel on laptop */}
            {showAddMember && (
              <div className="fixed inset-0 z-[55] flex flex-col justify-end md:static md:z-auto md:block">
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setShowAddMember(false)}
                  className="absolute inset-0 h-full w-full cursor-default bg-ink/40 md:hidden"
                />
                <div
                  role="dialog"
                  aria-label="Add member"
                  className="relative flex max-h-[80vh] flex-col gap-3 rounded-t-[28px] bg-white px-5 pt-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] md:max-h-none md:gap-2 md:rounded-[18px] md:bg-tint md:p-3.5"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <h3 className="text-xl font-bold tracking-[-0.02em] md:text-[15px] md:tracking-normal">Add member</h3>
                    <button
                      type="button"
                      aria-label="Close add member"
                      onClick={() => setShowAddMember(false)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-fill text-ink transition-colors hover:bg-line-soft md:bg-white"
                    >
                      <Icon d={I.cross} sw={2.2} className="size-[18px] md:size-[17px]" />
                    </button>
                  </div>
                  <input
                    type="search"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search people…"
                    aria-label="Search people"
                    className={`${inputClass} shrink-0 md:min-h-11 md:text-[15px]`}
                  />
                  <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1 md:max-h-80 md:flex-none md:gap-2">
                    {filteredPeople.length === 0 ? (
                      <p className="py-5 text-center text-sm text-muted">No people to add.</p>
                    ) : (
                      filteredPeople.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleAddMember(p)}
                          disabled={addingMember}
                          className="flex h-12 w-full shrink-0 items-center justify-between gap-2 rounded-[14px] bg-tint px-3.5 text-left font-medium text-ink transition-colors hover:bg-brand-soft disabled:opacity-50 md:h-11 md:bg-white"
                        >
                          <span className="min-w-0 truncate">{p.name}</span>
                          <Icon d={I.plus} size={16} sw={2.2} className="shrink-0 text-brand" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {members.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-4 pb-8 pt-7 text-center">
                <span aria-hidden="true" className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
                  <Icon d={I.people} size={26} sw={1.9} />
                </span>
                <p className="text-[17px] font-bold tracking-[-0.015em]">No members yet.</p>
                <p className="text-sm text-muted">Tap + to add one.</p>
              </div>
            ) : (
              <ul>
                {members.map((p) => {
                  const roles = p.roles || [];
                  return (
                    <li
                      key={p.id}
                      onClick={() => router.push(`/person/${p.id}`)}
                      className="flex min-h-[66px] cursor-pointer items-center gap-3"
                    >
                      <Avatar name={p.name} className="md:text-[15px]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 md:flex-wrap">
                          <Link
                            href={`/person/${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-base font-semibold tracking-[-0.01em] text-ink max-md:truncate md:text-[15px] md:tracking-normal"
                          >
                            {p.name}
                          </Link>
                          {roles.map((r) => (
                            <RoleTag key={r} role={r} className="max-md:hidden md:h-[22px] md:px-[9px] md:text-xs" />
                          ))}
                        </div>
                        <ContactLine contactType={p.contactType} contact={p.contact} className="mt-0.5" />
                      </div>
                      {roles.length > 0 && (
                        <div className="flex max-w-[40%] shrink-0 flex-wrap justify-end gap-1 md:hidden">
                          {roles.map((r) => <RoleTag key={r} role={r} />)}
                        </div>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${p.name} from this CG`}
                        onClick={(e) => { e.stopPropagation(); handleRemoveMember(p); }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-fill text-ink transition-colors hover:bg-line-soft"
                      >
                        <Icon d={I.cross} size={16} sw={2.2} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}
