"use client";

import { FaInstagram } from "react-icons/fa";
import { contactLink } from "@/lib/contactLink";

/**
 * Renders a quick link to a person's contact handle.
 * For InstagramID: opens their Instagram profile.
 * Renders nothing when the contact isn't linkable.
 */
export default function ContactActions({ contactType, contact, size = 12, className = "" }) {
  const link = contactLink(contactType, contact);
  if (!link) return null;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Open @${link.handle} on Instagram`}
      className={`shrink-0 inline-flex items-center justify-center rounded p-0.5 text-pink-600 hover:bg-pink-50 transition-colors ${className}`}
    >
      <FaInstagram size={size} />
    </a>
  );
}
