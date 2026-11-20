"use client";

import { FaInstagram, FaLine } from "react-icons/fa";
import { FiGlobe, FiMessageCircle } from "react-icons/fi";
import { contactLink } from "@/lib/contactLink";

// One look per contact type, so the app is recognisable at a glance.
const TYPES = {
  InstagramID: { label: "Instagram", Icon: FaInstagram, tone: "bg-tint-rose text-tint-rose-ink" },
  LineID: { label: "LINE", Icon: FaLine, tone: "bg-ok-soft text-ok-ink" },
  HellotalkID: { label: "HelloTalk", Icon: FiGlobe, tone: "bg-tint-teal text-tint-teal-ink" },
};
const OTHER = { label: "Other", Icon: FiMessageCircle, tone: "bg-fill text-ink-2" };

export function ContactTypeTag({ contactType, className = "" }) {
  if (!contactType) return null;
  const { label, Icon, tone } = TYPES[contactType] || OTHER;
  return (
    <span className={`inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-semibold ${tone} ${className}`}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * The handle itself. Instagram handles are an underlined link to the profile;
 * everything else is plain text. Rows are often clickable as a whole, so the
 * link stops the click from also opening the row.
 */
export function ContactHandle({ contactType, contact, className = "" }) {
  if (!contact) return null;
  const link = contactLink(contactType, contact);
  if (!link) return <span className={`truncate ${className}`}>{contact}</span>;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Open @${link.handle} on Instagram`}
      className={`truncate underline decoration-1 underline-offset-2 hover:text-brand ${className}`}
    >
      {contact}
    </a>
  );
}

/** Type tag followed by the handle, on one line. `children` trail the handle. */
export default function ContactLine({ contactType, contact, className = "", children }) {
  if (!contactType && !contact) return null;
  return (
    <span className={`flex min-w-0 items-center gap-1.5 text-[13px] text-muted ${className}`}>
      <ContactTypeTag contactType={contactType} />
      <ContactHandle contactType={contactType} contact={contact} />
      {children}
    </span>
  );
}
