"use client";

import Link from "next/link";
import { FiChevronLeft } from "react-icons/fi";
import BottomNav from "./BottomNav";
import SideNav from "./SideNav";
import { BottomBar } from "./ui";
import { useSidebar } from "@/context/SidebarContext";
import { confirmLeave } from "@/hooks/useLeaveGuard";

// The text back link that sits above a page heading.
export function BackLink({ href, label = "Back" }) {
  return (
    <Link
      href={href}
      onClick={(e) => { if (!confirmLeave()) e.preventDefault(); }}
      className="-mt-2 mb-1 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand hover:text-navy"
    >
      <FiChevronLeft size={18} aria-hidden="true" />
      {label}
    </Link>
  );
}

// Title on the left, the page's actions on the right. Shared with the admin shell.
export function PageHeading({ title, subtitle, rightAction }) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 md:mb-6">
      <div className="min-w-0">
        {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink md:text-[32px]">{title}</h1>
      </div>
      {rightAction && <div className="flex flex-wrap items-center gap-2.5">{rightAction}</div>}
    </header>
  );
}

/**
 * Frame for every signed-in page.
 *
 * `bottomBar` is for form pages: on phones it takes the place of the tab bar so
 * the main button stays under the thumb. Give such a page a `backHref` too, or
 * there is no way out of it. `wide` lifts the width limit for grids.
 */
export default function PageShell({ title, subtitle, rightAction, children, backHref, backLabel, bottomBar, wide = false }) {
  const { collapsed } = useSidebar();
  const ml = collapsed ? "md:ml-16" : "md:ml-60";

  return (
    <div className="min-h-screen bg-white">
      <SideNav />

      <div className={`transition-[margin] duration-200 ${ml}`}>
        <main className={`mx-auto px-5 pb-32 pt-4 md:px-9 md:pb-10 md:pt-6 ${wide ? "max-w-none" : "max-w-lg md:max-w-none"}`}>
          {backHref && <BackLink href={backHref} label={backLabel} />}
          <PageHeading title={title} subtitle={subtitle} rightAction={rightAction} />
          {children}
        </main>
      </div>

      {bottomBar ? <BottomBar>{bottomBar}</BottomBar> : <BottomNav />}
    </div>
  );
}
