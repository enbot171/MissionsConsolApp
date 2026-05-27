"use client";

import { createContext, useContext, useState } from "react";

const SidebarContext = createContext({ collapsed: false, toggle: () => {} });

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = () => setCollapsed((v) => !v);
  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
