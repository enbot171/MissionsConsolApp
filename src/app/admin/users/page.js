"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getAllUsers } from "@/lib/firestore";
import AdminBottomNav from "@/components/AdminBottomNav";
import Spinner from "@/components/Spinner";
import { FiPlus, FiChevronDown, FiChevronUp } from "react-icons/fi";

const roleColor = {
  Admin: "bg-gray-800 text-white",
  Leader: "bg-violet-100 text-violet-700",
  Member: "bg-gray-100 text-gray-700",
};

export default function AdminUsers() {
  const { profile, loading } = useRequireAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!loading && profile && profile.role !== "Admin") router.push("/");
  }, [loading, profile, router]);

  useEffect(() => {
    if (loading || profile?.role !== "Admin") return;
    getAllUsers().then(setUsers).finally(() => setFetching(false));
  }, [loading, profile]);

  if (loading || fetching) return <Spinner fullScreen />;

  if (profile?.role !== "Admin") return null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="bg-linear-to-br from-gray-900 to-gray-700 px-5 pt-12 pb-8">
        <div className="max-w-lg mx-auto flex items-end justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium">Admin</p>
            <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">Users</h1>
          </div>
          <button
            onClick={() => router.push("/admin/users/new")}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors"
          >
            <FiPlus size={15} /> Add User
          </button>
        </div>
      </div>

      <main className="flex-1 pb-24 -mt-4">
        <div className="px-4 max-w-lg mx-auto space-y-2">
          {users.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-12">No users yet.</p>
          ) : (
            users.map((u) => {
              const open = expanded === u.id;
              return (
                <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpanded(open ? null : u.id)}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="font-bold text-gray-700 text-sm">{u.name?.charAt(0)}</span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-600 truncate">{u.email}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg shrink-0 ${roleColor[u.role] || "bg-gray-100 text-gray-700"}`}>
                      {u.role}
                    </span>
                    {open
                      ? <FiChevronUp className="text-gray-400 shrink-0" size={16} />
                      : <FiChevronDown className="text-gray-400 shrink-0" size={16} />}
                  </button>
                  {open && (
                    <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                      <Row label="Name" value={u.name} />
                      <Row label="Email" value={u.email} />
                      <Row label="Role" value={u.role} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      <AdminBottomNav />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-xs text-gray-900 font-medium">{value}</span>
    </div>
  );
}
