"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { addTeam } from "@/lib/firestore";
import AdminPageShell from "@/components/AdminPageShell";

export default function AdminAddTeam() {
  const { loading, profile } = useRequireAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && profile && profile.role !== "Admin") router.push("/");
  }, [loading, profile, router]);

  if (loading) return null;
  if (profile?.role !== "Admin") return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Team name is required.");
    setSaving(true);
    try {
      await addTeam({ name: name.trim() });
      router.push("/admin/teams");
    } catch {
      setError("Failed to create team. Try again.");
    }
    setSaving(false);
  };

  return (
    <AdminPageShell title="Add Team" backHref="/admin/teams">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">New Team</p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Team Name</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. North Zone"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        <button type="submit" disabled={saving}
          className="w-full py-3.5 bg-gray-900 text-white font-semibold rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
          {saving ? "Creating…" : "Create Team"}
        </button>
      </form>
    </AdminPageShell>
  );
}
