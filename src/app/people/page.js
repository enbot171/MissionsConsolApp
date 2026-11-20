"use client";

import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { subscribeAllPeopleByAssignee, updatePerson } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import PersonCard from "@/components/PersonCard";
import SearchBar from "@/components/SearchBar";
import { CONTACT_ROLES, CONTACT_TYPES, SOURCES } from "@/config/app";
import { FiArchive, FiX } from "react-icons/fi";
import { ContactHandle, ContactTypeTag } from "@/components/ContactActions";
import { Avatar, Button, Chip, ChipRow, RoleTag } from "@/components/ui";

const ROLE_FILTERS = [...CONTACT_ROLES, "Core Team", "Archived"];

const BOOL_OPTIONS = [
  { value: "", label: "All" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const EXCLUSIVE_ROLES = ["Contact", "Disciple"];
const EMPTY_FILTERS = { contactType: "", source: "", metAt: "", gospelShared: "", prayed: "", saved: "" };
const VIEW_MODE_KEY = "consolapp:peopleViewMode";

// Heading-row buttons: icon only on phones, icon and word on laptops.
const HEAD_BTN = "relative inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-[14px] font-semibold transition-colors md:px-4";
const HEAD_BTN_IDLE = "bg-fill text-ink hover:bg-line-soft md:bg-white md:ring-1 md:ring-line md:hover:bg-tint";
const HEAD_BTN_ON = "bg-brand-soft text-brand md:ring-1 md:ring-brand-light";

const SEGMENT = "h-9 rounded-[10px] px-3.5 text-sm font-semibold transition-colors";

// Filter-panel controls are 44px tall; 16px text on phones stops iOS zooming in.
const FILTER_INPUT = "h-11 w-full min-w-0 rounded-[14px] bg-white pl-3 text-base font-normal text-ink ring-1 ring-inset ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand md:text-[15px]";

const ICON_FILTERS = "M4 6h16M7 12h10M10 18h4";
const ICON_EDIT = "M4 20h4l10-10-4-4L4 16zM13 7l4 4";
const ICON_SELECT_SQUARE = "M9 11.5l2.5 2.5L20 5.5M19 12.5V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h9";
const ICON_SELECT_ROUND = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l3 3 5-6";
const ICON_SEARCH = "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5";
const ICON_PEOPLE = "M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3 19c.6-3.4 3-5 6-5s5.4 1.6 6 5M16.5 6.7a2.4 2.4 0 0 1 0 4.6M17 14c2.2.2 3.6 1.6 4 4";

// 19px on phones, 17px beside a word on laptops.
function Icon({ d, className = "", strokeWidth = 2 }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-[19px] w-[19px] shrink-0 md:h-[17px] md:w-[17px] ${className}`}
    >
      <path d={d} />
    </svg>
  );
}
const SEGMENT_ON = "bg-white text-ink shadow-[0_1px_3px_rgb(20_30_60/0.12)]";
const SEGMENT_OFF = "text-muted hover:text-ink";

const STATUS_MARKS = [
  { key: "gospelShared", letter: "G", label: "Gospel shared" },
  { key: "prayed", letter: "P", label: "Prayed" },
  { key: "saved", letter: "S", label: "Saved" },
];

function MetAtCombo({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef(null);
  const inputId = useId();
  const listId = useId();

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = value.trim().toLowerCase();
  const matches = q
    ? options.filter((o) => o.toLowerCase().includes(q))
    : options;

  const pick = (v) => {
    onChange(v);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(matches[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative col-span-2 flex min-w-0 flex-col gap-1.5 md:flex-[1.3_1_190px]" ref={boxRef}>
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">Met at</label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search location…"
          className={`${FILTER_INPUT} pr-10`}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear location"
            onClick={() => { onChange(""); setOpen(false); }}
            className="absolute bottom-0.5 right-0.5 flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:text-ink"
          >
            <FiX size={15} aria-hidden="true" />
          </button>
        )}
        {open && matches.length > 0 && (
          <div id={listId} role="listbox" aria-label="Locations" className="absolute left-0 right-0 top-full z-20 mt-1.5 flex max-h-60 flex-col gap-0.5 overflow-y-auto rounded-[14px] bg-white p-1.5 text-[15px] shadow-float">
            {matches.map((m, i) => (
              <button
                key={m}
                type="button"
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                onMouseEnter={() => setHighlight(i)}
                className={`min-h-10 shrink-0 rounded-[10px] px-2.5 py-[9px] text-left ${
                  i === highlight ? "bg-brand-soft font-semibold text-brand-ink" : "text-ink hover:bg-tint"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, className = "" }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-ink ${className}`}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FILTER_INPUT} pr-10`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// useSearchParams needs a Suspense boundary above it.
export default function People() {
  return (
    <Suspense>
      <PeopleList />
    </Suspense>
  );
}

function PeopleList() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [people, setPeople] = useState([]);
  const [archived, setArchived] = useState([]);
  const [fetching, setFetching] = useState(true);

  // Home's search box hands its query over as ?q=
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [activeRoles, setActiveRoles] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectMode, setSelectMode] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return "table";
    const saved = window.localStorage.getItem(VIEW_MODE_KEY);
    return saved === "cards" ? "cards" : "table";
  });

  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === "cards" ? "table" : "cards";
      if (typeof window !== "undefined") window.localStorage.setItem(VIEW_MODE_KEY, next);
      return next;
    });
  };
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    const unsubscribe = subscribeAllPeopleByAssignee(user.uid, ({ people: active, archived: arch }) => {
      setPeople(active);
      setArchived(arch);
      setFetching(false);
    });
    return unsubscribe;
  }, [user]);

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const toggleSelect = (person) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(person.id) ? next.delete(person.id) : next.add(person.id);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;
    setArchiving(true);
    await Promise.all([...selectedIds].map((id) => updatePerson(id, { archived: true })));
    setSelectedIds(new Set());
    setSelectMode(false);
    setArchiving(false);
  };

  const toggleRole = (r) => {
    if (r === "Archived") { setShowArchived((v) => !v); return; }
    if (EXCLUSIVE_ROLES.includes(r)) {
      setActiveRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev.filter((x) => !EXCLUSIVE_ROLES.includes(x)), r]);
      return;
    }
    setActiveRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const hasAnyFilter = activeFilterCount > 0 || activeRoles.length > 0 || showArchived;

  const pool = useMemo(
    () => (loading ? [] : (showArchived ? archived : people)),
    [loading, showArchived, archived, people]
  );

  const uniqueMetAt = useMemo(
    () => Array.from(
      new Set(pool.map((p) => (p.metAt || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b)),
    [pool]
  );

  // The chip counts are of everyone on the active list, whatever else is filtered.
  const roleCounts = useMemo(() => {
    const counts = { all: people.length };
    for (const p of people) {
      for (const r of p.roles || []) counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [people]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => pool.reduce((acc, p) => {
    if (activeRoles.length > 0 && !activeRoles.some((r) => (p.roles || []).includes(r))) return acc;
    if (filters.contactType && p.contactType !== filters.contactType) return acc;
    if (filters.source && p.source !== filters.source) return acc;
    if (filters.metAt && !p.metAt?.toLowerCase().includes(filters.metAt.toLowerCase())) return acc;
    if (filters.gospelShared === "yes" && !p.gospelShared) return acc;
    if (filters.gospelShared === "no" && p.gospelShared) return acc;
    if (filters.prayed === "yes" && !p.prayed) return acc;
    if (filters.prayed === "no" && p.prayed) return acc;
    if (filters.saved === "yes" && !p.saved) return acc;
    if (filters.saved === "no" && p.saved) return acc;
    let matchedField = null;
    if (q) {
      const searchFields = [
        ["name", p.name],
        ["contact", p.contact],
        ["type", p.contactType],
        ["source", p.source],
        ["met at", p.metAt],
        ["notes", p.description],
        ["progress", p.progressRemarks],
        ["role", (p.roles || []).join(" ")],
      ];
      const hit = searchFields.find(([, v]) => v && String(v).toLowerCase().includes(q));
      if (!hit) return acc;
      matchedField = hit[0];
    }
    const show = matchedField && matchedField !== "name" && matchedField !== "contact"
      ? matchedField
      : null;
    acc.push({ ...p, _matchedField: show });
    return acc;
  }, []), [pool, activeRoles, filters, q]);

  if (loading) return null;

  const filtersOn = showFilters || activeFilterCount > 0;
  const countLine = showArchived
    ? `Showing ${filtered.length} archived`
    : `Showing ${filtered.length} of ${pool.length}`;

  const archiveText = selectedIds.size > 0 ? `Archive ${selectedIds.size} selected` : "Archive selected";
  const archiveLabel = (
    <>
      <FiArchive size={18} aria-hidden="true" />
      {archiving ? "…" : selectedIds.size > 0 && <span className="tabular-nums">{selectedIds.size}</span>}
    </>
  );

  return (
    <PageShell
      title="My people"
      rightAction={
        <>
          <div className="hidden md:block">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search name, contact, notes, met at"
              className="h-11 w-80 max-w-full rounded-[14px] [&>input]:text-[15px]"
            />
          </div>
          <button
            type="button"
            aria-label="Filters"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}
            className={`${HEAD_BTN} ${filtersOn ? HEAD_BTN_ON : HEAD_BTN_IDLE}`}
          >
            <Icon d={ICON_FILTERS} />
            <span className="hidden md:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span
                aria-label={`${activeFilterCount} filters on`}
                className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-white md:static"
              >
                {activeFilterCount}
              </span>
            )}
          </button>
          {selectMode ? (
            <>
              <Button variant="outline" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
                Cancel
              </Button>
              {/* Laptop: the action sits with the other heading buttons. Phones get the floating bar below. */}
              <Button className="hidden md:inline-flex" onClick={handleBulkArchive} disabled={selectedIds.size === 0 || archiving} title={archiveText} aria-label={archiveText}>
                {archiveLabel}
              </Button>
            </>
          ) : (
            <>
              <button type="button" aria-label="Bulk edit" onClick={() => router.push("/bulk-edit")} className={`${HEAD_BTN} ${HEAD_BTN_IDLE}`}>
                <Icon d={ICON_EDIT} />
                <span className="hidden md:inline">Bulk edit</span>
              </button>
              <button type="button" aria-label="Select people" onClick={() => setSelectMode(true)} className={`${HEAD_BTN} ${HEAD_BTN_IDLE}`}>
                <Icon d={ICON_SELECT_ROUND} className="md:hidden" />
                <Icon d={ICON_SELECT_SQUARE} className="hidden md:block" />
                <span className="hidden md:inline">Select</span>
              </button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 md:gap-[18px]">
        {/* Phone: search sits under the heading */}
        <div className="md:hidden">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search name, contact, notes"
            className="h-12 rounded-2xl"
          />
        </div>

        {/* Filter panel */}
        {showFilters && (
          <section
            aria-label="Filters"
            className="grid grid-cols-2 items-start gap-3.5 rounded-3xl bg-white px-5 pb-5 pt-[18px] shadow-card md:flex md:flex-wrap"
          >
            <FilterSelect
              label="Contact type"
              className="md:flex-[1_1_140px]"
              value={filters.contactType}
              onChange={(v) => setFilter("contactType", v)}
              options={[{ value: "", label: "All" }, ...CONTACT_TYPES.map((t) => ({ value: t, label: t }))]}
            />
            <FilterSelect
              label="Source"
              className="md:flex-[1.3_1_180px]"
              value={filters.source}
              onChange={(v) => setFilter("source", v)}
              options={[{ value: "", label: "All" }, ...SOURCES.map((s) => ({ value: s, label: s }))]}
            />

            <MetAtCombo value={filters.metAt} onChange={(v) => setFilter("metAt", v)} options={uniqueMetAt} />

            <FilterSelect
              label="Gospel shared"
              className="md:flex-[0_1_118px]"
              value={filters.gospelShared}
              onChange={(v) => setFilter("gospelShared", v)}
              options={BOOL_OPTIONS}
            />
            <FilterSelect
              label="Prayed"
              className="md:flex-[0_1_118px]"
              value={filters.prayed}
              onChange={(v) => setFilter("prayed", v)}
              options={BOOL_OPTIONS}
            />
            <FilterSelect
              label="Saved"
              className="md:flex-[0_1_118px]"
              value={filters.saved}
              onChange={(v) => setFilter("saved", v)}
              options={BOOL_OPTIONS}
            />

            {activeFilterCount > 0 && (
              <div className="col-span-full -mb-2 -mt-1.5 flex md:basis-full">
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="min-h-11 px-1 text-sm font-semibold text-danger-ink hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
        )}

        {/* Role chips, and on laptop the view switch */}
        <div className="flex items-center justify-between gap-3 md:flex-wrap">
          <ChipRow label="Filter by role" className="min-w-0 flex-1 md:flex-wrap md:overflow-visible">
            <Chip active={activeRoles.length === 0} onClick={() => setActiveRoles([])} className="md:h-[38px]">
              All {roleCounts.all}
            </Chip>
            {ROLE_FILTERS.map((f) => {
              const isArchived = f === "Archived";
              const active = isArchived ? showArchived : activeRoles.includes(f);
              return (
                <Chip
                  key={f}
                  active={active}
                  onClick={() => toggleRole(f)}
                  className={`md:h-[38px] ${isArchived && active ? "bg-ink-2!" : ""}`}
                >
                  {isArchived ? f : `${f} ${roleCounts[f] || 0}`}
                </Chip>
              );
            })}
          </ChipRow>
          <div role="group" aria-label="View" className="hidden shrink-0 gap-1 rounded-[14px] bg-fill p-1 md:flex">
            <button
              type="button"
              aria-pressed={viewMode === "table"}
              onClick={() => { if (viewMode !== "table") toggleViewMode(); }}
              className={`${SEGMENT} ${viewMode === "table" ? SEGMENT_ON : SEGMENT_OFF}`}
            >
              Table
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "cards"}
              onClick={() => { if (viewMode !== "cards") toggleViewMode(); }}
              className={`${SEGMENT} ${viewMode === "cards" ? SEGMENT_ON : SEGMENT_OFF}`}
            >
              Cards
            </button>
          </div>
        </div>

        {fetching ? (
          <div role="status" className="flex min-h-[360px] items-center justify-center">
            <span aria-hidden="true" className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
            <span className="sr-only">Loading</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-3xl bg-white px-6 py-14 text-center ring-1 ring-line-soft">
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
              <Icon d={hasAnyFilter || q ? ICON_SEARCH : ICON_PEOPLE} className="h-[26px]! w-[26px]!" strokeWidth={1.9} />
            </span>
            <p className="mt-1.5 text-[17px] font-bold tracking-[-0.015em]">
              No people found{hasAnyFilter ? " matching your filters" : ""}.
            </p>
          </div>
        ) : (
          <>
            {/* Phone is always the list. Laptop is the table, or the same cards in a grid. */}
            <div className={viewMode === "table" ? "md:hidden" : "md:grid md:grid-cols-2 md:gap-3 xl:grid-cols-3"}>
              {filtered.map((p) => (
                <PersonCard
                  key={p.id}
                  person={p}
                  onSelect={selectMode ? toggleSelect : undefined}
                  selected={selectedIds.has(p.id)}
                />
              ))}
            </div>
            {viewMode === "table" && (
              <div className="hidden md:block">
                <PeopleTable
                  people={filtered}
                  onRowClick={(p) => router.push(`/person/${p.id}`)}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                />
              </div>
            )}

            <div className={`flex-wrap items-center gap-4 text-[13px] text-muted md:flex ${selectMode ? "flex" : "hidden"}`}>
              {viewMode === "table" && (
                <span className="hidden flex-wrap items-center gap-4 md:flex">
                  <span className="font-semibold text-ink">Status</span>
                  {STATUS_MARKS.map((m) => (
                    <span key={m.key} className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className="flex h-5.5 w-5.5 items-center justify-center rounded-lg bg-brand text-[11.5px] font-bold text-white">{m.letter}</span>
                      {m.label}
                    </span>
                  ))}
                </span>
              )}
              <span className="ml-auto">
                {selectMode && `${selectedIds.size} selected · `}{countLine}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Bulk archive action bar */}
      {selectMode && (
        <div className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 md:hidden">
          <button
            type="button"
            onClick={handleBulkArchive}
            disabled={selectedIds.size === 0 || archiving}
            title={archiveText}
            aria-label={archiveText}
            className="flex h-12 items-center gap-2 whitespace-nowrap rounded-2xl bg-navy px-[18px] text-sm font-semibold text-white shadow-float transition-opacity disabled:opacity-50"
          >
            {archiveLabel}
          </button>
        </div>
      )}
    </PageShell>
  );
}

const ROW_COLS = "grid-cols-[40px_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_170px_96px]";
const ROW_COLS_SELECT = "grid-cols-[28px_40px_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_170px_96px]";

function PeopleTable({ people, onRowClick, selectMode, selectedIds, onToggleSelect }) {
  if (people.length === 0) return null;
  const row = `grid items-center gap-x-3.5 px-3.5 ${selectMode ? ROW_COLS_SELECT : ROW_COLS}`;
  return (
    <div className="overflow-x-auto">
      <div role="table" aria-label="People" className={`flex flex-col gap-0.5 ${selectMode ? "min-w-[900px]" : "min-w-[860px]"}`}>
        <div role="row" className={`${row} h-[30px] text-[13px] font-bold`}>
          {selectMode && <span role="columnheader"><span className="sr-only">Selected</span></span>}
          <span role="columnheader" />
          <span role="columnheader">Name</span>
          <span role="columnheader">Contact</span>
          <span role="columnheader">Source</span>
          <span role="columnheader">Met at</span>
          <span role="columnheader">Roles</span>
          <span role="columnheader">Status</span>
        </div>
        {people.map((p, i) => {
          const isSelected = selectMode && selectedIds.has(p.id);
          return (
            <div
              key={p.id}
              role="row"
              onClick={() => (selectMode ? onToggleSelect(p) : onRowClick(p))}
              className={`${row} min-h-[62px] cursor-pointer rounded-2xl transition-colors hover:bg-brand-soft ${
                isSelected ? "bg-role-contact" : i % 2 === 0 ? "bg-tint" : "bg-white"
              }`}
            >
              {selectMode && (
                <span role="cell" className="relative inline-flex h-[22px] w-[22px] items-center justify-center">
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.name}`}
                    checked={isSelected}
                    onChange={() => onToggleSelect(p)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-[22px] w-[22px] cursor-pointer appearance-none rounded-[7px] bg-white ring-[1.5px] ring-inset ring-muted checked:bg-brand checked:ring-brand"
                  />
                  {isSelected && (
                    <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute text-white">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
              )}
              <span role="cell" className="flex">
                <Avatar name={p.name} size="sm" className="h-10! w-10! rounded-[13px]!" />
              </span>
              <span role="cell" className={`min-w-0 ${p._matchedField ? "py-2" : ""}`}>
                {/* A real button so the row can be opened from the keyboard; the click is handled by the row. */}
                <button type="button" className="block max-w-full truncate text-left font-semibold tracking-[-0.01em]">
                  {p.name}
                </button>
                {p._matchedField && (
                  <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-warn-soft px-2 text-xs font-semibold text-warn-ink">
                    matched: {p._matchedField}
                  </span>
                )}
              </span>
              <span role="cell" className="min-w-0">
                <span className="flex min-w-0">
                  <ContactHandle contactType={p.contactType} contact={p.contact} />
                </span>
                {p.contactType ? <ContactTypeTag contactType={p.contactType} className="mt-1" /> : <span className="block text-[13px] text-muted">—</span>}
              </span>
              <span role="cell" className="min-w-0 truncate">{p.source || "—"}</span>
              <span role="cell" className="min-w-0 truncate">{p.metAt || "—"}</span>
              <span role="cell" className="flex flex-wrap gap-1 py-1">
                {(p.roles || []).map((r) => <RoleTag key={r} role={r} />)}
              </span>
              <span role="cell" className="flex gap-1">
                {STATUS_MARKS.map((m) => (
                  <span
                    key={m.key}
                    role="img"
                    aria-label={p[m.key] ? m.label : `Not ${m.label.toLowerCase()}`}
                    className={`flex h-6.5 w-6.5 items-center justify-center rounded-[9px] text-xs font-bold ${
                      p[m.key] ? "bg-brand text-white" : "bg-line-soft text-muted"
                    }`}
                  >
                    {m.letter}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
