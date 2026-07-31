// Shared date helpers. Firestore hands back Timestamps, forms hand back
// strings, and tests hand back Dates — every one of these normalises all three.

function asDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts);
}

const pad = (n) => String(n).padStart(2, "0");

// Local calendar day, e.g. "2026-07-31". Deliberately NOT toISOString().split("T")[0],
// which converts to UTC first and lands on the wrong day either side of midnight.
export function toLocalDateStr(ts) {
  const d = asDate(ts);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null;
}

// Value for <input type="date">.
export function toDateInput(ts) {
  return toLocalDateStr(ts) ?? "";
}

// Value for <input type="datetime-local">.
export function toDatetimeLocal(ts) {
  const d = asDate(ts);
  if (!d) return "";
  return `${toLocalDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTime(ts) {
  const d = asDate(ts);
  return d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}
