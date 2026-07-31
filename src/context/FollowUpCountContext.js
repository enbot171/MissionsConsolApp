"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPeopleByAssignee } from "@/lib/firestore";
import { countDue } from "@/lib/followUps";

const FollowUpCountContext = createContext({ count: 0, refresh: () => {}, applyPatch: () => {} });

// The nav badge needs a number on every page, but the overdue rules are
// client-side (they depend on the user's own thresholds), so there's no cheap
// server count. Fetch once per session here instead of once per page.
export function FollowUpCountProvider({ children }) {
  const { user, profile } = useAuth();
  const [people, setPeople] = useState([]);

  const refresh = useCallback(() => {
    if (!user) return;
    getPeopleByAssignee(user.uid).then(setPeople).catch(() => {});
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Logging a follow-up used to re-read every person assigned to the user just
  // to move this number. The caller already knows exactly what changed, so
  // apply it locally instead — a full collection read per tick was the single
  // most expensive thing the badge did.
  const applyPatch = useCallback((id, patch) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const count = user ? countDue(people, profile) : 0;

  return (
    <FollowUpCountContext.Provider value={{ count, refresh, applyPatch }}>
      {children}
    </FollowUpCountContext.Provider>
  );
}

export const useFollowUpCount = () => useContext(FollowUpCountContext);
