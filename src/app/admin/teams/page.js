"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getAllUsers, getAllTeams } from "@/lib/firestore";
import AdminPageShell from "@/components/AdminPageShell";
import Spinner from "@/components/Spinner";
import { Avatar, Button } from "@/components/ui";
import { FiPlus, FiChevronDown, FiChevronUp } from "react-icons/fi";

const TEAMS_ICON = "M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6.5 19c.5-3.2 2.7-4.8 5.5-4.8s5 1.6 5.5 4.8M5.6 12.2a2.2 2.2 0 0 1 0-4.4M18.4 7.8a2.2 2.2 0 0 1 0 4.4M2.5 17.5c.2-1.5 1-2.5 2.3-2.9M21.5 17.5c-.2-1.5-1-2.5-2.3-2.9";

const roleColor = {
  Admin: "bg-navy text-white",
  Leader: "bg-role-cgl text-role-cgl-ink",
  Member: "bg-line-soft text-ink-2",
};

export default function AdminTeams() {
  const { profile, loading } = useRequireAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!loading && profile && profile.role !== "Admin") router.push("/");
  }, [loading, profile, router]);

  useEffect(() => {
    if (loading || profile?.role !== "Admin") return;
    Promise.all([getAllUsers(), getAllTeams()])
      .then(([u, t]) => { setUsers(u); setTeams(t); })
      .finally(() => setFetching(false));
  }, [loading, profile]);

  if (loading) return <Spinner fullScreen />;

  if (profile?.role !== "Admin") return null;

  const teamMembers = (teamId) => users.filter((u) => u.teamId === teamId);

  const addButton = (
    <Button className="max-md:gap-1.5 max-md:shadow-none md:px-[18px]" onClick={() => router.push("/admin/teams/new")}>
      <FiPlus size={17} aria-hidden="true" /> Add team
    </Button>
  );

  return (
    <AdminPageShell title="Teams" subtitle="Admin" rightAction={addButton}>
      {fetching ? (
        <Spinner />
      ) : teams.length === 0 ? (
        <div className="flex max-w-215 flex-col items-center gap-1.5 rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-navy/[0.08] md:-mt-1.5">
          <span aria-hidden="true" className="mb-2 flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
            <BoardIcon d={TEAMS_ICON} size={26} />
          </span>
          <p className="text-[17px] font-bold tracking-[-0.015em]">No teams yet.</p>
          <button
            type="button"
            onClick={() => router.push("/admin/teams/new")}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-[14px] bg-brand px-5 font-semibold text-white transition-colors hover:bg-navy"
          >
            <FiPlus size={17} aria-hidden="true" /> Add team
          </button>
        </div>
      ) : (
        <ul className="flex max-w-215 flex-col gap-2.5 md:-mt-1.5 md:gap-3">
          {teams.map((team) => {
            const members = teamMembers(team.id);
            const open = expanded === team.id;
            return (
              <li key={team.id} className="overflow-hidden rounded-[20px] bg-tint md:rounded-3xl md:bg-white md:shadow-card">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : team.id)}
                  className="flex min-h-17 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-fill md:min-h-19 md:gap-3.5 md:px-5.5 md:py-3.5 md:hover:bg-tint"
                >
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-role-cgl text-role-cgl-ink">
                    <BoardIcon d={TEAMS_ICON} size={21} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold tracking-[-0.01em] md:text-[17px] md:font-bold md:tracking-[-0.015em]">{team.name}</span>
                    <span className="block text-[13px] text-muted">{members.length} member{members.length !== 1 ? "s" : ""}</span>
                  </span>
                  {open
                    ? <FiChevronUp className="shrink-0 text-muted" size={18} aria-hidden="true" />
                    : <FiChevronDown className="shrink-0 text-muted" size={18} aria-hidden="true" />}
                </button>
                {open && (
                  <div className="border-t border-line px-3.5 pb-2 md:mx-5.5 md:border-line-soft md:px-0 md:pb-3">
                    {members.length === 0 ? (
                      <p className="pb-1.5 pt-3 text-sm text-muted md:pb-1 md:pt-3.5">No members in this team.</p>
                    ) : (
                      <ul className="pt-0.5 md:pt-1">
                        {members.map((u) => (
                          <li
                            key={u.id}
                            className="flex min-h-14.5 items-center gap-3 md:grid md:grid-cols-[40px_minmax(0,1fr)_minmax(0,1.4fr)_auto] md:gap-x-3.5"
                          >
                            <Avatar name={u.name} size="sm" className="max-md:h-[38px] max-md:w-[38px] md:h-10 md:w-10 md:rounded-[13px]" />
                            <span className="min-w-0 flex-1 md:contents">
                              <span className="block truncate font-semibold tracking-[-0.01em]">{u.name}</span>
                              <span className="block truncate text-[13px] text-muted md:text-[15px]">{u.email}</span>
                            </span>
                            <span className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[12.5px] font-semibold ${roleColor[u.role] || "bg-line-soft text-ink-2"}`}>
                              {u.role}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AdminPageShell>
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
