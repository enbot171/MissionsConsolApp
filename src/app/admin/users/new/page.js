"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/lib/firebase";
import { addUserProfile, getAllTeams } from "@/lib/firestore";
import AdminPageShell from "@/components/AdminPageShell";
import { Button, Chip, Field, inputClass } from "@/components/ui";
import { FiAlertCircle, FiCheck } from "react-icons/fi";

import { USER_ROLES } from "@/config/app";

const REQUIRED_MSG = "All fields are required.";
const PASSWORD_MSG = "Password must be at least 6 characters.";

const fieldClass = `${inputClass} font-normal aria-invalid:ring-danger-ink md:min-h-11 md:text-[15px]`;

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

  // The board marks the fields a message is about; both are read off `error`.
  const missing = (key) => error === REQUIRED_MSG && !(key === "password" ? form.password : form[key].trim());
  const passwordShort = error === PASSWORD_MSG;

  return (
    <AdminPageShell title="Add user" backHref="/admin/users" backLabel="Users">
      <form onSubmit={handleSubmit} className="-mt-0.5 flex max-w-140 flex-col gap-4 md:-mt-1.5">
        <section className="flex flex-col gap-3 md:gap-3.5 md:rounded-3xl md:bg-white md:px-[22px] md:pb-[22px] md:pt-5 md:shadow-card">
          <h2 className="text-[17px] font-bold tracking-[-0.015em]">New user</h2>

          {[
            { label: "Name", key: "name", type: "text", placeholder: "Full name", autoComplete: "off" },
            { label: "Email", key: "email", type: "email", placeholder: "user@example.com", autoComplete: "off" },
            { label: "Password", key: "password", type: "password", placeholder: "Min. 6 characters", autoComplete: "new-password" },
          ].map(({ label, key, type, placeholder, autoComplete }) => {
            const short = key === "password" && passwordShort;
            return (
              <Field key={key} label={label}>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={placeholder}
                  autoComplete={autoComplete}
                  aria-invalid={missing(key) || short || undefined}
                  className={fieldClass}
                />
                {short && <span role="alert" className="text-[13px] font-normal text-danger-ink">{error}</span>}
              </Field>
            );
          })}

          <div className="flex flex-col gap-1.5">
            <span id="role-label" className="text-sm font-semibold text-ink">Role</span>
            <div role="group" aria-labelledby="role-label" className="flex gap-2">
              {USER_ROLES.map((r) => (
                <Chip key={r} active={form.role === r} onClick={() => set("role", r)}
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 max-md:h-12 max-md:px-2 md:px-3"
                >
                  {form.role === r && <FiCheck size={15} strokeWidth={2.6} aria-hidden="true" />}
                  {r}
                </Chip>
              ))}
            </div>
          </div>

          <Field label="Team">
            <select value={form.teamId} onChange={(e) => set("teamId", e.target.value)} className={`${fieldClass} pl-3 pr-10`}>
              <option value="">No team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </section>

        {error && !passwordShort && <ErrorAlert>{error}</ErrorAlert>}

        <Button type="submit" size="lg" disabled={saving} aria-busy={saving || undefined} className="w-full disabled:shadow-none md:h-12 md:w-auto md:self-start md:rounded-[14px] md:px-6 md:text-[15px]">
          {saving ? "Creating…" : "Create user"}
        </Button>
      </form>
    </AdminPageShell>
  );
}

// The board's error panel: an icon beside the message.
function ErrorAlert({ children }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-[14px] bg-danger-soft px-3.5 py-3 text-sm font-medium leading-[1.45] text-danger-ink">
      <FiAlertCircle size={17} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
