"use client";

import { FiArchive, FiCheck, FiChevronDown, FiEdit3 } from "react-icons/fi";
import { ROLE_STYLES } from "@/config/app";
import ContactActions from "@/components/ContactActions";

export default function FollowUpCard({
  person,
  badge,
  badgeColor,
  onNavigate,
  onCheck,
  onArchive,
  acting,
  checkLabel,
  showRoles = false,
  expanded = false,
  onToggle,
  draft,
  onDraftChange,
  onSaveLog,
}) {
  const isChecking = acting === "checking";
  const isArchiving = acting === "archiving";
  const isLogging = acting === "logging";
  const busy = !!acting;

  const setDraft = (k, v) => onDraftChange?.({ ...draft, [k]: v });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
          <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
          {(person.contactType || person.contact) && (
            <p className="text-xs text-gray-600 truncate flex items-center gap-1.5">
              <span className="truncate">
                {person.contactType ? `${person.contactType} - ${person.contact}` : person.contact}
              </span>
              <ContactActions contactType={person.contactType} contact={person.contact} size={12} />
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {showRoles && (person.roles || []).map((r) => (
              <span key={r} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${ROLE_STYLES[r] || "bg-gray-100 text-gray-700"}`}>
                {r}
              </span>
            ))}
            <span className={`text-[10px] font-semibold ${badgeColor}`}>{badge}</span>
            {person.followUpDays && (
              <span className="text-[10px] text-gray-500">· every {person.followUpDays}d</span>
            )}
          </div>
          {person.followUpRemarks && !expanded && (
            <p className="mt-1.5 pl-2 border-l-2 border-amber-400 text-xs text-amber-900 italic whitespace-pre-wrap break-words">
              {person.followUpRemarks}
            </p>
          )}
        </div>

        {onToggle && (
          <button
            onClick={onToggle}
            disabled={busy}
            title="Log follow-up"
            className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
              expanded
                ? "border-blue-200 bg-blue-50 text-blue-600"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
            }`}
          >
            <FiEdit3 size={11} />
            <span className="text-[10px] font-semibold">Log</span>
            <FiChevronDown size={11} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}

        {onArchive && (
          <button
            onClick={() => onArchive(person)}
            disabled={busy}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            {isArchiving
              ? <span className="w-3 h-3 rounded-full border border-red-400 border-t-transparent animate-spin" />
              : <FiArchive size={11} className="text-red-500" />}
            <span className="text-[10px] font-semibold text-red-500">Archive</span>
          </button>
        )}

        <button
          onClick={() => onCheck(person)}
          disabled={busy}
          title={checkLabel || "Mark as followed up"}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 ${
            isChecking ? "bg-emerald-500 border-emerald-500" : "border-gray-300 hover:border-emerald-400"
          }`}
        >
          {isChecking && <FiCheck size={11} className="text-white" />}
        </button>
      </div>

      {expanded && draft && (
        <div className="border-t border-gray-100 px-3 py-3 space-y-3 bg-gray-50/60 rounded-b-xl">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-700">Follow-up remarks</label>
            <textarea
              value={draft.followUpRemarks}
              onChange={(e) => setDraft("followUpRemarks", e.target.value)}
              rows={3}
              placeholder="What to talk about next time…"
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 min-w-0 space-y-1">
              <label className="text-[11px] font-semibold text-gray-700">Next follow-up</label>
              <input
                type="date"
                value={draft.scheduledFollowUpAt}
                onChange={(e) => setDraft("scheduledFollowUpAt", e.target.value)}
                className="w-full min-w-0 bg-white border border-gray-200 rounded-xl px-2.5 py-2 text-xs text-gray-900 outline-none focus:border-blue-500"
              />
            </div>
            <div className="w-24 shrink-0 space-y-1">
              <label className="text-[11px] font-semibold text-gray-700">Every (days)</label>
              <input
                type="number"
                min="1"
                value={draft.followUpDays}
                onChange={(e) => setDraft("followUpDays", e.target.value)}
                placeholder="None"
                className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-2 text-xs text-gray-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onSaveLog(person, draft, false)}
              disabled={busy}
              className="flex-1 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              Save only
            </button>
            <button
              onClick={() => onSaveLog(person, draft, true)}
              disabled={busy}
              className="flex-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {isLogging
                ? <span className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
                : <FiCheck size={12} />}
              Save &amp; mark followed up
            </button>
          </div>

          <button
            onClick={onNavigate}
            className="w-full text-[11px] text-gray-400 hover:text-gray-600 font-semibold"
          >
            Open full profile →
          </button>
        </div>
      )}
    </div>
  );
}
