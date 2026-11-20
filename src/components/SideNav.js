"use client";

import { useRouter, usePathname } from "next/navigation";
import { FiHome, FiPlus, FiUsers, FiLayers, FiHeart, FiChevronLeft, FiChevronRight, FiClipboard, FiCalendar, FiBell, FiClock, FiFileText, FiZap, FiSliders } from "react-icons/fi";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useFollowUpCount } from "@/context/FollowUpCountContext";

const tabs = [
  { path: "/",            icon: FiHome,       label: "Home" },
  { path: "/people",      icon: FiUsers,      label: "People" },
  { path: "/groups",      icon: FiLayers,     label: "Groups" },
  { path: "/summary",     icon: FiClipboard,  label: "Summary" },
  { path: "/calendar",    icon: FiCalendar,   label: "Calendar" },
  { path: "/meetings",    icon: FiClock,      label: "Meetings" },
  { path: "/follow-ups",  icon: FiBell,       label: "Follow-ups", badge: true },
  { path: "/report",      icon: FiFileText,   label: "Weekly report" },
  { path: "/testimonies", icon: FiZap,        label: "Testimonies" },
  // Settings sits at the foot of the menu, just above the account chip.
  { path: "/settings",    icon: FiSliders,    label: "Settings", low: true },
];

export default function SideNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const { profile } = useAuth();
  const { count } = useFollowUpCount();

  const name = profile?.name || "Account";
  const badgeText = count > 99 ? "99+" : count;

  return (
    <aside
      className={`fixed bottom-0 left-0 top-0 z-50 hidden flex-col gap-4 bg-navy px-3.5 pb-3.5 pt-5 text-white transition-[width] duration-200 md:flex ${
        collapsed ? "w-16 px-2.5" : "w-60"
      }`}
    >
      <div className={`flex items-center gap-2.5 ${collapsed ? "flex-col" : "px-0.5"}`}>
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-light text-navy">
          <FiHeart size={17} strokeWidth={2.2} />
        </span>
        {!collapsed && <p className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.02em]">Missions Consol App</p>}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          className="absolute -right-3 top-6 flex h-6 w-6 items-center justify-center rounded-full bg-white text-navy shadow-card transition-colors hover:bg-brand-soft"
        >
          {collapsed ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push("/add-contact")}
        aria-label={collapsed ? "Add contact" : undefined}
        title={collapsed ? "Add contact" : undefined}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-white font-semibold text-navy transition-colors hover:bg-brand-soft"
      >
        <FiPlus size={18} strokeWidth={2.4} className="shrink-0" />
        {!collapsed && <span>Add contact</span>}
      </button>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {tabs.map(({ path, icon: Icon, label, badge, low }) => {
          const active = path === "/" ? pathname === "/" : pathname.startsWith(path);
          const showBadge = badge && count > 0;
          return (
            <button
              key={path}
              type="button"
              onClick={() => router.push(path)}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              className={`relative flex h-11 w-full shrink-0 items-center rounded-[14px] transition-colors ${
                collapsed ? "justify-center" : "gap-3 px-3"
              } ${low ? "mt-auto" : ""} ${active ? "bg-white/[0.13] font-semibold text-white" : "font-medium text-nav-muted hover:bg-white/[0.07] hover:text-white"}`}
            >
              <Icon size={19} strokeWidth={1.9} className="shrink-0" />
              {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
              {showBadge && !collapsed && (
                <span
                  aria-label={`${count} follow-ups due`}
                  className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand-light px-1.5 text-xs font-bold text-navy"
                >
                  {badgeText}
                </span>
              )}
              {showBadge && collapsed && (
                <span aria-label={`${count} follow-ups due`} className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand-light" />
              )}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => router.push("/settings")}
        aria-label={collapsed ? `${name}, settings` : undefined}
        title={collapsed ? name : undefined}
        className={`flex items-center gap-2.5 rounded-2xl bg-white/[0.08] text-left transition-colors hover:bg-white/[0.13] ${
          collapsed ? "justify-center p-1.5" : "p-2.5"
        }`}
      >
        <span aria-hidden="true" className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/[0.16] text-[13px] font-semibold">
          {name.trim()[0]?.toUpperCase() || "?"}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block truncate text-[12.5px] text-nav-muted">{profile?.role || "Member"}</span>
          </span>
        )}
        {!collapsed && <FiChevronRight size={16} className="shrink-0" aria-hidden="true" />}
      </button>
    </aside>
  );
}
