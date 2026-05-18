"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/lib/firebase";
import { addUserProfile, getAllTeams } from "@/lib/firestore";
import AdminPageShell from "@/components/AdminPageShell";

import { USER_ROLES } from "@/config/app";

export default function AdminAddUser() {
  const { loading, profile } = useRequireAuth();
  const router = useRouter();
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Member", teamId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && profile && profile.role !== "Admin") router.push("/");
  }, [loading, profile, router]);

  useEffect(() => { getAllTeams().then(setTeams); }, []);

  if (loading) return null;
  if (profile?.role !== "Admin") return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) return setError("All fields are required.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    setSaving(true); setError("");
    let secondaryApp;
    try {
      secondaryApp = initializeApp(firebaseConfig, "user-creation-" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      await addUserProfile(cred.user.uid, {
        name: form.name,
        email: form.email,
        role: form.role,
        teamId: form.teamId || null,
      });
      router.push("/admin/users");
    } catch (err) {
      setError(err.message || "Failed to create user.");
      setSaving(false);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
    }
  };

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:bg-white transition-colors";

  return (
    <AdminPageShell title="Add User" backHref="/admin/users">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">New User</p>

          {[
            { label: "Name", key: "name", type: "text", placeholder: "Full name" },
            { label: "Email", key: "email", type: "email", placeholder: "user@example.com" },
            { label: "Password", key: "password", type: "password", placeholder: "Min. 6 characters" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">{label}</label>
              <input type={type} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} className={inputCls} />
            </div>
          ))}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Role</label>
            <div className="flex gap-2">
              {USER_ROLES.map((r) => (
                <button key={r} type="button" onClick={() => set("role", r)}
                  className={`flex-1 py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                    form.role === r ? "bg-gray-900 text-white border-transparent" : "bg-white text-gray-700 border-gray-200"
                  }`}
                >{r}</button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Team</label>
            <select value={form.teamId} onChange={(e) => set("teamId", e.target.value)} className={inputCls}>
              <option value="">No team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        <button type="submit" disabled={saving}
          className="w-full py-3.5 bg-gray-900 text-white font-semibold rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
          {saving ? "Creating…" : "Create User"}
        </button>
      </form>
    </AdminPageShell>
  );
}
