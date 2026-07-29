"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FaHome, FaPlus, FaUsers, FaLayerGroup } from "react-icons/fa";
import { FiBell, FiClock, FiCalendar, FiClipboard, FiMoreHorizontal, FiSettings } from "react-icons/fi";
import { useFollowUpCount } from "@/context/FollowUpCountContext";

// The five slots go to what gets touched daily. Everything else is reference
// material and lives one tap deeper, behind More.
const tabs = [
  { path: "/",            icon: FaHome,  label: "Home" },
  { path: "/people",      icon: FaUsers, label: "People" },
  { path: "/add-contact", icon: FaPlus,  label: null, fab: true },
  { path: "/meetings",    icon: FiClock, label: "Meetings" },
];

const moreItems = [
  { path: "/follow-ups", icon: FiBell,       label: "Follow-ups", badge: true },
  { path: "/groups",     icon: FaLayerGroup, label: "Groups" },
  { path: "/calendar",   icon: FiCalendar,   label: "Calendar" },
  { path: "/summary",    icon: FiClipboard,  label: "Summary" },
  { path: "/settings",   icon: FiSettings,   label: "Settings" },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { count } = useFollowUpCount();
  const [sheet, setSheet] = useState(false);

  const isActive = (path) => path === "/" ? pathname === "/" : pathname.startsWith(path);
  const moreActive = moreItems.some((i) => isActive(i.path));

  const go = (path) => { setSheet(false); router.push(path); };

  return (
    <>
      {sheet && (
        <div className="fixed inset-0 z-60 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-xl pb-8 pt-3 px-4">
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map(({ path, icon: Icon, label, badge }) => {
                const active = isActive(path);
                return (
                  <button
                    key={path}
                    onClick={() => go(path)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl border transition-colors ${
                      active
                        ? "bg-blue-50 border-blue-200 text-blue-600"
                        : "bg-white border-gray-100 text-gray-700 active:bg-gray-50"
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${active ? "bg-blue-100" : "bg-gray-50"}`}>
                      <Icon size={15} />
                    </span>
                    <span className="text-sm font-semibold">{label}</span>
                    {badge && count > 0 && (
                      <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden">
        <div className="flex items-end justify-around px-2 pb-2 pt-1 max-w-lg mx-auto">
          {tabs.map(({ path, icon: Icon, label, fab }) => {
            const active = isActive(path);

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
                className="relative flex flex-col items-center gap-1 py-2 px-2 rounded-xl transition-colors"
              >
                <Icon size={22} className={active ? "text-blue-600" : "text-gray-600"} />
                <span className={`text-[10px] font-semibold whitespace-nowrap ${active ? "text-blue-600" : "text-gray-600"}`}>
                  {label}
                </span>
                <span className={`w-1 h-1 rounded-full transition-all ${active ? "bg-blue-600" : "bg-transparent"}`} />
              </button>
            );
          })}

          <button
            onClick={() => setSheet(true)}
            className="relative flex flex-col items-center gap-1 py-2 px-2 rounded-xl transition-colors"
          >
            <FiMoreHorizontal size={22} className={moreActive ? "text-blue-600" : "text-gray-600"} />
            {/* Follow-ups lives in the sheet now — surface its count so overdue
                work is still visible without opening it. */}
            {count > 0 && (
              <span className="absolute top-0.5 right-0 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {count > 99 ? "99+" : count}
              </span>
            )}
            <span className={`text-[10px] font-semibold ${moreActive ? "text-blue-600" : "text-gray-600"}`}>More</span>
            <span className={`w-1 h-1 rounded-full transition-all ${moreActive ? "bg-blue-600" : "bg-transparent"}`} />
          </button>
        </div>
      </div>
    </>
  );
}
