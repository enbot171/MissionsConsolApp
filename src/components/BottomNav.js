"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FiHome, FiPlus, FiUsers, FiLayers, FiBell, FiClock, FiCalendar, FiClipboard, FiFileText, FiZap, FiMoreHorizontal, FiSettings, FiStar } from "react-icons/fi";
import { useFollowUpCount } from "@/context/FollowUpCountContext";
import { confirmLeave } from "@/hooks/useLeaveGuard";

// The five slots go to what gets touched daily. Everything else is reference
// material and lives one tap deeper, behind More.
const tabs = [
  { path: "/",            icon: FiHome,  label: "Home" },
  { path: "/people",      icon: FiUsers, label: "People" },
  { path: "/add-contact", icon: FiPlus,  label: null, fab: true },
  { path: "/meetings",    icon: FiClock, label: "Meetings" },
];

const moreItems = [
  { path: "/follow-ups", icon: FiBell,       label: "Follow-ups", badge: true },
  { path: "/groups",     icon: FiLayers, label: "Groups" },
  { path: "/events",     icon: FiStar,   label: "Events" },
  { path: "/calendar",   icon: FiCalendar,   label: "Calendar" },
  { path: "/summary",    icon: FiClipboard,  label: "Summary" },
  { path: "/report",     icon: FiFileText,  label: "Weekly report" },
  { path: "/testimonies", icon: FiZap,      label: "Testimonies" },
  { path: "/settings",   icon: FiSettings,   label: "Settings" },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { count } = useFollowUpCount();
  const [sheet, setSheet] = useState(false);

  const isActive = (path) => path === "/" ? pathname === "/" : pathname.startsWith(path);
  const moreActive = moreItems.some((i) => isActive(i.path));

  // A page with unsaved edits gets to ask before the menu takes you away.
  const go = (path) => { if (!confirmLeave()) return; setSheet(false); router.push(path); };

  const badgeText = count > 99 ? "99+" : count;
  const tabClass = (active) =>
    `relative flex h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] text-[11.5px] transition-colors ${
      active ? "bg-brand-soft font-semibold text-brand" : "font-medium text-muted"
    }`;

  return (
    <>
      {sheet && (
        <div className="fixed inset-0 z-60 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 h-full w-full bg-navy/45"
            onClick={() => setSheet(false)}
          />
          <div role="dialog" aria-modal="true" aria-label="More" className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white px-5 pb-8 pt-2.5 shadow-float">
            <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map(({ path, icon: Icon, label, badge }) => {
                const active = isActive(path);
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => go(path)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 text-left transition-colors ${
                      active ? "bg-brand-soft text-brand" : "bg-tint text-ink active:bg-fill"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white" : "bg-white text-ink-2"}`}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
                    {badge && count > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warn px-1.5 text-[11px] font-bold text-white">
                        {badgeText}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav aria-label="Main" className="fixed inset-x-4 bottom-5 z-50 mx-auto flex max-w-md items-center gap-1 rounded-3xl bg-white p-1.5 shadow-float md:hidden">
        {tabs.map(({ path, icon: Icon, label, fab }) => {
          const active = isActive(path);

          if (fab) {
            return (
              <button
                key={path}
                type="button"
                onClick={() => go(path)}
                aria-label="Add contact"
                className="flex h-13 w-13 shrink-0 items-center justify-center rounded-[18px] bg-brand text-white shadow-brand transition-transform active:scale-95"
              >
                <Icon size={24} strokeWidth={2.3} />
              </button>
            );
          }

          return (
            <button
              key={path}
              type="button"
              onClick={() => go(path)}
              aria-current={active ? "page" : undefined}
              className={tabClass(active)}
            >
              <Icon size={20} />
              {label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSheet(true)}
          aria-haspopup="dialog"
          aria-expanded={sheet}
          className={tabClass(moreActive)}
        >
          <FiMoreHorizontal size={20} />
          More
          {/* Follow-ups lives in the sheet, so its count is surfaced here:
              overdue work stays visible without opening it. */}
          {count > 0 && (
            <span
              aria-label={`${count} follow-ups due`}
              className="absolute right-3 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-warn px-1 text-[11px] font-bold text-white"
            >
              {badgeText}
            </span>
          )}
        </button>
      </nav>
    </>
  );
}
