"use client";

import { useEffect } from "react";

// One page at a time can hold unsaved edits, so one module-level message is
// enough. The menus ask `confirmLeave()` before they navigate.
let message = null;

/** True when it is fine to navigate away: nothing unsaved, or the user agreed. */
export function confirmLeave() {
  return !message || window.confirm(message);
}

/**
 * While `active`, leaving the page asks first: the app's own menus and back
 * link through `confirmLeave`, closing or reloading the tab through the
 * browser's own prompt.
 */
export function useLeaveGuard(active, text = "You have unsaved changes. Leave without saving?") {
  useEffect(() => {
    if (!active) return;
    message = text;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => {
      message = null;
      window.removeEventListener("beforeunload", warn);
    };
  }, [active, text]);
}
