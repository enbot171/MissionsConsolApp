"use client";

import { useState, useCallback } from "react";
import { updatePerson } from "@/lib/firestore";
import { serverTimestamp, Timestamp } from "firebase/firestore";
import { useFollowUpCount } from "@/context/FollowUpCountContext";
import { toDateInput } from "@/lib/dates";

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
  const { applyPatch } = useFollowUpCount();
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
    const patch = { lastFollowedUpAt: { toDate: () => new Date() }, scheduledFollowUpAt: null };
    patchPerson(person.id, patch);
    applyPatch(person.id, patch);
    clearAct(person.id);
  }, [patchPerson, setAct, clearAct, applyPatch]);

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

    const patch = {
      followUpRemarks: d.followUpRemarks,
      followUpDays: days,
      scheduledFollowUpAt: nextDate,
      ...(alsoCheck ? { lastFollowedUpAt: { toDate: () => new Date() } } : {}),
    };
    patchPerson(person.id, patch);
    applyPatch(person.id, patch);

    clearAct(person.id);
    if (alsoCheck) { setOpenId(null); setDraft(null); }
  }, [patchPerson, setAct, clearAct, applyPatch]);

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

  // Only what callers actually use: cardProps drives the cards, and the
  // follow-ups page needs setAct/clearAct for its own archive action.
  return { setAct, clearAct, saveLog, cardProps };
}
