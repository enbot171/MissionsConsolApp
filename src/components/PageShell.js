"use client";

import BottomNav from "./BottomNav";
import { useRouter } from "next/navigation";
import { FiChevronLeft } from "react-icons/fi";

export default function PageShell({ title, rightAction, children, backHref }) {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            {backHref && (
              <button
                onClick={() => router.push(backHref)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-1"
              >
                <FiChevronLeft size={20} className="text-gray-600" />
              </button>
            )}
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h1>
          </div>
          {rightAction && <div className="flex items-center gap-3">{rightAction}</div>}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 mt-14 pb-24 overflow-y-auto">
        <div className="px-4 py-4 max-w-lg mx-auto">{children}</div>
      </main>

      <BottomNav />
    </div>
  );
}
