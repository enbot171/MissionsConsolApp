"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPeopleByAssignee } from "@/lib/firestore";
import { countDue } from "@/lib/followUps";

const FollowUpCountContext = createContext({ count: 0, refresh: () => {} });

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

  const count = user ? countDue(people, profile) : 0;

  return (
    <FollowUpCountContext.Provider value={{ count, refresh }}>
      {children}
    </FollowUpCountContext.Provider>
  );
}

export const useFollowUpCount = () => useContext(FollowUpCountContext);
