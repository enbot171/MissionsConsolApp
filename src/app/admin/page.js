"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AdminBottomNav from "@/components/AdminBottomNav";
import Spinner from "@/components/Spinner";
import { FiUsers } from "react-icons/fi";
import { HiOutlineUserGroup } from "react-icons/hi";

export default function AdminDashboard() {
  const { profile, loading } = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile && profile.role !== "Admin") router.push("/");
  }, [loading, profile, router]);

  if (loading) return <Spinner fullScreen />;

  if (profile?.role !== "Admin") return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="bg-linear-to-br from-gray-900 to-gray-700 px-5 pt-12 pb-8">
        <div className="max-w-lg mx-auto">
          <p className="text-gray-400 text-sm font-medium">Admin</p>
          <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Welcome, {profile?.name}</p>
        </div>
      </div>

      <main className="flex-1 pb-24 -mt-4">
        <div className="px-4 max-w-lg mx-auto space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push("/admin/users")}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-2 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <FiUsers className="text-blue-600" size={22} />
              </div>
              <span className="text-sm font-semibold text-gray-900">Users</span>
            </button>
            <button
              onClick={() => router.push("/admin/teams")}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-2 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
                <HiOutlineUserGroup className="text-violet-600" size={22} />
              </div>
              <span className="text-sm font-semibold text-gray-900">Teams</span>
            </button>
          </div>
        </div>
      </main>

      <AdminBottomNav />
    </div>
  );
}
