"use client";

import { useRouter, usePathname } from "next/navigation";
import { FiHome, FiSettings, FiUsers } from "react-icons/fi";
import { HiOutlineUserGroup } from "react-icons/hi";

export const adminTabs = [
  { path: "/admin", icon: FiHome, label: "Home" },
  { path: "/admin/users", icon: FiUsers, label: "Users" },
  { path: "/admin/teams", icon: HiOutlineUserGroup, label: "Teams" },
];

// "Add user" sits under Users, so sub-pages keep their parent tab lit.
export const isAdminTabActive = (pathname, path) =>
  path === "/admin" ? pathname === "/admin" : pathname.startsWith(path);

export default function AdminBottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="fixed inset-x-4 bottom-5 z-50 mx-auto flex max-w-md items-center gap-1 rounded-3xl bg-white p-1.5 shadow-float md:hidden">
      {adminTabs.map(({ path, icon: Icon, label }) => {
        const active = isAdminTabActive(pathname, path);
        return (
          <button
            key={path}
            type="button"
            onClick={() => router.push(path)}
            aria-current={active ? "page" : undefined}
            className={`flex h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] text-[11.5px] transition-colors ${
              active ? "bg-brand-soft font-semibold text-brand" : "font-medium text-muted"
            }`}
          >
            <Icon size={20} />
            {label}
          </button>
        );
      })}
      {/* Settings holds the account details and Sign out. */}
      <button
        type="button"
        onClick={() => router.push("/settings")}
        className="flex h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] text-[11.5px] font-medium text-muted transition-colors"
      >
        <FiSettings size={20} />
        Settings
      </button>
    </nav>
  );
}
