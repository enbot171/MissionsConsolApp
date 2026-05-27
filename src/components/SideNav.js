"use client";

import { useRouter, usePathname } from "next/navigation";
import { FaHome, FaPlus, FaUsers, FaLayerGroup } from "react-icons/fa";
import { HiMenu } from "react-icons/hi";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useSidebar } from "@/context/SidebarContext";

const tabs = [
  { path: "/",        icon: FaHome,       label: "Home" },
  { path: "/people",  icon: FaUsers,      label: "People" },
  { path: "/groups",  icon: FaLayerGroup, label: "Groups" },
  { path: "/settings",icon: HiMenu,       label: "Settings" },
];

export default function SideNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={`hidden md:flex fixed left-0 top-0 bottom-0 bg-white border-r border-gray-200 flex-col z-50 transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Branding + toggle */}
      <div className={`flex items-center border-b border-gray-100 h-14 shrink-0 ${collapsed ? "justify-center px-0" : "px-4 justify-between"}`}>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight truncate">Missions Consol App</p>
          </div>
        )}
        <button
          onClick={toggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0"
        >
          {collapsed ? <FiChevronRight size={16} /> : <FiChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = path === "/" ? pathname === "/" : pathname.startsWith(path);
          return (
            <button
              key={path}
              onClick={() => router.push(path)}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-colors ${
                collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
              } ${active ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Add Contact CTA */}
      <div className="px-2 pb-5">
        <button
          onClick={() => router.push("/add-contact")}
          title={collapsed ? "Add Contact" : undefined}
          className={`w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors`}
        >
          <FaPlus size={13} className="shrink-0" />
          {!collapsed && <span>Add Contact</span>}
        </button>
      </div>
    </aside>
  );
}
