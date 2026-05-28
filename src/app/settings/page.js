"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getTeam, updateUserProfile } from "@/lib/firestore";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";
import { useSidebar } from "@/context/SidebarContext";
import { FiLogOut, FiShield } from "react-icons/fi";

const DEFAULT_FOLLOW_UP_DAYS = 3;

export default function Settings() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();
  const { collapsed } = useSidebar();
  const ml = collapsed ? "md:ml-16" : "md:ml-60";
  const [teamName, setTeamName] = useState(null);
  const [followUpDays, setFollowUpDays] = useState(null);
  const [savingDays, setSavingDays] = useState(false);
  const [savedDays, setSavedDays] = useState(false);

  useEffect(() => {
    if (profile?.teamId) {
      getTeam(profile.teamId).then((t) => setTeamName(t?.name || null));
    }
    if (profile) {
      setFollowUpDays(profile.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS);
    }
  }, [profile?.teamId, profile]);

  const handleSaveFollowUpDays = async () => {
    const days = Math.min(90, Math.max(1, parseInt(followUpDays) || DEFAULT_FOLLOW_UP_DAYS));
    setSavingDays(true);
    await updateUserProfile(user.uid, { followUpDays: days });
    setSavingDays(false);
    setSavedDays(true);
    setTimeout(() => setSavedDays(false), 2000);
  };

  if (loading) return null;

  const roleColor = {
    Admin: "bg-gray-800 text-white",
    Leader: "bg-violet-100 text-violet-700",
    Member: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SideNav />

      <div className={`flex-1 flex flex-col transition-all duration-200 ${ml}`}>
        <div className="bg-linear-to-br from-blue-600 to-indigo-700 px-5 pt-12 pb-8">
          <div className="max-w-lg mx-auto md:max-w-3xl">
            <p className="text-blue-200 text-sm font-medium">Settings</p>
            <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">{profile?.name || "—"}</h1>
          </div>
        </div>

        <main className="flex-1 pb-24 md:pb-10 -mt-4 px-4">
          <div className="max-w-lg mx-auto md:max-w-3xl space-y-3">

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">My Account</p>
              <div className="space-y-3">
                <Row label="Name" value={profile?.name || "—"} />
                <Row label="Email" value={profile?.email || "—"} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Role</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${roleColor[profile?.role] || "bg-gray-100 text-gray-700"}`}>
                    {profile?.role || "—"}
                  </span>
                </div>
                <Row label="Team" value={teamName || (profile?.teamId ? "Loading…" : "Unassigned")} />
              </div>
            </div>

            {/* Follow-up Reminders */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Follow-up Reminders</p>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Remind me after (days)</label>
                <p className="text-xs text-gray-400">Contacts you haven't followed up with in this many days will appear on your to-do list.</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={followUpDays ?? DEFAULT_FOLLOW_UP_DAYS}
                    onChange={(e) => setFollowUpDays(e.target.value)}
                    className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 bg-gray-50 text-center"
                  />
                  <span className="text-sm text-gray-500">days</span>
                  <button
                    onClick={handleSaveFollowUpDays}
                    disabled={savingDays}
                    className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    {savingDays ? "Saving…" : savedDays ? "Saved!" : "Save"}
                  </button>
                </div>
              </div>
            </div>

            {profile?.role === "Admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center">
                  <FiShield className="text-white" size={16} />
                </div>
                <span className="flex-1 text-left font-semibold text-gray-800">Admin Dashboard</span>
              </button>
            )}

            <button
              onClick={() => signOut(auth).then(() => router.push("/login"))}
              className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-red-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <FiLogOut className="text-red-500" size={16} />
              </div>
              <span className="flex-1 text-left font-semibold text-red-500">Sign Out</span>
            </button>

          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
