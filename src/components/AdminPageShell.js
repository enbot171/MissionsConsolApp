"use client";

import { useRouter, usePathname } from "next/navigation";
import { FiChevronRight, FiHeart } from "react-icons/fi";
import AdminBottomNav, { adminTabs, isAdminTabActive } from "./AdminBottomNav";
import { BackLink, PageHeading } from "./PageShell";
import { useAuth } from "@/context/AuthContext";

// Admin has its own shorter menu: the team pages make no sense without a team.
function AdminSideNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();
  const name = profile?.name || "Admin";

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-50 hidden w-60 flex-col gap-4 bg-navy px-3.5 pb-3.5 pt-5 text-white md:flex">
      <div className="flex items-center gap-2.5 px-1.5">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-light text-navy">
          <FiHeart size={17} strokeWidth={2.2} />
        </span>
        <p className="min-w-0 flex-1 truncate font-bold tracking-[-0.015em]">Missions Consol App</p>
      </div>

      <nav aria-label="Admin" className="flex flex-1 flex-col gap-0.5">
        {adminTabs.map(({ path, icon: Icon, label }) => {
          const active = isAdminTabActive(pathname, path);
          return (
            <button
              key={path}
              type="button"
              onClick={() => router.push(path)}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 w-full items-center gap-3 rounded-[14px] px-3 transition-colors ${
                active ? "bg-white/[0.13] font-semibold text-white" : "font-medium text-nav-muted hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Settings holds the account details and Sign out. */}
      <button
        type="button"
        onClick={() => router.push("/settings")}
        aria-label={`${name}, settings and sign out`}
        className="flex items-center gap-2.5 rounded-2xl bg-white/[0.08] p-2.5 text-left transition-colors hover:bg-white/[0.13]"
      >
        <span aria-hidden="true" className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/[0.16] text-[13px] font-semibold">
          {name.trim()[0]?.toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="block truncate text-[12.5px] text-nav-muted">Admin</span>
        </span>
        <FiChevronRight size={16} className="shrink-0" aria-hidden="true" />
      </button>
    </aside>
  );
}

export default function AdminPageShell({ title, subtitle, rightAction, children, backHref, backLabel }) {
  return (
    <div className="min-h-screen bg-white">
      <AdminSideNav />

      <div className="md:ml-60">
        <main className="mx-auto max-w-lg px-5 pb-32 pt-4 md:max-w-none md:px-9 md:pb-10 md:pt-6">
          {backHref && <BackLink href={backHref} label={backLabel} />}
          <PageHeading title={title} subtitle={subtitle} rightAction={rightAction} />
          {children}
        </main>
      </div>

      <AdminBottomNav />
    </div>
  );
}
