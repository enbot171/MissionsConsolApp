"use client";

import { useRouter } from "next/navigation";
import ContactLine from "@/components/ContactActions";
import { Avatar, RoleTag } from "@/components/ui";

// A flat list row on phones, an outlined card from tablet width up.
export default function PersonCard({ person, onRemove, onSelect, selected, onSchedule }) {
  const router = useRouter();

  const handleClick = () => {
    if (onSelect) { onSelect(person); return; }
    router.push(`/person/${person.id}`);
  };

  const hasTags = (person.roles || []).length > 0 || person._matchedField;

  return (
    <div
      onClick={handleClick}
      className={`-mx-2 flex min-h-16.5 min-w-0 cursor-pointer items-center gap-3 rounded-2xl px-2 py-1 transition-colors md:mx-0 md:rounded-[20px] md:px-4 md:py-3.5 md:ring-1 ${
        selected ? "bg-brand-soft md:ring-brand" : "bg-white hover:bg-tint md:ring-line-soft"
      }`}
    >
      <Avatar name={person.name} className="md:text-[15px]" />

      {/* Tags sit beside the name on phones and under it on cards. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-col md:items-stretch md:gap-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold tracking-[-0.01em] text-ink md:text-[15px]">{person.name}</p>
          <ContactLine contactType={person.contactType} contact={person.contact} className="mt-0.5" />
        </div>
        {hasTags && (
          <div className="flex max-w-[45%] shrink-0 flex-wrap items-center justify-end gap-1 md:max-w-none md:justify-start">
            {(person.roles || []).map((r) => (
              <RoleTag key={r} role={r} className="md:h-[22px] md:px-[9px] md:text-xs" />
            ))}
            {person._matchedField && (
              <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-warn-soft px-2.5 text-[12.5px] font-semibold text-warn-ink md:h-[22px] md:px-2 md:text-xs">
                matched: {person._matchedField}
              </span>
            )}
          </div>
        )}
      </div>

      {onSelect ? (
        <span
          aria-hidden="true"
          className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-[7px] transition-colors ${
            selected ? "bg-brand text-white" : "bg-white ring-[1.5px] ring-inset ring-muted"
          }`}
        >
          {selected && (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
      ) : onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${person.name}`}
          onClick={(e) => { e.stopPropagation(); onRemove(person); }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-fill text-ink transition-colors hover:bg-line-soft"
        >
          <RemoveIcon />
        </button>
      ) : onSchedule ? (
        <button
          type="button"
          aria-label={`Schedule meeting with ${person.name}`}
          title="Schedule meeting"
          onClick={(e) => { e.stopPropagation(); onSchedule(person); }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand transition-colors hover:bg-role-contact"
        >
          <CalendarIcon size={17} />
        </button>
      ) : (
        <FiChevronRight className="hidden shrink-0 text-muted md:block" size={16} />
      )}
    </div>
  );
}

function FiChevronRight({ className, size }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CalendarIcon({ size }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
