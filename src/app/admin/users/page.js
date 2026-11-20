"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getAllUsers } from "@/lib/firestore";
import AdminPageShell from "@/components/AdminPageShell";
import Spinner from "@/components/Spinner";
import { Avatar, Button } from "@/components/ui";
import { FiPlus, FiChevronDown, FiChevronUp } from "react-icons/fi";

const USERS_ICON = "M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3 19c.6-3.4 3-5 6-5s5.4 1.6 6 5M16.5 6.7a2.4 2.4 0 0 1 0 4.6M17 14c2.2.2 3.6 1.6 4 4";

const roleColor = {
  Admin: "bg-navy text-white",
  Leader: "bg-role-cgl text-role-cgl-ink",
  Member: "bg-line-soft text-ink-2",
};

// One column layout for the heading row and every user row on laptops.
const COLUMNS = "md:grid md:grid-cols-[40px_minmax(0,1.2fr)_minmax(0,1.6fr)_110px_18px] md:gap-x-3.5";

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

  if (loading) return <Spinner fullScreen />;

  if (profile?.role !== "Admin") return null;

  const addButton = (
    <Button className="max-md:gap-1.5 max-md:shadow-none md:px-[18px]" onClick={() => router.push("/admin/users/new")}>
      <FiPlus size={17} aria-hidden="true" /> Add user
    </Button>
  );

  return (
    <AdminPageShell title="Users" subtitle="Admin" rightAction={addButton}>
      {fetching ? (
        <Spinner />
      ) : users.length === 0 ? (
        <div className="flex max-w-215 flex-col items-center gap-1.5 rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-navy/[0.08] md:-mt-1.5">
          <span aria-hidden="true" className="mb-2 flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
            <BoardIcon d={USERS_ICON} size={26} />
          </span>
          <p className="text-[17px] font-bold tracking-[-0.015em]">No users yet.</p>
          <button
            type="button"
            onClick={() => router.push("/admin/users/new")}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-[14px] bg-brand px-5 font-semibold text-white transition-colors hover:bg-navy"
          >
            <FiPlus size={17} aria-hidden="true" /> Add user
          </button>
        </div>
      ) : (
        <>
          <div className="-mx-1.5 -mt-1 md:mx-0 md:-mt-1.5 md:overflow-x-auto">
            <div className="md:min-w-160">
              <div aria-hidden="true" className={`mb-0.5 hidden h-[30px] items-center px-3.5 text-[13px] font-bold ${COLUMNS}`}>
                <span />
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span />
              </div>
              <ul className="flex flex-col gap-0.5">
                {users.map((u) => {
                  const open = expanded === u.id;
                  return (
                    <li key={u.id} className={`rounded-[18px] md:rounded-2xl ${open ? "bg-brand-soft" : "md:odd:bg-tint"}`}>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : u.id)}
                        className={`flex min-h-15 w-full items-center gap-3 rounded-[18px] px-2.5 text-left transition-colors md:min-h-[62px] md:rounded-2xl md:px-3.5 ${COLUMNS} ${
                          open ? "" : "hover:bg-fill"
                        }`}
                      >
                        <Avatar name={u.name} className="md:h-10 md:w-10 md:rounded-[13px] md:text-sm" />
                        <span className="min-w-0 flex-1 md:contents">
                          <span className="block truncate text-base font-semibold tracking-[-0.01em] md:text-[15px]">{u.name}</span>
                          <span className={`block truncate text-[13px] md:text-[15px] md:text-ink ${open ? "text-ink-2" : "text-muted"}`}>{u.email}</span>
                        </span>
                        <span className="shrink-0">
                          <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[12.5px] font-semibold ${roleColor[u.role] || "bg-line-soft text-ink-2"}`}>
                            {u.role}
                          </span>
                        </span>
                        {open
                          ? <FiChevronUp className="shrink-0 text-muted" size={18} aria-hidden="true" />
                          : <FiChevronDown className="shrink-0 text-muted" size={18} aria-hidden="true" />}
                      </button>
                      {open && (
                        <dl className="flex flex-col gap-1.5 px-3 pb-3 pt-0.5 text-sm md:grid md:grid-cols-3 md:gap-3.5 md:pb-[18px] md:pl-[68px] md:pr-3.5 md:pt-1 md:text-[15px]">
                          <Row label="Name" value={u.name} />
                          <Row label="Email" value={u.email} />
                          <Row label="Role" value={u.role} />
                        </dl>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <p className="mt-[18px] hidden text-[13px] text-muted md:block">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </AdminPageShell>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 md:block">
      <dt className="font-semibold text-ink-2 md:text-[13px]">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-ink [overflow-wrap:anywhere] md:text-left">{value}</dd>
    </div>
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
