"use client";

import { useState, useCallback } from "react";
import { updatePerson } from "@/lib/firestore";
import { serverTimestamp, Timestamp } from "firebase/firestore";
import { useFollowUpCount } from "@/context/FollowUpCountContext";

export function toDateInput(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function draftFromPerson(p) {
  return {
    followUpRemarks: p.followUpRemarks || "",
    followUpDays: p.followUpDays ?? "",
    scheduledFollowUpAt: toDateInput(p.scheduledFollowUpAt),
  };
}

/**
 * Inline follow-up logging, shared by the dashboard and the follow-ups page.
 * `patchPerson(id, patch)` lets each page update its own copy of the list.
 */
export function useFollowUpLog(patchPerson) {
  const { refresh } = useFollowUpCount();
  const [acting, setActing] = useState({});
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null);

  const setAct = useCallback((id, val) => setActing((prev) => ({ ...prev, [id]: val })), []);
  const clearAct = useCallback((id) => setActing((prev) => {
    const n = { ...prev }; delete n[id]; return n;
  }), []);

  const toggleLog = useCallback((person) => {
    setOpenId((cur) => {
      if (cur === person.id) { setDraft(null); return null; }
      setDraft(draftFromPerson(person));
      return person.id;
    });
  }, []);

  const check = useCallback(async (person) => {
    setAct(person.id, "checking");
    await updatePerson(person.id, {
      lastFollowedUpAt: serverTimestamp(),
      ...(person.scheduledFollowUpAt ? { scheduledFollowUpAt: null } : {}),
    });
    patchPerson(person.id, { lastFollowedUpAt: { toDate: () => new Date() }, scheduledFollowUpAt: null });
    clearAct(person.id);
    refresh();
  }, [patchPerson, setAct, clearAct, refresh]);

  // Writes only the follow-up fields — never the whole person doc, so a stale
  // draft can't clobber edits made on the person page.
  const saveLog = useCallback(async (person, d, alsoCheck) => {
    setAct(person.id, alsoCheck ? "logging" : "saving");
    // Parse as local midnight; `new Date("YYYY-MM-DD")` would parse as UTC.
    const [y, m, day] = d.scheduledFollowUpAt ? d.scheduledFollowUpAt.split("-").map(Number) : [];
    const nextDate = d.scheduledFollowUpAt ? new Date(y, m - 1, day) : null;
    const days = d.followUpDays === "" ? null : parseInt(d.followUpDays) || null;

    await updatePerson(person.id, {
      followUpRemarks: d.followUpRemarks,
      followUpDays: days,
      scheduledFollowUpAt: nextDate ? Timestamp.fromDate(nextDate) : null,
      ...(alsoCheck ? { lastFollowedUpAt: serverTimestamp() } : {}),
    });

    patchPerson(person.id, {
      followUpRemarks: d.followUpRemarks,
      followUpDays: days,
      scheduledFollowUpAt: nextDate,
      ...(alsoCheck ? { lastFollowedUpAt: { toDate: () => new Date() } } : {}),
    });

    clearAct(person.id);
    if (alsoCheck) { setOpenId(null); setDraft(null); }
    refresh();
  }, [patchPerson, setAct, clearAct, refresh]);

  // Props every FollowUpCard needs to support the inline panel.
  const cardProps = useCallback((person) => ({
    acting: acting[person.id],
    expanded: openId === person.id,
    onToggle: () => toggleLog(person),
    draft: openId === person.id ? draft : null,
    onDraftChange: setDraft,
    onSaveLog: saveLog,
    onCheck: check,
  }), [acting, openId, draft, toggleLog, saveLog, check]);

  return { acting, setAct, clearAct, openId, draft, setDraft, toggleLog, check, saveLog, cardProps };
}
