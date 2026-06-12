"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { subscribeAllPeopleByAssignee, updatePerson } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import PersonCard from "@/components/PersonCard";
import SearchBar from "@/components/SearchBar";
import { CONTACT_ROLES, CONTACT_TYPES, SOURCES } from "@/config/app";
import { FiSliders, FiGrid, FiCheckSquare } from "react-icons/fi";

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
const EMPTY_FILTERS = { contactType: "", source: "", gospelShared: "", prayed: "", saved: "" };

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
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

  if (loading) return null;

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

  const pool = showArchived ? archived : people;

  const filtered = pool.filter((p) => {
    if (activeRoles.length > 0 && !activeRoles.some((r) => (p.roles || []).includes(r))) return false;
    if (filters.contactType && p.contactType !== filters.contactType) return false;
    if (filters.source && p.source !== filters.source) return false;
    if (filters.gospelShared === "yes" && !p.gospelShared) return false;
    if (filters.gospelShared === "no" && p.gospelShared) return false;
    if (filters.prayed === "yes" && !p.prayed) return false;
    if (filters.prayed === "no" && p.prayed) return false;
    if (filters.saved === "yes" && !p.saved) return false;
    if (filters.saved === "no" && p.saved) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.contact?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

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
          <SearchBar value={search} onChange={setSearch} />
        </div>
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
