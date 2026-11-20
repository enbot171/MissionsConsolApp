"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { addTeam } from "@/lib/firestore";
import AdminPageShell from "@/components/AdminPageShell";
import { Button, Field, inputClass } from "@/components/ui";
import { FiAlertCircle } from "react-icons/fi";

const REQUIRED_MSG = "Team name is required.";

const fieldClass = `${inputClass} font-normal aria-invalid:ring-danger-ink md:min-h-11 md:text-[15px]`;

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

  // The board puts this one message under the field instead of in a panel.
  const nameMissing = error === REQUIRED_MSG;

  return (
    <AdminPageShell title="Add team" backHref="/admin/teams" backLabel="Teams">
      <form onSubmit={handleSubmit} className="mt-0.5 flex max-w-140 flex-col gap-4 md:-mt-1.5">
        <section className="flex flex-col gap-3.5 rounded-3xl bg-white p-[18px] shadow-card md:px-[22px] md:pb-[22px] md:pt-5">
          <h2 className="text-[17px] font-bold tracking-[-0.015em]">New team</h2>
          <Field label="Team name">
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. North Zone"
              aria-invalid={nameMissing || undefined}
              className={fieldClass}
            />
            {nameMissing && <span role="alert" className="text-[13px] font-normal text-danger-ink">{error}</span>}
          </Field>
        </section>

        {error && !nameMissing && <ErrorAlert>{error}</ErrorAlert>}

        <Button type="submit" size="lg" disabled={saving} aria-busy={saving || undefined} className="w-full disabled:shadow-none md:h-12 md:w-auto md:self-start md:rounded-[14px] md:px-6 md:text-[15px]">
          {saving ? "Creating…" : "Create team"}
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
