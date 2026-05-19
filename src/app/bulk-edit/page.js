"use client";

import { useEffect, useState, useCallback } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByTeam, getCGsByTeam, getUsersByTeam, updatePerson } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import { CONTACT_TYPES, SOURCES } from "@/config/app";

const COLUMNS = [
  { key: "name",         label: "Name",        type: "text",   width: 160 },
  { key: "contactType",  label: "Type",         type: "select", options: CONTACT_TYPES, width: 110 },
  { key: "contact",      label: "Contact",      type: "text",   width: 140 },
  { key: "source",       label: "Source",       type: "select", options: SOURCES, width: 110 },
  { key: "age",          label: "Age",          type: "number", width: 65 },
  { key: "address",      label: "Address",      type: "text",   width: 180 },
  { key: "metAt",        label: "Met At",       type: "text",   width: 120 },
  { key: "cgId",         label: "CG",           type: "cg",     width: 130 },
  { key: "assignedTo",   label: "Assigned To",  type: "user",   width: 130 },
  { key: "gospelShared", label: "Gospel",       type: "bool",   width: 65 },
  { key: "prayed",       label: "Prayed",       type: "bool",   width: 65 },
  { key: "saved",        label: "Saved",        type: "bool",   width: 65 },
];

export default function BulkEdit() {
  const { loading: authLoading, profile } = useRequireAuth();

  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(new Set());
  const [cgs, setCgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [focusedCell, setFocusedCell] = useState(null);

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
  }, []);

  // Global paste handler — multi-cell paste from Google Sheets
  useEffect(() => {
    const onPaste = (e) => {
      if (focusedCell === null) return;
      const text = e.clipboardData.getData("text/plain");
      const pasteRows = text.split(/\r?\n/).filter((r) => r !== "");
      // Only intercept if multi-row or tab-separated
      if (pasteRows.length <= 1 && !pasteRows[0]?.includes("\t")) return;
      e.preventDefault();

      const { row: startRow, col: startCol } = focusedCell;
      setRows((prev) => {
        const next = [...prev];
        pasteRows.forEach((pasteRow, ri) => {
          const rowIndex = startRow + ri;
          if (rowIndex >= next.length) return;
          const cells = pasteRow.split("\t");
          cells.forEach((raw, ci) => {
            const colIndex = startCol + ci;
            if (colIndex >= COLUMNS.length) return;
            const col = COLUMNS[colIndex];
            let val = raw.trim();
            if (col.type === "bool") {
              val = ["yes", "true", "1", "✓", "x"].includes(val.toLowerCase());
            } else if (col.type === "number") {
              val = val ? parseInt(val) || null : null;
            } else if (col.type === "cg") {
              const match = cgs.find((c) => c.name.toLowerCase() === val.toLowerCase());
              val = match ? match.id : "";
            } else if (col.type === "user") {
              const match = users.find((u) => u.name.toLowerCase() === val.toLowerCase());
              val = match ? match.id : "";
            }
            next[rowIndex] = { ...next[rowIndex], [col.key]: val };
          });
          setDirty((prev) => new Set([...prev, startRow + ri]));
        });
        return next;
      });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [focusedCell, cgs, users]);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([...dirty].map((i) => rows[i] && updatePerson(rows[i].id, rows[i])));
      setDirty(new Set());
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch {}
    setSaving(false);
  };

  if (authLoading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const totalWidth = COLUMNS.reduce((a, c) => a + c.width, 0) + 40;

  return (
    <PageShell title="Bulk Edit" backHref="/people">
      <p className="text-xs text-gray-500 mb-3">
        Click a cell to select it, then paste copied rows from Google Sheets. Edited rows are highlighted.
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="text-sm border-collapse" style={{ minWidth: totalWidth, width: "100%" }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 px-2 py-2 text-xs font-semibold text-gray-400 border-r border-gray-200 text-center">#</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-2 text-left text-xs font-semibold text-gray-600 border-r border-gray-100 whitespace-nowrap"
                  style={{ width: col.width, minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="text-center text-gray-400 py-10 text-sm">
                  No people found.
                </td>
              </tr>
            )}
            {rows.map((row, ri) => (
              <tr key={row.id} className={`border-b border-gray-100 ${dirty.has(ri) ? "bg-amber-50" : "hover:bg-gray-50"}`}>
                <td className="px-2 py-0 text-xs text-gray-400 border-r border-gray-100 text-center w-10">{ri + 1}</td>
                {COLUMNS.map((col, ci) => {
                  const focused = focusedCell?.row === ri && focusedCell?.col === ci;
                  return (
                    <td
                      key={col.key}
                      className={`border-r border-gray-100 p-0 ${focused ? "ring-2 ring-inset ring-blue-400" : ""}`}
                      style={{ width: col.width, minWidth: col.width }}
                    >
                      <CellInput
                        col={col}
                        value={row[col.key]}
                        cgs={cgs}
                        users={users}
                        onFocus={() => setFocusedCell({ row: ri, col: ci })}
                        onChange={(v) => updateCell(ri, col.key, v)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleSaveAll}
        disabled={saving || dirty.size === 0}
        className="w-full mt-4 py-3 bg-linear-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-40 text-sm transition-opacity"
      >
        {saving ? "Saving…" : dirty.size > 0 ? `Save Changes (${dirty.size} row${dirty.size > 1 ? "s" : ""})` : "Save Changes"}
      </button>
      {savedMsg && <p className="text-center text-sm font-medium text-emerald-600 mt-2">Changes saved.</p>}
    </PageShell>
  );
}

const cellCls = "w-full h-full px-2 py-1.5 bg-transparent outline-none text-gray-900 text-sm leading-tight";

function CellInput({ col, value, cgs, users, onFocus, onChange }) {
  if (col.type === "bool") {
    return (
      <div className="flex items-center justify-center h-8">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          onFocus={onFocus}
          className="w-4 h-4 accent-blue-500 cursor-pointer"
        />
      </div>
    );
  }

  if (col.type === "select") {
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} className={cellCls}>
        <option value=""></option>
        {(col.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (col.type === "cg") {
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} className={cellCls}>
        <option value=""></option>
        {cgs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    );
  }

  if (col.type === "user") {
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} className={cellCls}>
        <option value=""></option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    );
  }

  return (
    <input
      type={col.type === "number" ? "number" : "text"}
      value={value ?? ""}
      onChange={(e) => onChange(col.type === "number" ? (e.target.value ? parseInt(e.target.value) : null) : e.target.value)}
      onFocus={onFocus}
      className={cellCls}
    />
  );
}
