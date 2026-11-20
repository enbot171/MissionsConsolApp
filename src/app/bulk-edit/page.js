"use client";

import { useEffect, useState, useCallback } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByTeam, getCGsByTeam, getUsersByTeam, updatePerson, addPerson } from "@/lib/firestore";
import { CONTACT_TYPES, SOURCES, MILESTONES } from "@/config/app";
import PageShell from "@/components/PageShell";
import Spinner from "@/components/Spinner";
import { Button } from "@/components/ui";
import { FiAlertCircle, FiCheck, FiPlus } from "react-icons/fi";

// Column groups shown in a top header band
const GROUPS = [
  { label: "Basic info",       span: 9 },
  { label: "Notes",            span: 2 },
  { label: "Roles",            span: 4 },
  { label: "Status",           span: 3 },
  { label: "Milestones",       span: MILESTONES.length },
];

const COLUMNS = [
  // ── Basic Info ──────────────────────────────────────────────────────────────
  { key: "name",         label: "Name (required)", type: "text",      width: 155, required: true },
  { key: "contactType",  label: "Type",        type: "select",    options: CONTACT_TYPES, width: 140 },
  { key: "contact",      label: "Contact (required)", type: "text",      width: 145, required: true },
  { key: "source",       label: "Source",      type: "select",    options: SOURCES, width: 150 },
  { key: "age",          label: "Age",         type: "number",    width: 64 },
  { key: "address",      label: "Address",     type: "text",      width: 185 },
  { key: "metAt",        label: "Met at",      type: "text",      width: 120 },
  { key: "cgId",         label: "CG",          type: "cg",        width: 130 },
  { key: "assignedTo",   label: "Assigned to", type: "user",      width: 130 },
  // ── Notes ───────────────────────────────────────────────────────────────────
  { key: "description",      label: "Remarks",          type: "text", width: 175 },
  { key: "progressRemarks",  label: "Progress remarks", type: "text", width: 175 },
  // ── Roles ───────────────────────────────────────────────────────────────────
  { key: "roles", subKey: "Contact",    label: "Contact",    type: "role", width: 68 },
  { key: "roles", subKey: "Disciple",   label: "Disciple",   type: "role", width: 68 },
  { key: "roles", subKey: "CGL",        label: "CGL",        type: "role", width: 52 },
  { key: "roles", subKey: "Core Team",  label: "Core Tm",    type: "role", width: 68 },
  // ── Status ──────────────────────────────────────────────────────────────────
  { key: "gospelShared", label: "Gospel",  type: "bool", width: 60 },
  { key: "prayed",       label: "Prayed",  type: "bool", width: 60 },
  { key: "saved",        label: "Saved",   type: "bool", width: 55 },
  // ── Milestones ──────────────────────────────────────────────────────────────
  ...MILESTONES.map((m) => ({ key: "milestones", subKey: m, label: m, type: "milestone", width: Math.max(52, m.length * 8 + 16) })),
];

// 44px selection column plus every data column.
const GRID_WIDTH = 44 + COLUMNS.reduce((a, c) => a + c.width, 0);

const EXCLUSIVE_ROLES = ["Contact", "Disciple"];

// Proper TSV parser — handles quoted fields with embedded newlines and tabs (Google Sheets format)
function parseTSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      i++;
      while (i < text.length) {
        if (text[i] === '"' && text[i + 1] === '"') { cell += '"'; i += 2; }
        else if (text[i] === '"') { i++; break; }
        else { cell += text[i++]; }
      }
    } else if (text[i] === '\t') {
      row.push(cell); cell = ""; i++;
    } else if (text[i] === '\r' && text[i + 1] === '\n') {
      row.push(cell); rows.push(row); row = []; cell = ""; i += 2;
    } else if (text[i] === '\n') {
      row.push(cell); rows.push(row); row = []; cell = ""; i++;
    } else {
      cell += text[i++];
    }
  }
  if (cell || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ""));
}

let _uid = 0;
const blankRow = () => ({
  _isNew: true,
  _key: ++_uid,
  name: "", contactType: "", contact: "", source: "",
  age: null, address: "", metAt: "", description: "", progressRemarks: "",
  cgId: "", assignedTo: "",
  gospelShared: false, prayed: false, saved: false,
  roles: ["Contact"], ministries: [], milestones: {},
});

// Derive value and onChange for any column type
function getCellValue(col, row) {
  if (col.type === "role") return (row.roles || []).includes(col.subKey);
  if (col.type === "milestone") return !!row.milestones?.[col.subKey];
  return row[col.key];
}

function applyPastedValue(col, val, row) {
  // Returns { key, value } — what to pass to updateCell
  const boolVal = ["yes", "true", "1", "✓", "x"].includes(val.toLowerCase());
  if (col.type === "bool") return { key: col.key, value: boolVal };
  if (col.type === "role") {
    let roles = [...(row.roles || [])];
    if (boolVal) {
      if (EXCLUSIVE_ROLES.includes(col.subKey)) roles = roles.filter((r) => !EXCLUSIVE_ROLES.includes(r));
      if (!roles.includes(col.subKey)) roles.push(col.subKey);
    } else {
      roles = roles.filter((r) => r !== col.subKey);
    }
    return { key: "roles", value: roles };
  }
  if (col.type === "milestone") {
    return { key: "milestones", value: { ...(row.milestones || {}), [col.subKey]: boolVal } };
  }
  if (col.type === "number") return { key: col.key, value: val ? parseInt(val) || null : null };
  return { key: col.key, value: val };
}

export default function BulkEdit() {
  const { loading: authLoading, profile, user } = useRequireAuth();
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(new Set());
  const [errors, setErrors] = useState(new Set());
  const [cgs, setCgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [focusedCell, setFocusedCell] = useState(null);
  const [addCount, setAddCount] = useState(5);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!profile?.teamId) return;
    Promise.all([
      getPeopleByTeam(profile.teamId),
      getCGsByTeam(profile.teamId),
      getUsersByTeam(profile.teamId),
    ]).then(([people, c, u]) => {
      setRows(people);
      setCgs(c);
      setUsers(u);
      setFetching(false);
    });
  }, [profile?.teamId]);

  const updateCell = useCallback((ri, key, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[ri] = { ...next[ri], [key]: value };
      return next;
    });
    setDirty((prev) => new Set([...prev, ri]));
    setErrors((prev) => { const n = new Set(prev); n.delete(ri); return n; });
  }, []);

  // Role toggle with Contact/Disciple mutual exclusivity
  const toggleRole = useCallback((ri, roleName, currentRoles) => {
    const roles = [...(currentRoles || [])];
    if (roles.includes(roleName)) {
      updateCell(ri, "roles", roles.filter((r) => r !== roleName));
    } else {
      const next = EXCLUSIVE_ROLES.includes(roleName)
        ? [...roles.filter((r) => !EXCLUSIVE_ROLES.includes(r)), roleName]
        : [...roles, roleName];
      updateCell(ri, "roles", next);
    }
  }, [updateCell]);

  const toggleRowSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;
    setArchiving(true);
    await Promise.all([...selectedIds].map((id) => updatePerson(id, { archived: true })));
    const people = await getPeopleByTeam(profile.teamId);
    setRows(people);
    setDirty(new Set());
    setErrors(new Set());
    setSelectedIds(new Set());
    setArchiving(false);
  };

  const handleAddRows = () => {
    const count = Math.min(100, Math.max(1, addCount || 1));
    setRows((prev) => [...prev, ...Array.from({ length: count }, blankRow)]);
  };

  // Global paste from Google Sheets
  useEffect(() => {
    const onPaste = (e) => {
      if (focusedCell === null) return;
      const text = e.clipboardData.getData("text/plain");
      const pasteRows = parseTSV(text);
      if (pasteRows.length === 0 || (pasteRows.length === 1 && pasteRows[0].length <= 1)) return;
      e.preventDefault();

      const { row: startRow, col: startCol } = focusedCell;
      setRows((prev) => {
        const next = [...prev];
        const newDirty = new Set();
        pasteRows.forEach((cells, ri) => {
          const rowIndex = startRow + ri;
          if (rowIndex >= next.length) return;
          let updated = { ...next[rowIndex] };
          cells.forEach((raw, ci) => {
            const colIndex = startCol + ci;
            if (colIndex >= COLUMNS.length) return;
            const col = COLUMNS[colIndex];
            const val = raw.trim();
            if (col.type === "cg") {
              const m = cgs.find((c) => c.name.toLowerCase() === val.toLowerCase());
              updated = { ...updated, cgId: m ? m.id : "" };
            } else if (col.type === "user") {
              const m = users.find((u) => u.name.toLowerCase() === val.toLowerCase());
              updated = { ...updated, assignedTo: m ? m.id : "" };
            } else {
              const { key, value } = applyPastedValue(col, val, updated);
              updated = { ...updated, [key]: value };
            }
          });
          next[rowIndex] = updated;
          newDirty.add(rowIndex);
        });
        setDirty((prev) => new Set([...prev, ...newDirty]));
        setErrors((prev) => { const n = new Set(prev); newDirty.forEach((i) => n.delete(i)); return n; });
        return next;
      });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [focusedCell, cgs, users]);

  const handleSaveAll = async () => {
    const newErrors = new Set();
    rows.forEach((row, i) => {
      const hasContent = row._isNew
        ? row.name?.trim() || row.contact?.trim()
        : dirty.has(i);
      if (!hasContent) return;
      if (!row.name?.trim()) newErrors.add(i);
      if (!row.contact?.trim()) newErrors.add(i);
    });
    if (newErrors.size > 0) { setErrors(newErrors); return; }

    setSaving(true);
    setSaveError("");
    try {
      const ops = rows.map((row, i) => {
        if (row._isNew && row.name?.trim() && row.contact?.trim()) {
          const { _isNew, _key, ...data } = row;
          return addPerson({ ...data, assignedTo: user.uid, assignedToName: profile?.name || "", teamId: profile?.teamId || "" });
        }
        if (!row._isNew && dirty.has(i)) return updatePerson(row.id, row);
        return null;
      }).filter(Boolean);

      await Promise.all(ops);
      const people = await getPeopleByTeam(profile.teamId);
      setRows(people);
      setDirty(new Set());
      setErrors(new Set());
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch {
      setSaveError("Save failed. Please try again.");
    }
    setSaving(false);
  };

  const pendingNew = rows.filter((r) => r._isNew && r.name?.trim() && r.contact?.trim()).length;
  const dirtyExisting = [...dirty].filter((i) => rows[i] && !rows[i]._isNew).length;
  const totalChanges = pendingNew + dirtyExisting;

  if (authLoading) return <Spinner fullScreen />;

  const existingCount = rows.filter((r) => !r._isNew).length;
  const newCount = rows.length - existingCount;
  const saveLabel = saving ? "Saving…" : totalChanges > 0 ? `Save (${totalChanges})` : "Save";
  const archiveLabel = archiving ? "Archiving…" : `Archive (${selectedIds.size})`;

  if (fetching) {
    return (
      <PageShell wide title="Bulk edit" backHref="/people" backLabel="My people">
        <div role="status" className="flex min-h-[360px] items-center justify-center">
          <span aria-hidden="true" className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
          <span className="sr-only">Loading</span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      wide
      title={
        <span className="flex items-baseline gap-2.5 md:gap-3">
          Bulk edit
          <span className="text-sm font-normal tracking-normal text-muted md:text-[15px]">
            {existingCount} {existingCount === 1 ? "person" : "people"}
          </span>
        </span>
      }
      backHref="/people"
      backLabel="My people"
      bottomBar={
        <>
          {selectedIds.size > 0 && (
            <Button variant="outline" size="lg" className="shrink-0 px-[18px]!" onClick={handleBulkArchive} disabled={archiving}>{archiveLabel}</Button>
          )}
          <Button size="lg" className="flex-1" onClick={handleSaveAll} disabled={saving || totalChanges === 0}>{saveLabel}</Button>
        </>
      }
      rightAction={
        <>
          {saveError && (
            <StatusPill tone="error">{saveError}</StatusPill>
          )}
          {savedMsg && (
            <StatusPill tone="success">Saved!</StatusPill>
          )}
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            Add rows
            <input
              type="number" min={1} max={100}
              value={addCount}
              onChange={(e) => setAddCount(parseInt(e.target.value) || 1)}
              className="h-11 w-[60px] rounded-[14px] border border-line bg-white px-2 text-center text-base font-normal text-ink md:w-[68px] md:px-2.5 md:text-[15px]"
            />
          </label>
          <Button variant="soft" className="gap-1.5!" onClick={handleAddRows}>
            <FiPlus size={17} aria-hidden="true" className="hidden md:block" />
            Add
          </Button>
          <span className="hidden items-center gap-2.5 md:flex">
            {selectedIds.size > 0 && (
              <Button variant="outline" onClick={handleBulkArchive} disabled={archiving}>{archiveLabel}</Button>
            )}
            <Button className="px-5!" onClick={handleSaveAll} disabled={saving || totalChanges === 0}>{saveLabel}</Button>
          </span>
        </>
      }
    >
      {/* ── Hint and legend ── */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-2xl bg-brand-soft px-3.5 py-2.5 text-[13px] text-ink-2 md:mb-3.5 md:gap-x-[18px] md:gap-y-2 md:px-4 md:text-[13.5px]">
        <span className="min-w-0 flex-[1_1_100%] md:flex-[1_1_280px]">
          <span className="md:hidden">Tap</span><span className="hidden md:inline">Click</span> a cell, then paste from Google Sheets to fill many cells at once.
        </span>
        <LegendSwatch className="bg-warn-soft">Edited</LegendSwatch>
        <LegendSwatch className="bg-ok-soft">New</LegendSwatch>
        <LegendSwatch className="bg-tint-rose">Missing required</LegendSwatch>
        {errors.size > 0 && !saveError && (
          <span role="alert" className="inline-flex flex-[1_1_100%] items-center gap-1.5 font-semibold text-danger-ink md:flex-none">
            <FiAlertCircle size={16} aria-hidden="true" />
            {errors.size} row{errors.size > 1 ? "s" : ""} missing Name / Contact
          </span>
        )}
      </div>

      {/* ── Table: scrolls both ways inside its own frame so the header row and
          the first column stay put. Full bleed on phones. ── */}
      <div className="-mx-5 max-h-[70dvh] overflow-auto border-t border-line md:mx-0 md:max-h-[calc(100dvh-19rem)] md:rounded-2xl md:border-t-0 md:ring-1 md:ring-line">
        <table
          aria-label="People, editable"
          className="table-fixed border-separate border-spacing-0 text-sm"
          style={{ width: GRID_WIDTH, minWidth: GRID_WIDTH }}
        >
          {/* Fixed layout: these are the board's grid tracks, to the pixel. */}
          <colgroup>
            <col style={{ width: 44 }} />
            {COLUMNS.map((col, ci) => (
              <col key={`${col.key}-${col.subKey ?? ci}`} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20">
            {/* Group row */}
            <tr className="h-[30px] bg-fill text-[12.5px] text-muted">
              <th className="sticky left-0 z-10 border-r border-line bg-fill p-0" />
              {GROUPS.map((g, gi) => (
                <th
                  key={gi}
                  colSpan={g.span}
                  scope="colgroup"
                  className={`px-2.5 py-0 text-left font-bold ${gi < GROUPS.length - 1 ? "border-r-2 border-line" : ""}`}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            {/* Column header row */}
            <tr className="bg-tint text-[13px] text-ink">
              <th className="sticky left-0 z-10 border-b border-r border-line bg-tint p-0">
                <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
                  <Check
                    aria-label="Select all people"
                    checked={selectedIds.size > 0 && rows.filter((r) => !r._isNew).every((r) => selectedIds.has(r.id))}
                    onChange={(e) => {
                      const existingIds = rows.filter((r) => !r._isNew).map((r) => r.id);
                      setSelectedIds(e.target.checked ? new Set(existingIds) : new Set());
                    }}
                  />
                </label>
              </th>
              {COLUMNS.map((col, ci) => {
                const isGroupEnd = isLastInGroup(ci);
                return (
                  <th
                    key={`${col.key}-${col.subKey ?? ci}`}
                    scope="col"
                    className={`h-11 overflow-hidden whitespace-nowrap border-b border-b-line px-2.5 py-0 text-left font-bold ${isGroupEnd ? "border-r-2 border-r-line" : "border-r border-r-line-soft"}`}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const isNew = row._isNew;
              const isDirty = dirty.has(ri) && !isNew;
              const hasError = errors.has(ri);
              const isSelected = !isNew && selectedIds.has(row.id);
              const tint = hasError ? "bg-tint-rose" : isNew ? "bg-ok-soft" : isDirty ? "bg-warn-soft" : isSelected ? "bg-fill" : "";
              const rowName = row.name?.trim() || `new row ${ri + 1}`;

              return (
                <tr key={row.id || row._key} className={`group ${tint || "bg-white hover:bg-tint"}`}>
                  <td className={`sticky left-0 z-10 border-b border-r border-b-line-soft border-r-line p-0 text-center ${tint || "bg-white group-hover:bg-tint"}`}>
                    {!isNew ? (
                      <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
                        <Check
                          aria-label={`Select ${rowName}`}
                          checked={isSelected}
                          onChange={() => toggleRowSelect(row.id)}
                        />
                      </label>
                    ) : (
                      <span className="text-[13px] text-muted">{ri + 1}</span>
                    )}
                  </td>
                  {COLUMNS.map((col, ci) => {
                    const isFocused = focusedCell?.row === ri && focusedCell?.col === ci;
                    const isGroupEnd = isLastInGroup(ci);
                    const cellValue = getCellValue(col, row);
                    // As on the board: only the required cells still empty are ringed.
                    const isErrCell = hasError && col.required && !String(cellValue ?? "").trim();

                    return (
                      <td
                        key={`${col.key}-${col.subKey ?? ci}`}
                        className={`border-b border-b-line-soft p-0 ${isGroupEnd ? "border-r-2 border-r-line" : "border-r border-r-line-soft"} ${isFocused ? "ring-2 ring-inset ring-brand" : ""} ${isErrCell && !isFocused ? "ring-2 ring-inset ring-warn" : ""}`}
                      >
                        <CellInput
                          col={col}
                          label={`${col.label}, ${rowName}`}
                          value={cellValue}
                          cgs={cgs}
                          users={users}
                          onFocus={() => setFocusedCell({ row: ri, col: ci })}
                          onChange={(v) => {
                            if (col.type === "role") {
                              toggleRole(ri, col.subKey, row.roles);
                            } else if (col.type === "milestone") {
                              updateCell(ri, "milestones", { ...(row.milestones || {}), [col.subKey]: v });
                            } else {
                              updateCell(ri, col.key, v);
                            }
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Outside the table so it sits in the visible width, not the grid's. */}
        {rows.length === 0 && (
          <div className="sticky left-0 flex flex-col items-center gap-1.5 px-6 py-[72px] text-center">
            <span aria-hidden="true" className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-soft text-brand">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16v12H4zM4 10h16M4 14h16M10 6v12" />
              </svg>
            </span>
            <p className="mt-1.5 text-[17px] font-bold tracking-[-0.015em] text-ink">No people yet</p>
            <p className="text-sm text-muted">Use &ldquo;Add rows&rdquo; to create new entries.</p>
          </div>
        )}
      </div>

      {/* ── Footer line (laptop board only; the phone board ends at the grid) ── */}
      <div className="mt-3.5 hidden flex-wrap items-center justify-between gap-3 text-[13px] text-muted md:flex">
        <span>Name and contact are required.</span>
        <span>
          {rows.length === 0
            ? "Showing 0"
            : `Showing ${existingCount} of ${existingCount}${newCount > 0 ? `, plus ${newCount} new ${newCount === 1 ? "row" : "rows"}` : ""}`}
        </span>
      </div>
    </PageShell>
  );
}

// The board's message pill, shown at the start of the heading actions.
function StatusPill({ tone, children }) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-center gap-2.5 rounded-[14px] px-3.5 py-3 text-sm font-medium ${isError ? "bg-danger-soft text-danger-ink" : "bg-ok-soft text-ok-ink"}`}
    >
      {isError ? <FiAlertCircle size={18} aria-hidden="true" className="shrink-0" /> : <FiCheck size={18} aria-hidden="true" className="shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

// A real checkbox drawn as the board's 22px box: white with a grey edge, or
// brand with a white tick.
function Check(props) {
  return (
    <span className="relative inline-flex h-[22px] w-[22px] shrink-0">
      <input
        type="checkbox"
        className="peer m-0 h-[22px] w-[22px] cursor-pointer appearance-none rounded-[7px] border-[1.5px] border-muted bg-white checked:border-brand checked:bg-brand"
        {...props}
      />
      <svg
        aria-hidden="true"
        width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        className="pointer-events-none absolute inset-0 m-auto hidden text-white peer-checked:block"
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

function LegendSwatch({ className, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-4 w-4 rounded-[5px] ring-1 ring-line ${className}`} />
      {children}
    </span>
  );
}

// Returns true if column ci is the last column in its group
function isLastInGroup(ci) {
  let cum = 0;
  for (const g of GROUPS) {
    cum += g.span;
    if (ci === cum - 1) return true;
    if (ci < cum) return false;
  }
  return false;
}

// Dense on laptop; 16px on phones so focusing a cell does not zoom the page.
const cellBase = "h-11 w-full min-w-0 bg-transparent text-base text-ink outline-none md:text-sm";
const cellCls = `${cellBase} px-2.5`;
// Narrower than the global select padding so short values fit the board's widths.
const selectCls = `${cellBase} pl-1.5 pr-6`;

function CellInput({ col, label, value, cgs, users, onFocus, onChange }) {
  if (col.type === "bool" || col.type === "role" || col.type === "milestone") {
    return (
      <label className="flex h-11 cursor-pointer items-center justify-center">
        <Check
          aria-label={label}
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          onFocus={onFocus}
        />
      </label>
    );
  }
  if (col.type === "select") {
    return (
      <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} className={selectCls}>
        <option value=""></option>
        {(col.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (col.type === "cg") {
    return (
      <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} className={selectCls}>
        <option value=""></option>
        {cgs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    );
  }
  if (col.type === "user") {
    return (
      <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} className={selectCls}>
        <option value=""></option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    );
  }
  return (
    <input
      type={col.type === "number" ? "number" : "text"}
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(col.type === "number" ? (e.target.value ? parseInt(e.target.value) : null) : e.target.value)}
      onFocus={onFocus}
      className={cellCls}
    />
  );
}
