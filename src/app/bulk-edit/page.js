"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPeopleByTeam, getCGsByTeam, getUsersByTeam, updatePerson, addPerson } from "@/lib/firestore";
import { CONTACT_TYPES, SOURCES } from "@/config/app";
import { FiArrowLeft, FiPlus } from "react-icons/fi";

const COLUMNS = [
  { key: "name",         label: "Name *",      type: "text",   width: 160, required: true },
  { key: "contactType",  label: "Type",         type: "select", options: CONTACT_TYPES, width: 110 },
  { key: "contact",      label: "Contact *",    type: "text",   width: 150, required: true },
  { key: "source",       label: "Source",       type: "select", options: SOURCES, width: 110 },
  { key: "age",          label: "Age",          type: "number", width: 65 },
  { key: "address",      label: "Address",      type: "text",   width: 200 },
  { key: "metAt",        label: "Met At",       type: "text",   width: 130 },
  { key: "cgId",         label: "CG",           type: "cg",     width: 140 },
  { key: "assignedTo",   label: "Assigned To",  type: "user",   width: 140 },
  { key: "gospelShared", label: "Gospel",       type: "bool",   width: 65 },
  { key: "prayed",       label: "Prayed",       type: "bool",   width: 65 },
  { key: "saved",        label: "Saved",        type: "bool",   width: 65 },
];

let _uid = 0;
const blankRow = () => ({
  _isNew: true,
  _key: ++_uid,
  name: "", contactType: "", contact: "", source: "",
  age: null, address: "", metAt: "", cgId: "", assignedTo: "",
  gospelShared: false, prayed: false, saved: false,
  roles: ["Contact"], ministries: [], milestones: {},
});

export default function BulkEdit() {
  const { loading: authLoading, profile, user } = useRequireAuth();
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(new Set());      // indices of rows with any change
  const [errors, setErrors] = useState(new Set());    // indices failing validation
  const [cgs, setCgs] = useState([]);
  const [users, setUsers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [focusedCell, setFocusedCell] = useState(null);
  const [addCount, setAddCount] = useState(5);

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

  const markDirty = useCallback((ri) => {
    setDirty((prev) => new Set([...prev, ri]));
    setErrors((prev) => { const n = new Set(prev); n.delete(ri); return n; });
  }, []);

  const updateCell = useCallback((ri, key, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[ri] = { ...next[ri], [key]: value };
      return next;
    });
    markDirty(ri);
  }, [markDirty]);

  const handleAddRows = () => {
    const count = Math.min(100, Math.max(1, addCount || 1));
    setRows((prev) => [...prev, ...Array.from({ length: count }, blankRow)]);
  };

  // Global paste — multi-row from Google Sheets
  useEffect(() => {
    const onPaste = (e) => {
      if (focusedCell === null) return;
      const text = e.clipboardData.getData("text/plain");
      const pasteRows = text.split(/\r?\n/).filter((r) => r !== "");
      if (pasteRows.length <= 1 && !pasteRows[0]?.includes("\t")) return;
      e.preventDefault();

      const { row: startRow, col: startCol } = focusedCell;
      setRows((prev) => {
        const next = [...prev];
        const newDirty = new Set();
        pasteRows.forEach((pasteRow, ri) => {
          const rowIndex = startRow + ri;
          if (rowIndex >= next.length) return;
          const cells = pasteRow.split("\t");
          const updated = { ...next[rowIndex] };
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
              const m = cgs.find((c) => c.name.toLowerCase() === val.toLowerCase());
              val = m ? m.id : "";
            } else if (col.type === "user") {
              const m = users.find((u) => u.name.toLowerCase() === val.toLowerCase());
              val = m ? m.id : "";
            }
            updated[col.key] = val;
          });
          next[rowIndex] = updated;
          newDirty.add(rowIndex);
        });
        setDirty((prev) => new Set([...prev, ...newDirty]));
        setErrors((prev) => {
          const n = new Set(prev);
          newDirty.forEach((i) => n.delete(i));
          return n;
        });
        return next;
      });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [focusedCell, cgs, users]);

  const handleSaveAll = async () => {
    // Validate: any row that's dirty or new-with-content must have name + contact
    const newErrors = new Set();
    rows.forEach((row, i) => {
      const hasContent = row._isNew
        ? row.name?.trim() || row.contact?.trim()
        : dirty.has(i);
      if (!hasContent) return;
      if (!row.name?.trim()) newErrors.add(i);
      if (!row.contact?.trim()) newErrors.add(i);
    });
    if (newErrors.size > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const ops = rows.map((row, i) => {
        if (row._isNew && row.name?.trim() && row.contact?.trim()) {
          const { _isNew, _key, ...data } = row;
          return addPerson({
            ...data,
            assignedTo: user.uid,
            assignedToName: profile?.name || "",
            teamId: profile?.teamId || "",
          });
        }
        if (!row._isNew && dirty.has(i)) {
          return updatePerson(row.id, row);
        }
        return null;
      }).filter(Boolean);

      await Promise.all(ops);

      // Refresh from Firestore to get real IDs on new rows
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

  if (authLoading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200 shrink-0 shadow-sm">
        <button
          onClick={() => router.push("/people")}
          className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <FiArrowLeft size={16} />
        </button>

        <h1 className="font-bold text-gray-900 text-base">Bulk Edit</h1>
        <span className="text-xs text-gray-400 font-medium">{rows.filter((r) => !r._isNew).length} people</span>

        <div className="flex-1" />

        {/* Add rows */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Add rows:</span>
          <input
            type="number"
            min={1}
            max={100}
            value={addCount}
            onChange={(e) => setAddCount(parseInt(e.target.value) || 1)}
            className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:border-blue-400 bg-gray-50"
          />
          <button
            onClick={handleAddRows}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
          >
            <FiPlus size={14} /> Add
          </button>
        </div>

        {/* Feedback */}
        {saveError && <span className="text-sm text-red-500 font-medium">{saveError}</span>}
        {errors.size > 0 && !saveError && (
          <span className="text-sm text-red-500 font-medium">{errors.size} row{errors.size > 1 ? "s" : ""} missing Name or Contact</span>
        )}
        {savedMsg && <span className="text-sm text-emerald-600 font-semibold">Saved!</span>}

        <button
          onClick={handleSaveAll}
          disabled={saving || totalChanges === 0}
          className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {saving ? "Saving…" : totalChanges > 0 ? `Save (${totalChanges})` : "Save"}
        </button>
      </div>

      {/* ── Hint bar ── */}
      <div className="px-5 py-1.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 shrink-0 flex gap-4">
        <span>Click a cell → paste from Google Sheets to bulk fill.</span>
        <span><span className="font-semibold text-amber-600">Amber</span> = edited</span>
        <span><span className="font-semibold text-green-600">Green</span> = new row</span>
        <span><span className="font-semibold text-red-500">Red</span> = missing required field</span>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="text-sm border-collapse" style={{ minWidth: COLUMNS.reduce((a, c) => a + c.width, 0) + 48, width: "100%" }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="w-12 px-2 py-2.5 text-xs font-semibold text-gray-400 border-r border-gray-300 text-center sticky left-0 bg-gray-100 z-20">#</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 border-r border-gray-200 whitespace-nowrap"
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
                <td colSpan={COLUMNS.length + 1} className="text-center text-gray-400 py-20 text-sm">
                  No people yet — use &ldquo;Add rows&rdquo; to create new entries.
                </td>
              </tr>
            )}
            {rows.map((row, ri) => {
              const isNew = row._isNew;
              const isDirty = dirty.has(ri) && !isNew;
              const hasError = errors.has(ri);
              const rowCls = hasError
                ? "bg-red-50"
                : isNew
                  ? "bg-green-50"
                  : isDirty
                    ? "bg-amber-50"
                    : "bg-white hover:bg-gray-50";

              return (
                <tr key={row.id || row._key} className={`border-b border-gray-100 ${rowCls}`}>
                  <td className={`px-2 py-0 text-xs text-gray-400 border-r border-gray-200 text-center w-12 sticky left-0 z-10 ${hasError ? "bg-red-50" : isNew ? "bg-green-50" : isDirty ? "bg-amber-50" : "bg-white"}`}>
                    {ri + 1}
                  </td>
                  {COLUMNS.map((col, ci) => {
                    const isFocused = focusedCell?.row === ri && focusedCell?.col === ci;
                    const isErrCell = hasError && col.required;
                    return (
                      <td
                        key={col.key}
                        className={`border-r border-gray-100 p-0 ${isFocused ? "ring-2 ring-inset ring-blue-400" : ""} ${isErrCell && !isFocused ? "ring-1 ring-inset ring-red-300" : ""}`}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellCls = "w-full h-full px-3 py-2 bg-transparent outline-none text-gray-900 text-sm leading-tight";

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
