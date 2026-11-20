"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { firebaseConfig } from "@/lib/firebase";
import { addUserProfile, getAllTeams } from "@/lib/firestore";
import AdminPageShell from "@/components/AdminPageShell";
import { Button, Chip, Field, inputClass } from "@/components/ui";
import { FiAlertCircle, FiCheck } from "react-icons/fi";

import { USER_ROLES } from "@/config/app";

const REQUIRED_MSG = "All fields are required.";
const PASSWORD_MSG = "Password must be at least 6 characters.";

const fieldClass = `${inputClass} font-normal aria-invalid:ring-danger-ink md:min-h-11 md:text-[15px]`;

// A long random password for someone who will only ever use Google. Nobody is
// told it; Firebase needs some password to create the account.
function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
}

export default function AdminAddUser() {
  const { loading, profile } = useRequireAuth();
  const router = useRouter();
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Member", teamId: "" });
  const [googleOnly, setGoogleOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Set once the user exists: { name, email, googleOnly, verifySent }.
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (!loading && profile && profile.role !== "Admin") router.push("/");
  }, [loading, profile, router]);

  useEffect(() => { getAllTeams().then(setTeams); }, []);

  if (loading) return null;
  if (profile?.role !== "Admin") return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || (!googleOnly && !form.password)) return setError(REQUIRED_MSG);
    if (!googleOnly && form.password.length < 6) return setError(PASSWORD_MSG);
    setSaving(true); setError("");
    let secondaryApp;
    try {
      secondaryApp = initializeApp(firebaseConfig, "user-creation-" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const email = form.email.trim();
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, googleOnly ? randomPassword() : form.password);
      await addUserProfile(cred.user.uid, {
        name: form.name.trim(),
        email,
        role: form.role,
        teamId: form.teamId || null,
      });
      // A verified email lets the person use both Google and their password:
      // without it, Firebase drops the password the first time they use Google.
      // The account already exists, so a failed email is reported, not fatal.
      const verifySent = await sendEmailVerification(cred.user).then(() => true, () => false);
      setCreated({ name: form.name.trim(), email, googleOnly, verifySent });
    } catch (err) {
      setError(
        err?.code === "auth/email-already-in-use"
          ? "A user with this email already exists."
          : err?.code === "auth/invalid-email"
            ? "That email address is not valid."
            : err.message || "Failed to create user."
      );
    } finally {
      setSaving(false);
      if (secondaryApp) await deleteApp(secondaryApp);
    }
  };

  const addAnother = () => {
    setForm({ name: "", email: "", password: "", role: "Member", teamId: "" });
    setGoogleOnly(false);
    setCreated(null);
  };

  if (created) {
    return (
      <AdminPageShell title="Add user" backHref="/admin/users" backLabel="Users">
        <section className="-mt-0.5 flex max-w-140 flex-col gap-3 md:-mt-1.5 md:rounded-3xl md:bg-white md:px-[22px] md:pb-[22px] md:pt-5 md:shadow-card">
          <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.015em]">
            <span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ok-soft text-ok-ink">
              <FiCheck size={16} strokeWidth={2.6} />
            </span>
            {created.name} can now sign in
          </h2>
          <p className="text-ink-2">
            {created.googleOnly
              ? <>Tell them to use <b className="text-ink">Continue with Google</b> with {created.email}.</>
              : <>They can sign in with {created.email} and the password you set, or with <b className="text-ink">Continue with Google</b> if it is a Google account.</>}
          </p>
          {created.verifySent ? (
            <p className="rounded-[14px] bg-tint px-3.5 py-3 text-sm text-ink-2">
              A &ldquo;verify your email&rdquo; message was sent to {created.email}. Ask them to click the link in it
              (check spam too){created.googleOnly ? "." : ", so their password keeps working after they use Google."}
            </p>
          ) : (
            <ErrorAlert>
              The account was created, but the verification email could not be sent. They can still sign in.
              {!created.googleOnly && " If they use Google, their password may stop working."}
            </ErrorAlert>
          )}
          <div className="mt-1 flex flex-wrap gap-2.5">
            <Button onClick={addAnother}>Add another user</Button>
            <Button variant="outline" onClick={() => router.push("/admin/users")}>Back to users</Button>
          </div>
        </section>
      </AdminPageShell>
    );
  }

  // The board marks the fields a message is about; both are read off `error`.
  const missing = (key) => error === REQUIRED_MSG && !(key === "password" ? form.password : form[key].trim());
  const passwordShort = error === PASSWORD_MSG;

  return (
    <AdminPageShell title="Add user" backHref="/admin/users" backLabel="Users">
      <form onSubmit={handleSubmit} className="-mt-0.5 flex max-w-140 flex-col gap-4 md:-mt-1.5">
        <section className="flex flex-col gap-3 md:gap-3.5 md:rounded-3xl md:bg-white md:px-[22px] md:pb-[22px] md:pt-5 md:shadow-card">
          <h2 className="text-[17px] font-bold tracking-[-0.015em]">New user</h2>

          <button
            type="button"
            role="switch"
            aria-checked={googleOnly}
            onClick={() => { setGoogleOnly((v) => !v); setError(""); }}
            className="flex items-center justify-between gap-3 rounded-[14px] bg-tint px-3.5 py-3 text-left transition-colors hover:bg-fill"
          >
            <span className="min-w-0">
              <span className="block font-semibold">Signs in with Google only</span>
              <span className="block text-[13px] text-muted">No password to set. Use their Google email below.</span>
            </span>
            <span aria-hidden="true" className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${googleOnly ? "bg-brand" : "bg-line"}`}>
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] ${googleOnly ? "left-[22px]" : "left-0.5"}`} />
            </span>
          </button>

          {[
            { label: "Name", key: "name", type: "text", placeholder: "Full name", autoComplete: "off" },
            { label: googleOnly ? "Google email" : "Email", key: "email", type: "email", placeholder: googleOnly ? "name@gmail.com" : "user@example.com", autoComplete: "off" },
            ...(googleOnly ? [] : [{ label: "Password", key: "password", type: "password", placeholder: "Min. 6 characters", autoComplete: "new-password" }]),
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
