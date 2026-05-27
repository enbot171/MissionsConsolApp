"use client";

import { useRouter, usePathname } from "next/navigation";
import { FaHome, FaPlus, FaUsers, FaLayerGroup } from "react-icons/fa";
import { HiMenu } from "react-icons/hi";

const tabs = [
  { path: "/",           icon: FaHome,       label: "Home" },
  { path: "/people",     icon: FaUsers,      label: "People" },
  { path: "/add-contact",icon: FaPlus,       label: null, fab: true },
  { path: "/groups",     icon: FaLayerGroup, label: "Groups" },
  { path: "/settings",   icon: HiMenu,       label: "Settings" },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden">
      <div className="flex items-end justify-around px-4 pb-2 pt-1 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label, fab }) => {
          const active = path === "/" ? pathname === "/" : pathname.startsWith(path);

          if (fab) {
            return (
              <button
                key={path}
                onClick={() => router.push(path)}
                className="relative -top-4 w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/35 flex items-center justify-center active:scale-95 transition-transform"
              >
                <Icon size={22} className="text-white" />
              </button>
            );
          }

          return (
            <button
              key={path}
              onClick={() => router.push(path)}
              className="flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors"
            >
              <Icon
                size={22}
                className={active ? "text-blue-600" : "text-gray-600"}
              />
              <span className={`text-[10px] font-semibold ${active ? "text-blue-600" : "text-gray-600"}`}>
                {label}
              </span>
              {/* Active dot */}
              <span className={`w-1 h-1 rounded-full transition-all ${active ? "bg-blue-600" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
