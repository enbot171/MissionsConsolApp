"use client";

import { FiSearch } from "react-icons/fi";

// `className` replaces the size, radius and outer spacing, so a page can fit
// the box into a heading row; everything else about the look stays put.
export default function SearchBar({ value, onChange, placeholder = "Search by name...", className = "mb-4 h-12 rounded-2xl" }) {
  return (
    <label className={`flex items-center gap-2 bg-fill px-3.5 text-muted focus-within:ring-2 focus-within:ring-brand ${className}`}>
      <FiSearch className="shrink-0" size={18} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
      />
    </label>
  );
}
