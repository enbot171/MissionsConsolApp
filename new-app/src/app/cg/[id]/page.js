"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  getCG, updateCG, deleteCG, getUsersByTeam, getPeopleByCG, markAttendance, getAttendanceByCG,
  getPeopleByAssignee, updatePerson,
} from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import PersonCard from "@/components/PersonCard";
import { FiChevronDown, FiChevronUp, FiTrash2, FiPlus, FiX } from "react-icons/fi";

export default function CGDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { loading: authLoading, profile, user } = useRequireAuth();

  const [cg, setCg] = useState(null);
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fetching, setFetching] = useState(true);

  const [showAttendance, setShowAttendance] = useState(false);
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

  if (authLoading || fetching) return null;
  if (!cg) return <div className="p-8 text-center text-gray-600">CG not found.</div>;

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

  return (
    <>
      <PageShell
        title={cg.name}
        backHref="/groups"
        rightAction={
          <button
            onClick={handleDeleteCG}
            className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center active:opacity-70"
          >
            <FiTrash2 size={16} />
          </button>
        }
      >
        <div className="space-y-5 max-w-lg mx-auto">
          {/* CG Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">CG Info</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Leaders</span>
              <span className="text-gray-900 font-medium text-right">{leaderNames}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Members</span>
              <span className="text-gray-900 font-medium">{members.length}</span>
            </div>
          </div>

          {/* Attendance */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowAttendance((s) => !s)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <p className="font-semibold text-gray-800">Mark Attendance</p>
              {showAttendance ? <FiChevronUp /> : <FiChevronDown />}
            </button>

            {showAttendance && (
              <div className="border-t border-gray-100 p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  />
                </div>

                {members.length === 0 ? (
                  <p className="text-sm text-gray-600">No members in this CG.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">Members (tap to mark absent)</p>
                    {members.map((m) => {
                      const isPresent = present.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => togglePresent(m.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                            isPresent
                              ? "bg-green-50 border-green-400 text-green-700"
                              : "bg-red-50 border-red-300 text-red-600"
                          }`}
                        >
                          <span>{m.name}</span>
                          <span className="font-semibold">{isPresent ? "Present" : "Absent"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={handleSaveAttendance}
                  disabled={savingAttendance}
                  className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60"
                >
                  {savingAttendance ? "Saving..." : "Save Attendance"}
                </button>
              </div>
            )}
          </div>

          {/* Attendance History */}
          {attendance.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Attendance History</p>
              <div className="space-y-2">
                {attendance.slice(0, 5).map((rec) => (
                  <div key={rec.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{rec.dateStr}</span>
                    <span className="text-gray-900 font-medium">
                      {(rec.present || []).length} present, {(rec.absent || []).length} absent
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Members</p>
              <button
                onClick={openAddMember}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold"
              >
                <FiPlus size={13} /> Add Members
              </button>
            </div>
            {members.length === 0 ? (
              <p className="text-center text-gray-600 py-4">No members yet. Tap + to add one.</p>
            ) : (
              members.map((p) => <PersonCard key={p.id} person={p} onRemove={handleRemoveMember} />)
            )}
          </div>

          {/* Edit CG */}
          {editing ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Edit CG</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Name</label>
                <input
                  value={cgName}
                  onChange={(e) => setCgName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 bg-gray-50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Leaders</label>
                <div className="flex flex-wrap gap-2">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleLeader(u.id)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                        selectedLeaders.includes(u.id)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-200"
                      }`}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveCG}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-linear-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="w-full py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Edit CG
              </button>
              {saved && (
                <p className="text-center text-sm font-medium text-emerald-600">Changes saved.</p>
              )}
            </>
          )}
        </div>
      </PageShell>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddMember(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl flex flex-col" style={{ maxHeight: "70vh" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900">Add Member</p>
              <button onClick={() => setShowAddMember(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <FiX size={15} />
              </button>
            </div>
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search people…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 mb-3"
            />
            <div className="overflow-y-auto flex-1 space-y-2">
              {filteredPeople.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-6">No people to add.</p>
              ) : (
                filteredPeople.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddMember(p)}
                    disabled={addingMember}
                    className="w-full text-left px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-50"
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
