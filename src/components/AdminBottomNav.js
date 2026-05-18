"use client";

import { useRouter, usePathname } from "next/navigation";
import { FaHome } from "react-icons/fa";
import { FiUsers } from "react-icons/fi";
import { HiOutlineUserGroup } from "react-icons/hi";

const tabs = [
  { path: "/admin", icon: FaHome, label: "Home" },
  { path: "/admin/users", icon: FiUsers, label: "Users" },
  { path: "/admin/teams", icon: HiOutlineUserGroup, label: "Teams" },
];

export default function AdminBottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex items-end justify-around px-4 pb-2 pt-1 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = pathname === path;
          return (
            <button
              key={path}
              onClick={() => router.push(path)}
              className="flex flex-col items-center gap-1 py-2 px-6 rounded-xl transition-colors"
            >
              <Icon size={22} className={active ? "text-blue-600" : "text-gray-600"} />
              <span className={`text-[10px] font-semibold ${active ? "text-blue-600" : "text-gray-600"}`}>
                {label}
              </span>
              <span className={`w-1 h-1 rounded-full transition-all ${active ? "bg-blue-600" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
