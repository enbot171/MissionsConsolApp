"use client";

import { FiArchive, FiCheck, FiExternalLink } from "react-icons/fi";
import { ROLE_STYLES } from "@/config/app";
import { contactLink } from "@/lib/contactLink";

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
}) {
  const isChecking = acting === "checking";
  const isArchiving = acting === "archiving";
  const busy = !!acting;
  const link = contactLink(person.contactType, person.contact);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2.5 flex items-center gap-2.5">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
        <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
        {(person.contactType || person.contact) && (
          <p className="text-xs text-gray-600 truncate flex items-center gap-1.5">
            <span className="truncate">
              {person.contactType ? `${person.contactType} - ${person.contact}` : person.contact}
            </span>
            {link && (
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={`Open ${link.label}`}
                className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded text-blue-600 hover:bg-blue-50"
              >
                <FiExternalLink size={11} />
              </a>
            )}
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
        {person.followUpRemarks && (
          <p className="mt-1.5 pl-2 border-l-2 border-amber-400 text-xs text-amber-900 italic whitespace-pre-wrap break-words">
            {person.followUpRemarks}
          </p>
        )}
      </div>

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
  );
}
