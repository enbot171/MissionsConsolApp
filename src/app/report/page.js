"use client";

import { useEffect, useMemo, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  getUsersByTeam, getTeamPeopleAndNoContact, getMeetupsByTeam,
  getTestimoniesByTeam, getCGsByTeam, getTeam,
  getReportOverrides, saveReportOverrides,
} from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import Spinner from "@/components/Spinner";
import { Banner, Button } from "@/components/ui";
import {
  buildWeeklyReport, reportToCsv, weekStart, weekEnd, DAY_LABELS,
  applyOverrides, mergeOverrides, overrideKey,
} from "@/lib/report";
import { toDateInput } from "@/lib/dates";
import { FiDownload, FiChevronLeft, FiChevronRight, FiEdit2, FiUsers } from "react-icons/fi";

function shiftWeek(start, weeks) {
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + weeks * 7);
}

function rangeLabel(start) {
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const opts = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString([], opts)} – ${end.toLocaleDateString([], opts)}`;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Column tracks for the three grids, phone first then laptop.
const READ_COLS = "grid grid-cols-[78px_repeat(7,minmax(0,1fr))_36px] md:grid-cols-[minmax(88px,1.5fr)_repeat(7,minmax(30px,1fr))_minmax(40px,1.1fr)]";
const EDIT_COLS = "grid grid-cols-[72px_repeat(7,minmax(0,1fr))_36px] md:grid-cols-[minmax(96px,1.5fr)_repeat(7,minmax(34px,1fr))_minmax(44px,1.1fr)]";
const SIGN_COLS = "grid grid-cols-[minmax(200px,2.4fr)_repeat(7,minmax(36px,1fr))_minmax(48px,1.1fr)]";

const countClass = (value) => (value ? "font-semibold text-ink" : "text-muted");

export default function Report() {
  const { user, profile, loading } = useRequireAuth();
  const [start, setStart] = useState(() => weekStart());
  // `counted` is what the app tallies from records; `cells` are the numbers the
  // team typed over it. They stay apart so an edit can always be undone.
  const [counted, setCounted] = useState(null);
  const [cells, setCells] = useState({});
  const [overridesFailed, setOverridesFailed] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [fetching, setFetching] = useState(true);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const teamId = profile?.teamId;

  useEffect(() => {
    if (!user || !teamId) { if (user) setFetching(false); return; }
    // A slow answer for a week the user has already left must not land on the
    // week they are looking at now.
    let current = true;
    setFetching(true);
    const until = weekEnd(start);
    // People aren't queryable by a date range and team at once without another
    // index, and a team's roster is small — filter the week client-side.
    const report = Promise.all([
      getUsersByTeam(teamId),
      getTeamPeopleAndNoContact(teamId),
      getMeetupsByTeam(teamId, { since: start, until }),
      getTestimoniesByTeam(teamId, { since: start, until }),
      getCGsByTeam(teamId),
      getTeam(teamId),
    ]);
    // Loaded on its own: if this read is refused, the report itself still shows.
    const overrides = getReportOverrides(teamId, toDateInput(start))
      .then((found) => ({ found, failed: false }))
      .catch(() => ({ found: {}, failed: true }));

    Promise.all([report, overrides]).then(([[members, roster, meetups, testimonies, cgs, team], { found, failed }]) => {
      if (!current) return;
      setTeamName(team?.name || "");
      setCells(found);
      setOverridesFailed(failed);
      setCounted(buildWeeklyReport({
        members: members.map((m) => ({ id: m.id, name: m.name })),
        people: roster.people,
        noContact: roster.noContact,
        meetups,
        testimonies,
        cgs,
        start,
      }));
    }).finally(() => { if (current) setFetching(false); });

    return () => { current = false; };
  }, [user, teamId, start]);

  // What is on screen: saved overrides, plus anything typed but not yet saved.
  const saved = useMemo(() => (counted ? applyOverrides(counted, cells) : null), [counted, cells]);
  const shown = useMemo(
    () => (counted ? applyOverrides(counted, { ...cells, ...draft }) : null),
    [counted, cells, draft]
  );
  const changed = Object.keys(draft).length;

  const setCell = (key, value, savedValue) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (value === savedValue) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  // Closing or reloading the tab with unsaved numbers asks first.
  useEffect(() => {
    if (changed === 0) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);

  const startEditing = () => { setDraft({}); setSaveError(""); setEditing(true); };

  const cancel = () => {
    if (changed > 0 && !confirm("Discard your changes?")) return;
    setDraft({});
    setSaveError("");
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      // Merged against the cells as they are in the database right now, so a
      // teammate's save made while this page was open is kept.
      const next = await saveReportOverrides(
        teamId, toDateInput(start), (latest) => mergeOverrides(counted, latest, draft), user.uid,
      );
      setCells(next);
      setDraft({});
      setEditing(false);
    } catch {
      setSaveError("Could not save. Your numbers are still here. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const download = () => {
    const csv = reportToCsv(saved, {
      teamName,
      leaderName: saved.members.find((m) => m.id === user.uid)?.name || profile?.name || "",
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

  const ready = !fetching && teamId && shown;
  const saveLabel = saving ? "Saving…" : `Save (${changed})`;

  // The week stepper sits in the heading on laptops and in its own row on
  // phones, so it is drawn twice and each copy is hidden at the other size.
  const weekGroup = (className) => (
    <div role="group" aria-label="Week" className={className}>
      <WeekButton label="Previous week" onClick={() => setStart((s) => shiftWeek(s, -1))}>
        <FiChevronLeft size={18} />
      </WeekButton>
      <span aria-live="polite" className="whitespace-nowrap text-center font-bold tabular-nums md:min-w-[132px]">{rangeLabel(start)}</span>
      <WeekButton
        label="Next week"
        onClick={() => setStart((s) => shiftWeek(s, 1))}
        disabled={shiftWeek(start, 1) > new Date()}
      >
        <FiChevronRight size={18} />
      </WeekButton>
    </div>
  );

  return (
    <PageShell
      title={editing ? (
        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 md:gap-x-3 md:gap-y-1">
          Edit report
          <span className="text-sm font-normal leading-normal tracking-normal text-muted md:text-[15px]">
            {teamName && <span className="hidden md:inline">{teamName} · </span>}
            {rangeLabel(start)}
          </span>
        </span>
      ) : "Weekly report"}
      subtitle={editing ? undefined : (
        <span className="hidden md:inline">{teamName ? `${teamName} · Monday to Sunday` : "Monday to Sunday"}</span>
      )}
      bottomBar={editing ? (
        <>
          <Button variant="outline" size="lg" onClick={cancel} disabled={saving}>Cancel</Button>
          <Button size="lg" className="flex-1" onClick={save} disabled={saving || changed === 0}>{saveLabel}</Button>
        </>
      ) : undefined}
      rightAction={editing ? (
        <span className="hidden items-center gap-2.5 md:flex">
          <Button variant="outline" onClick={cancel} disabled={saving}>Cancel</Button>
          <Button className="md:px-5" onClick={save} disabled={saving || changed === 0}>{saveLabel}</Button>
        </span>
      ) : (
        <>
          {weekGroup("hidden items-center gap-0.5 rounded-[14px] bg-fill px-0.5 md:flex")}
          <Button variant="outline" className="max-md:hidden" onClick={() => setStart(weekStart())}>This week</Button>
          {ready && (
            <>
              <Button variant="outline" className="max-md:w-11 max-md:px-0" aria-label="Edit numbers" onClick={startEditing} disabled={overridesFailed}>
                <FiEdit2 size={17} aria-hidden="true" /> <span className="hidden md:inline">Edit numbers</span>
              </Button>
              <Button className="max-md:gap-1.5 max-md:px-3.5 max-md:shadow-none md:px-[18px]" aria-label="Download CSV" onClick={download}>
                <FiDownload size={17} aria-hidden="true" /> <span className="md:hidden">CSV</span><span className="hidden md:inline">Download CSV</span>
              </Button>
            </>
          )}
        </>
      )}
    >
      {!editing && (
        <div className="mb-3.5 flex items-center gap-2 md:hidden">
          {weekGroup("flex h-12 min-w-0 flex-1 items-center justify-between rounded-2xl bg-fill px-0.5")}
          <Button variant="outline" className="max-md:h-12 max-md:rounded-2xl max-md:px-3.5 max-md:text-sm" onClick={() => setStart(weekStart())}>This week</Button>
        </div>
      )}

      {overridesFailed && !fetching && (
        <Banner tone="error" className="mb-4">Saved edits could not be loaded, so these are the counted numbers. Editing is off for now.</Banner>
      )}
      {saveError && <Banner tone="error" className="mb-4">{saveError}</Banner>}

      {fetching ? (
        <Spinner />
      ) : !teamId ? (
        <div className="flex flex-col items-center gap-1.5 rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-line-soft">
          <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
            <FiUsers size={26} aria-hidden="true" />
          </span>
          <p className="text-[17px] font-bold tracking-[-0.015em]">You&apos;re not on a team yet</p>
          <p className="max-w-[420px] text-sm text-muted">The report covers a whole team&apos;s week.</p>
        </div>
      ) : shown && (
        <div className="flex flex-col gap-3.5 md:gap-[22px]">
          <Section title="A. Evangelism" rows={shown.evangelism} savedRows={saved.evangelism} editing={editing} onCell={setCell} />
          <Section title="B. Connection time" rows={shown.connection} savedRows={saved.connection} editing={editing} onCell={setCell} />

          <section className="flex flex-col gap-2 md:gap-2.5">
            <SectionHeading>C. Signs &amp; wonders</SectionHeading>

            {/* Laptop: one table in a card. */}
            <div className="hidden rounded-3xl bg-white px-[18px] py-4 shadow-card md:block">
              <div className="overflow-x-auto">
                <div role="table" aria-label="Signs and wonders" className="flex min-w-[560px] flex-col gap-0.5 text-sm">
                  <div role="row" className={`${SIGN_COLS} h-[26px] items-center px-2 text-center text-[12.5px] font-semibold text-muted`}>
                    <span role="columnheader" className="text-left">Type</span>
                    {DAY_LABELS.map((d) => <span key={d} role="columnheader">{d}</span>)}
                    <span role="columnheader">Total</span>
                  </div>
                  {shown.signs.map((row, ri) => (
                    <div key={row.key} role="row" className={`${SIGN_COLS} h-[38px] items-center rounded-[10px] px-2 text-center tabular-nums ${ri % 2 === 0 ? "bg-tint" : "bg-white"}`}>
                      <span role="rowheader" className="text-left font-semibold">{row.label}</span>
                      {row.days.map((v, i) => <span key={i} role="cell" className={countClass(v)}>{v}</span>)}
                      <span role="cell" className="font-bold">{row.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Phone: a panel per type, the week as seven tiles. */}
            {shown.signs.map((row) => (
              <div key={row.key} className="flex flex-col gap-1.5 rounded-[20px] bg-tint px-3.5 py-3 md:hidden">
                <div className="flex items-center justify-between gap-2.5">
                  <h3 className="text-sm font-bold">{row.label}</h3>
                  <span className="font-bold tabular-nums text-brand">{row.total}</span>
                </div>
                <div role="list" aria-label="By day" className="grid grid-cols-7 gap-1 text-center text-[13px] tabular-nums">
                  {row.days.map((v, i) => (
                    <span key={i} role="listitem" className="rounded-[10px] bg-white py-1">
                      <span className="block text-[11.5px] font-semibold text-muted">{DAY_LABELS[i]}</span>
                      <span className={`block ${countClass(v)}`}>{v}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-2 md:gap-2.5">
            <SectionHeading>D. Progress of work</SectionHeading>
            <dl className="grid grid-cols-2 gap-2 md:grid-cols-[repeat(auto-fit,minmax(108px,1fr))] md:gap-2.5">
              {Object.entries(shown.progress).map(([label, value]) => (
                <div key={label} className="flex flex-col-reverse justify-end rounded-2xl bg-brand-soft px-3.5 py-2.5 md:rounded-[18px] md:px-4 md:py-3.5">
                  <dt className="text-[13px] text-ink-2 md:mt-1">{label}</dt>
                  <dd className="text-[22px] font-bold leading-[1.15] tracking-[-0.03em] text-navy tabular-nums md:text-[28px] md:leading-[1.1]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </PageShell>
  );
}

function WeekButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-[14px] text-ink transition-colors hover:bg-line-soft disabled:text-muted disabled:opacity-45 disabled:hover:bg-transparent md:rounded-xl"
    >
      {children}
    </button>
  );
}

function SectionHeading({ children }) {
  return <h2 className="text-[17px] font-bold tracking-[-0.015em] md:text-xl md:tracking-[-0.02em]">{children}</h2>;
}

// Day column headers: one letter on phones, the short name on laptops.
function DayHeads() {
  return DAY_LABELS.map((d, i) => (
    <span key={d} role="columnheader" aria-label={DAY_NAMES[i]}>
      <span aria-hidden="true" className="md:hidden">{d[0]}</span>
      <span aria-hidden="true" className="hidden md:inline">{d}</span>
    </span>
  ));
}

// Sections A and B: one panel per metric, a row per member.
function Section({ title, rows, savedRows, editing, onCell }) {
  return (
    <section className="flex flex-col gap-2 md:gap-2.5">
      <SectionHeading>{title}</SectionHeading>
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:gap-4">
        {rows.map((row, ri) => (
          <div
            key={row.key}
            className="flex min-w-0 flex-col gap-1.5 rounded-[20px] bg-tint px-3.5 py-3 md:flex-[1_1_420px] md:gap-2.5 md:rounded-3xl md:bg-white md:px-[18px] md:py-4 md:shadow-card"
          >
            <h3 className="text-sm font-bold md:text-[15px] md:tracking-[-0.01em]">{row.label}</h3>
            {editing
              ? <EditGrid row={row} savedRow={savedRows[ri]} onCell={onCell} />
              : <ReadGrid row={row} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function ReadGrid({ row }) {
  return (
    <div className="overflow-x-auto">
      <div role="table" aria-label={row.label} className="flex min-w-[300px] flex-col gap-0.5 text-[13px] md:min-w-[400px] md:text-sm">
        <div role="row" className={`${READ_COLS} h-[22px] items-center text-center text-xs font-semibold text-muted md:h-[26px] md:px-2 md:text-[12.5px]`}>
          <span role="columnheader" className="text-left">Member</span>
          <DayHeads />
          <span role="columnheader">Total</span>
        </div>
        {row.members.map((m) => (
          <div key={m.uid} role="row" className={`${READ_COLS} h-[26px] items-center text-center tabular-nums md:h-[30px] md:px-2`}>
            <span role="rowheader" className="min-w-0 truncate text-left text-ink-2">{m.name}</span>
            {m.days.map((v, i) => <span key={i} role="cell" className={countClass(v)}>{v}</span>)}
            <span role="cell" className="font-bold">{m.total}</span>
          </div>
        ))}
        <div role="row" className={`${READ_COLS} -mx-1.5 h-[30px] items-center rounded-[10px] bg-line-soft px-1.5 text-center font-bold tabular-nums md:mx-0 md:h-[34px] md:bg-fill md:px-2`}>
          <span role="rowheader" className="text-left">Total</span>
          {row.totals.map((v, i) => <span key={i} role="cell">{v}</span>)}
          <span role="cell" className="text-brand">{row.total}</span>
        </div>
      </div>
    </div>
  );
}

// The same grid as a sheet: every member/day cell is a plain number box.
function EditGrid({ row, savedRow, onCell }) {
  return (
    <div className="overflow-x-auto rounded-[14px] bg-white ring-1 ring-line">
      <div role="table" aria-label={`${row.label}, editable`} className="min-w-[300px] text-[13px] tabular-nums md:min-w-[400px] md:text-sm">
        <div role="row" className={`${EDIT_COLS} h-[30px] items-center border-b border-line bg-tint text-center text-[12.5px] font-bold text-muted md:h-[34px]`}>
          <span role="columnheader" className="px-2 text-left md:px-2.5">Member</span>
          <DayHeads />
          <span role="columnheader">Total</span>
        </div>
        {row.members.map((m, mi) => (
          <div key={m.uid} role="row" className={`${EDIT_COLS} h-[42px] border-b border-line-soft md:h-11`}>
            <span role="rowheader" className="min-w-0 truncate border-r border-line px-2 leading-[42px] text-ink-2 md:px-2.5 md:leading-[44px]">{m.name}</span>
            {m.days.map((v, day) => {
              const key = overrideKey(row.key, m.uid, day);
              return (
                <span key={day} role="cell" className="flex min-w-0 border-r border-line-soft">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`${m.name}, ${DAY_NAMES[day]}`}
                    value={v}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      // Whole numbers up to 999; an emptied box counts as 0.
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                      onCell(key, Number(digits || 0), savedRow.members[mi].days[day]);
                    }}
                    className={`h-full w-full min-w-0 rounded-none bg-transparent p-0 text-center text-base outline-none focus:shadow-[inset_0_0_0_2px_var(--color-brand)] md:text-[15px] ${countClass(v)}`}
                  />
                </span>
              );
            })}
            <span role="cell" className="flex items-center justify-center bg-tint font-bold">{m.total}</span>
          </div>
        ))}
        <div role="row" className={`${EDIT_COLS} h-9 items-center bg-fill text-center font-bold md:h-10`}>
          <span role="rowheader" className="px-2 text-left md:px-2.5">Total</span>
          {row.totals.map((v, i) => <span key={i} role="cell">{v}</span>)}
          <span role="cell" className="text-brand">{row.total}</span>
        </div>
      </div>
    </div>
  );
}
