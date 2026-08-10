"use client";

import { Fragment, useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  getUsersByTeam, getTeamPeopleAndNoContact, getMeetupsByTeam,
  getTestimoniesByTeam, getCGsByTeam, getTeam,
} from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import Spinner from "@/components/Spinner";
import { buildWeeklyReport, reportToCsv, weekStart, weekEnd, DAY_LABELS } from "@/lib/report";
import { toDateInput } from "@/lib/dates";
import { FiDownload, FiChevronLeft, FiChevronRight } from "react-icons/fi";

function shiftWeek(start, weeks) {
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + weeks * 7);
}

function rangeLabel(start) {
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const opts = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString([], opts)} – ${end.toLocaleDateString([], opts)}`;
}

export default function Report() {
  const { user, profile, loading } = useRequireAuth();
  const [start, setStart] = useState(() => weekStart());
  const [data, setData] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user || !profile?.teamId) { if (user) setFetching(false); return; }
    setFetching(true);
    const until = weekEnd(start);
    // People aren't queryable by a date range and team at once without another
    // index, and a team's roster is small — filter the week client-side.
    Promise.all([
      getUsersByTeam(profile.teamId),
      getTeamPeopleAndNoContact(profile.teamId),
      getMeetupsByTeam(profile.teamId, { since: start, until }),
      getTestimoniesByTeam(profile.teamId, { since: start, until }),
      getCGsByTeam(profile.teamId),
      getTeam(profile.teamId),
    ]).then(([members, roster, meetups, testimonies, cgs, team]) => {
      setTeamName(team?.name || "");
      setData(buildWeeklyReport({
        members: members.map((m) => ({ id: m.id, name: m.name })),
        people: roster.people,
        noContact: roster.noContact,
        meetups,
        testimonies,
        cgs,
        start,
      }));
    }).finally(() => setFetching(false));
  }, [user, profile?.teamId, start]);

  const download = () => {
    const csv = reportToCsv(data, {
      teamName,
      leaderName: data.members.find((m) => m.id === user.uid)?.name || profile?.name || "",
      weekNo: "",
    });
    // Excel needs the BOM to read UTF-8; without it accented names come out mangled.
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly-report-${toDateInput(start)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return null;

  return (
    <PageShell
      title="Weekly Report"
      rightAction={
        data && (
          <button
            onClick={download}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <FiDownload size={14} /> CSV
          </button>
        )
      }
    >
      {/* Week picker */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-2 py-2 mb-4">
        <NavBtn onClick={() => setStart((s) => shiftWeek(s, -1))}><FiChevronLeft size={18} /></NavBtn>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-900">{rangeLabel(start)}</p>
          <button
            onClick={() => setStart(weekStart())}
            className="text-[11px] font-semibold text-blue-600 hover:underline"
          >
            This week
          </button>
        </div>
        <NavBtn
          onClick={() => setStart((s) => shiftWeek(s, 1))}
          disabled={shiftWeek(start, 1) > new Date()}
        >
          <FiChevronRight size={18} />
        </NavBtn>
      </div>

      {fetching ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !profile?.teamId ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="font-semibold text-gray-800">You&apos;re not on a team yet</p>
          <p className="text-sm text-gray-400 mt-1">The report covers a whole team&apos;s week.</p>
        </div>
      ) : data && (
        <div className="space-y-5">
          <Section title="A. Evangelism" rows={data.evangelism} />
          <Section title="B. Connection Time" rows={data.connection} />
          <FlatSection title="C. Signs &amp; Wonders" rows={data.signs} />

          <div>
            <SectionHeading>D. Progress of Work</SectionHeading>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(data.progress).map(([label, value]) => (
                    <tr key={label} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-2 text-gray-700">{label}</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900 tabular-nums">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Progress is a snapshot of the team today, not a count for the selected week.
              Evangelism rows are dated by when each person was met.
            </p>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function NavBtn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
    >
      {children}
    </button>
  );
}

function SectionHeading({ children }) {
  return <p className="text-sm font-bold text-gray-800 mb-2">{children}</p>;
}

function HeadRow() {
  return (
    <tr className="bg-gray-50 text-gray-500">
      <th className="px-3 py-1.5 text-left font-semibold w-40" />
      {DAY_LABELS.map((d) => (
        <th key={d} className="px-1.5 py-1.5 text-center font-semibold text-[11px]">{d}</th>
      ))}
      <th className="px-2 py-1.5 text-center font-semibold text-[11px]">Total</th>
    </tr>
  );
}

// Rows with a per-member breakdown (sections A and B).
function Section({ title, rows }) {
  return (
    <div>
      <SectionHeading>{title}</SectionHeading>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-xs min-w-130">
          <thead><HeadRow /></thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.key}>
                <tr className="border-t border-gray-100">
                  <td colSpan={9} className="px-3 pt-2.5 pb-1 font-bold text-gray-800">{row.label}</td>
                </tr>
                {row.members.map((m) => (
                  <tr key={m.uid} className="text-gray-600">
                    <td className="px-3 py-1 text-right truncate">{m.name}</td>
                    {m.days.map((v, i) => (
                      <td key={i} className={`px-1.5 py-1 text-center tabular-nums ${v ? "" : "text-gray-300"}`}>{v}</td>
                    ))}
                    <td className="px-2 py-1 text-center font-semibold tabular-nums text-gray-800">{m.total}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold text-gray-800">
                  <td className="px-3 py-1 text-right">Total:</td>
                  {row.totals.map((v, i) => (
                    <td key={i} className="px-1.5 py-1 text-center tabular-nums">{v}</td>
                  ))}
                  <td className="px-2 py-1 text-center tabular-nums">{row.total}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// One line per row, no member split (section C).
function FlatSection({ title, rows }) {
  return (
    <div>
      <SectionHeading>{title}</SectionHeading>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-xs min-w-130">
          <thead><HeadRow /></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-gray-100 text-gray-600">
                <td className="px-3 py-1.5 font-semibold text-gray-800">{row.label}</td>
                {row.days.map((v, i) => (
                  <td key={i} className={`px-1.5 py-1.5 text-center tabular-nums ${v ? "" : "text-gray-300"}`}>{v}</td>
                ))}
                <td className="px-2 py-1.5 text-center font-bold tabular-nums text-gray-800">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
