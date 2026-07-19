"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { subscribeAllPeopleByAssignee, updatePerson } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import PersonCard from "@/components/PersonCard";
import SearchBar from "@/components/SearchBar";
import { CONTACT_ROLES, CONTACT_TYPES, SOURCES } from "@/config/app";
import { FiSliders, FiGrid, FiCheckSquare, FiList } from "react-icons/fi";
import ContactActions from "@/components/ContactActions";

const ROLE_COLORS = {
  Contact: "bg-blue-500",
  Disciple: "bg-emerald-500",
  CGL: "bg-violet-500",
  "Core Team": "bg-orange-500",
};

const ROLE_FILTERS = [...CONTACT_ROLES, "Core Team", "Archived"];

const BOOL_OPTIONS = [
  { value: "", label: "All" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const EXCLUSIVE_ROLES = ["Contact", "Disciple"];
const EMPTY_FILTERS = { contactType: "", source: "", metAt: "", gospelShared: "", prayed: "", saved: "" };
const VIEW_MODE_KEY = "consolapp:peopleViewMode";

function MetAtCombo({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef(null);

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
    <div className="flex flex-col gap-2" ref={boxRef}>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Met At</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search location…"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-8 text-sm text-gray-900 outline-none focus:border-blue-500"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        )}
        {open && matches.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
            {matches.map((m, i) => (
              <button
                key={m}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 text-sm ${
                  i === highlight ? "bg-blue-50 text-blue-700" : "text-gray-800 hover:bg-gray-50"
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

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-9 text-sm text-gray-900 outline-none focus:border-blue-500 appearance-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M5 8l5 5 5-5H5z" />
        </svg>
      </div>
    </div>
  );
}

export default function People() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const [people, setPeople] = useState([]);
  const [archived, setArchived] = useState([]);
  const [fetching, setFetching] = useState(true);

  const [search, setSearch] = useState("");
  const [activeRoles, setActiveRoles] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectMode, setSelectMode] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return "cards";
    const saved = window.localStorage.getItem(VIEW_MODE_KEY);
    return saved === "table" ? "table" : "cards";
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

  return (
    <PageShell
      title="My People"
      rightAction={
        <div className="flex items-center gap-3">
          {selectMode ? (
            <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} className="text-xs font-semibold text-gray-500">
              Cancel
            </button>
          ) : (
            <>
              <button onClick={() => router.push("/bulk-edit")} className="flex flex-col items-center text-gray-600 active:opacity-70">
                <FiGrid size={18} />
                <span className="text-[10px] font-semibold mt-0.5">Bulk Edit</span>
              </button>
              <button onClick={() => setSelectMode(true)} className="flex flex-col items-center text-gray-600 active:opacity-70">
                <FiCheckSquare size={18} />
                <span className="text-[10px] font-semibold mt-0.5">Select</span>
              </button>
            </>
          )}
        </div>
      }
    >
      {/* Search + filter toggle */}
      <div className="flex gap-2 mb-3 items-start">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Search name, contact, notes, met at…" />
        </div>
        <button
          onClick={toggleViewMode}
          title={viewMode === "cards" ? "Switch to table view" : "Switch to card view"}
          className="shrink-0 w-11 h-11 rounded-xl border bg-white border-gray-200 text-gray-600 flex items-center justify-center mb-4"
        >
          {viewMode === "cards" ? <FiList size={17} /> : <FiGrid size={17} />}
        </button>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`relative shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center transition-colors mb-4 ${
            showFilters || activeFilterCount > 0
              ? "bg-blue-50 border-blue-300 text-blue-600"
              : "bg-white border-gray-200 text-gray-600"
          }`}
        >
          <FiSliders size={17} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 mb-4 space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <FilterSelect
              label="Contact Type"
              value={filters.contactType}
              onChange={(v) => setFilter("contactType", v)}
              options={[{ value: "", label: "All" }, ...CONTACT_TYPES.map((t) => ({ value: t, label: t }))]}
            />
            <FilterSelect
              label="Source"
              value={filters.source}
              onChange={(v) => setFilter("source", v)}
              options={[{ value: "", label: "All" }, ...SOURCES.map((s) => ({ value: s, label: s }))]}
            />
          </div>

          <MetAtCombo value={filters.metAt} onChange={(v) => setFilter("metAt", v)} options={uniqueMetAt} />

          <div className="border-t border-gray-100" />

          <div className="grid grid-cols-3 gap-3">
            <FilterSelect
              label="Gospel Shared"
              value={filters.gospelShared}
              onChange={(v) => setFilter("gospelShared", v)}
              options={BOOL_OPTIONS}
            />
            <FilterSelect
              label="Prayed"
              value={filters.prayed}
              onChange={(v) => setFilter("prayed", v)}
              options={BOOL_OPTIONS}
            />
            <FilterSelect
              label="Saved"
              value={filters.saved}
              onChange={(v) => setFilter("saved", v)}
              options={BOOL_OPTIONS}
            />
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-xs font-semibold text-red-500"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Role chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        {ROLE_FILTERS.map((f) => {
          const isArchived = f === "Archived";
          const active = isArchived ? showArchived : activeRoles.includes(f);
          const activeColor = isArchived
            ? "bg-gray-700 text-white border-transparent"
            : `${ROLE_COLORS[f] || "bg-blue-500"} text-white border-transparent`;
          return (
            <button
              key={f}
              onClick={() => toggleRole(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
                active ? activeColor : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      {fetching ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-600 text-sm py-12">
          No people found{hasAnyFilter ? " matching your filters" : ""}.
        </p>
      ) : viewMode === "table" ? (
        <PeopleTable
          people={filtered}
          onRowClick={(p) => router.push(`/person/${p.id}`)}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p) => (
            <PersonCard
              key={p.id}
              person={p}
              onSelect={selectMode ? toggleSelect : undefined}
              selected={selectedIds.has(p.id)}
            />
          ))}
        </div>
      )}

      {/* Bulk archive action bar */}
      {selectMode && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={handleBulkArchive}
            disabled={selectedIds.size === 0 || archiving}
            className="flex items-center gap-2 px-6 py-3 bg-gray-800 disabled:opacity-40 text-white text-sm font-semibold rounded-2xl shadow-xl transition-opacity"
          >
            {archiving ? "Archiving…" : `Archive ${selectedIds.size > 0 ? `(${selectedIds.size})` : ""}`}
          </button>
        </div>
      )}
    </PageShell>
  );
}

function PeopleTable({ people, onRowClick, selectMode, selectedIds, onToggleSelect }) {
  if (people.length === 0) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
          <tr>
            {selectMode && <th className="px-3 py-2 w-8"></th>}
            <th className="px-3 py-2 text-left font-semibold">Name</th>
            <th className="px-3 py-2 text-left font-semibold">Contact</th>
            <th className="px-3 py-2 text-left font-semibold">Type</th>
            <th className="px-3 py-2 text-left font-semibold">Source</th>
            <th className="px-3 py-2 text-left font-semibold">Met At</th>
            <th className="px-3 py-2 text-left font-semibold">Roles</th>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            return (
              <tr
                key={p.id}
                onClick={() => (selectMode ? onToggleSelect(p) : onRowClick(p))}
                className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                {selectMode && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => onToggleSelect(p)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">
                  {p.name}
                  {p._matchedField && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                      matched: {p._matchedField}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    {p.contact}
                    <ContactActions contactType={p.contactType} contact={p.contact} size={12} />
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.contactType || "—"}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.source || "—"}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.metAt || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex gap-1 flex-wrap">
                    {(p.roles || []).map((r) => (
                      <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold">
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                  {p.gospelShared && <span className="mr-1">G</span>}
                  {p.prayed && <span className="mr-1">P</span>}
                  {p.saved && <span className="mr-1">S</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
