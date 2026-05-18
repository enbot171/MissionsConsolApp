"use client";

import AdminBottomNav from "./AdminBottomNav";
import { useRouter } from "next/navigation";
import { FiChevronLeft } from "react-icons/fi";

export default function AdminPageShell({ title, children, backHref }) {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="fixed top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
        <div className="flex items-center px-4 h-14 gap-2">
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
      </div>

      <main className="flex-1 mt-14 pb-24 overflow-y-auto">
        <div className="px-4 py-4 max-w-lg mx-auto">{children}</div>
      </main>

      <AdminBottomNav />
    </div>
  );
}
