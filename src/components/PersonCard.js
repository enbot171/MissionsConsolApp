"use client";

import { useRouter } from "next/navigation";

const roleStyles = {
  Contact: "bg-blue-50 text-blue-600",
  Disciple: "bg-emerald-50 text-emerald-600",
  CGL: "bg-violet-50 text-violet-600",
  "Core Team": "bg-orange-50 text-orange-600",
};

export default function PersonCard({ person, onRemove, onSelect, selected }) {
  const router = useRouter();

  const handleClick = () => {
    if (onSelect) { onSelect(person); return; }
    router.push(`/person/${person.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform ${
        selected ? "border-blue-400 bg-blue-50" : "border-gray-100"
      }`}
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

      {onSelect ? (
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          selected ? "bg-blue-500 border-blue-500" : "border-gray-300"
        }`}>
          {selected && (
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      ) : onRemove ? (
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
