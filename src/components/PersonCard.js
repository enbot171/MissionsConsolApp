"use client";

import { useRouter } from "next/navigation";

const roleStyles = {
  Contact: "bg-blue-50 text-blue-600",
  Disciple: "bg-emerald-50 text-emerald-600",
  CGL: "bg-violet-50 text-violet-600",
  "Core Team": "bg-orange-50 text-orange-600",
};

export default function PersonCard({ person, onRemove }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/person/${person.id}`)}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
    >
      {/* Avatar */}
      <div className="w-11 h-11 rounded-xl bg-linear-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm">
        <span className="text-white font-bold text-base">
          {person.name?.charAt(0).toUpperCase() || "?"}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{person.name}</p>
        <p className="text-sm text-gray-600 truncate">
          {person.contactType && <span className="text-gray-700">{person.contactType} · </span>}
          {person.contact}
        </p>
        {(person.roles || []).length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {(person.roles || []).map((r) => (
              <span key={r} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${roleStyles[r] || "bg-gray-100 text-gray-700"}`}>
                {r}
              </span>
            ))}
          </div>
        )}
      </div>

      {onRemove ? (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(person); }}
          className="w-7 h-7 rounded-full bg-red-50 text-red-400 flex items-center justify-center shrink-0 hover:bg-red-100 transition-colors"
        >
          <RemoveIcon />
        </button>
      ) : (
        <FiChevronRight className="text-gray-500 shrink-0" size={18} />
      )}
    </div>
  );
}

function FiChevronRight({ className, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
