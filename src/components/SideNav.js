"use client";

import { useRouter, usePathname } from "next/navigation";
import { FaHome, FaPlus, FaUsers, FaLayerGroup } from "react-icons/fa";
import { HiMenu } from "react-icons/hi";

const tabs = [
  { path: "/",        icon: FaHome,       label: "Home" },
  { path: "/people",  icon: FaUsers,      label: "People" },
  { path: "/groups",  icon: FaLayerGroup, label: "Groups" },
  { path: "/settings",icon: HiMenu,       label: "Settings" },
];

export default function SideNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-gray-200 flex-col z-50">
      {/* Branding */}
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="font-bold text-gray-900 text-base leading-tight">Missions</p>
        <p className="text-xs text-gray-400 font-medium">Consol App</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = path === "/" ? pathname === "/" : pathname.startsWith(path);
          return (
            <button
              key={path}
              onClick={() => router.push(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                active
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Add Contact CTA */}
      <div className="px-3 pb-6">
        <button
          onClick={() => router.push("/add-contact")}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <FaPlus size={13} /> Add Contact
        </button>
      </div>
    </aside>
  );
}
