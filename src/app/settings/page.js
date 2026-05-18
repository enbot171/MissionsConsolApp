"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getTeam } from "@/lib/firestore";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import BottomNav from "@/components/BottomNav";
import { FiLogOut, FiShield } from "react-icons/fi";

export default function Settings() {
  const { profile, loading } = useRequireAuth();
  const router = useRouter();
  const [teamName, setTeamName] = useState(null);

  useEffect(() => {
    if (profile?.teamId) {
      getTeam(profile.teamId).then((t) => setTeamName(t?.name || null));
    }
  }, [profile?.teamId]);

  if (loading) return null;

  const roleColor = {
    Admin: "bg-gray-800 text-white",
    Leader: "bg-violet-100 text-violet-700",
    Member: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="bg-linear-to-br from-blue-600 to-indigo-700 px-5 pt-12 pb-8">
        <div className="max-w-lg mx-auto">
          <p className="text-blue-200 text-sm font-medium">Settings</p>
          <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">{profile?.name || "—"}</h1>
        </div>
      </div>

      <main className="flex-1 pb-24 -mt-4 px-4">
        <div className="max-w-lg mx-auto space-y-3">

          {/* User details */}
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

          {/* Role-based actions */}
          {profile?.role === "Admin" && (
            <button
              onClick={() => router.push("/admin")}
              className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center">
                <FiShield className="text-white" size={16} />
              </div>
              <span className="flex-1 text-left font-semibold text-gray-800">Admin Dashboard</span>
            </button>
          )}

          {/* Sign out */}
          <button
            onClick={() => signOut(auth).then(() => router.push("/login"))}
            className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-red-50 active:bg-red-100 transition-colors"
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
