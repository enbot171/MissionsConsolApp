"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AdminPageShell from "@/components/AdminPageShell";
import Spinner from "@/components/Spinner";
import { FiChevronRight } from "react-icons/fi";

const USERS_ICON = "M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3 19c.6-3.4 3-5 6-5s5.4 1.6 6 5M16.5 6.7a2.4 2.4 0 0 1 0 4.6M17 14c2.2.2 3.6 1.6 4 4";
const TEAMS_ICON = "M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6.5 19c.5-3.2 2.7-4.8 5.5-4.8s5 1.6 5.5 4.8M5.6 12.2a2.2 2.2 0 0 1 0-4.4M18.4 7.8a2.2 2.2 0 0 1 0 4.4M2.5 17.5c.2-1.5 1-2.5 2.3-2.9M21.5 17.5c-.2-1.5-1-2.5-2.3-2.9";

export default function AdminDashboard() {
  const { profile, loading } = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile && profile.role !== "Admin") router.push("/");
  }, [loading, profile, router]);

  if (loading) return <Spinner fullScreen />;

  if (profile?.role !== "Admin") return null;

  return (
    <AdminPageShell title="Dashboard" subtitle="Admin">
      <p className="-mt-3 mb-5 text-muted md:-mt-[22px] md:mb-[22px]">Welcome, {profile?.name}</p>

      <div className="grid max-w-190 grid-cols-2 gap-3 md:gap-4">
        <SectionLink
          label="Users"
          hint="See every account and add new users"
          icon={<BoardIcon d={USERS_ICON} size={24} />}
          tint="bg-role-contact text-role-contact-ink"
          onClick={() => router.push("/admin/users")}
        />
        <SectionLink
          label="Teams"
          hint="See each team's members and add teams"
          icon={<BoardIcon d={TEAMS_ICON} size={24} />}
          tint="bg-role-cgl text-role-cgl-ink"
          onClick={() => router.push("/admin/teams")}
        />
      </div>
    </AdminPageShell>
  );
}

// Stacked and centred on phones, a row with a hint and an arrow on laptops.
function SectionLink({ label, hint, icon, tint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2.5 rounded-3xl bg-white px-3 py-5.5 text-ink shadow-card transition-colors hover:bg-tint md:flex-row md:gap-4 md:p-5.5 md:text-left"
    >
      <span aria-hidden="true" className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl ${tint}`}>
        {icon}
      </span>
      <span className="min-w-0 md:flex-1">
        <span className="block text-base font-semibold tracking-[-0.01em] md:text-lg md:font-bold md:tracking-[-0.015em]">{label}</span>
        <span className="hidden text-sm text-muted md:block">{hint}</span>
      </span>
      <FiChevronRight size={18} aria-hidden="true" className="hidden shrink-0 text-muted md:block" />
    </button>
  );
}

// The board's own line icon, drawn from its path.
function BoardIcon({ d, size }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
