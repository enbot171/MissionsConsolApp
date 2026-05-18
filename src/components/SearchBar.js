"use client";

import { FiSearch } from "react-icons/fi";

export default function SearchBar({ value, onChange, placeholder = "Search by name..." }) {
  return (
    <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 shadow-sm mb-4">
      <FiSearch className="text-gray-600 shrink-0" size={16} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-gray-800 text-sm placeholder:text-gray-600"
      />
    </div>
  );
}
