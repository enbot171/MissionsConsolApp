import { toDateInput } from "./dates";

// Events and their attendance, as pure functions.
//
// Every date here is a local "YYYY-MM-DD" string. They sort and compare
// correctly as plain strings, and unlike a timestamp they cannot name a
// different day on a phone in another timezone.

export const parseDateStr = (str) => {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const parse = parseDateStr;

export const isDateStr = (str) => /^\d{4}-\d{2}-\d{2}$/.test(str || "") && toDateInput(parse(str)) === str;

// Steps by calendar date parts, never milliseconds, so a clock change in the
// middle of the range cannot shift the day.
export function addDays(str, n) {
  const d = parse(str);
  return toDateInput(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

export const isWeekly = (event) => event.recurrence === "weekly";

/**
 * The dates an event falls on between `fromStr` and `toStr`, both included.
 *
 * A one-off event is its own date. A weekly event repeats every seven days from
 * its first date (`dateStr`), never before it, and never after `endedOn` once
 * the series has been stopped. Nothing is stored for these dates: a date only
 * gets a record when someone saves attendance for it.
 */
export function occurrencesBetween(event, fromStr, toStr) {
  const first = event?.dateStr;
  if (!first || fromStr > toStr) return [];
  if (!isWeekly(event)) return first >= fromStr && first <= toStr ? [first] : [];

  const last = event.endedOn && event.endedOn < toStr ? event.endedOn : toStr;
  const gap = daysBetween(first, fromStr);
  let day = gap > 0 ? addDays(first, Math.ceil(gap / 7) * 7) : first;

  const out = [];
  while (day <= last) {
    out.push(day);
    day = addDays(day, 7);
  }
  return out;
}

/**
 * Every date worth showing for one event: what its pattern produces, plus any
 * date that already has attendance saved. The second part matters when an
 * event's date is changed after people were marked: the old record must stay
 * reachable, because it still counts.
 */
export function eventDates(event, savedDateStrs, fromStr, toStr) {
  const all = new Set([...occurrencesBetween(event, fromStr, toStr), ...savedDateStrs]);
  return [...all].sort();
}

// People ticked plus walk-ins. Counts the saved ids, not the list on screen, so
// someone archived after being ticked is still counted.
export function attendanceTotal(record) {
  if (!record) return 0;
  return (record.present || []).length + (Number(record.walkIns) || 0);
}

// "No. in Service" for the weekly report: every Sunday-service record handed in.
// Two services in one week are added together.
export function serviceCount(records = []) {
  return records.filter((r) => r.isService).reduce((sum, r) => sum + attendanceTotal(r), 0);
}

/**
 * What this phone changed since it loaded the record: who it ticked, who it
 * unticked, and how far it moved the walk-in number.
 */
export function attendanceChanges(loaded, present, walkIns) {
  const before = new Set(loaded?.present || []);
  const now = new Set(present);
  return {
    ticked: [...now].filter((id) => !before.has(id)),
    unticked: [...before].filter((id) => !now.has(id)),
    walkInsDelta: (Number(walkIns) || 0) - (Number(loaded?.walkIns) || 0),
  };
}

/**
 * Lays one phone's changes over the record as it is saved right now. Two people
 * marking the same service each keep the other's ticks, because only the
 * differences are applied, never the whole list.
 */
export function mergeAttendance(saved, { ticked = [], unticked = [], walkInsDelta = 0 } = {}) {
  const present = new Set(saved?.present || []);
  ticked.forEach((id) => present.add(id));
  unticked.forEach((id) => present.delete(id));
  return {
    present: [...present],
    walkIns: Math.max(0, (Number(saved?.walkIns) || 0) + walkInsDelta),
  };
}

export const attendanceId = (eventId, dateStr) => `${eventId}_${dateStr}`;

// ── Wording ───────────────────────────────────────────────────────────────────

// "2026-11-22" -> "Sun, 22 Nov 2026"
export const formatEventDay = (dateStr) =>
  isDateStr(dateStr)
    ? parse(dateStr).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : dateStr || "";

const weekdayName = (dateStr) => parse(dateStr).toLocaleDateString("en-GB", { weekday: "long" });

// "Every Sunday" or "One-off"
export const repeatLabel = (event) =>
  isWeekly(event) && isDateStr(event.dateStr) ? `Every ${weekdayName(event.dateStr)}` : "One-off";

// "Every Sunday · 10:00 · Shibuya hall"
export const describeEvent = (event) =>
  [repeatLabel(event), event.time, event.location].filter(Boolean).join(" · ");

// "12 people + 3 walk-ins"
export function attendanceDetail(record) {
  const people = (record?.present || []).length;
  const walkIns = Number(record?.walkIns) || 0;
  return `${people} ${people === 1 ? "person" : "people"} + ${walkIns} walk-in${walkIns === 1 ? "" : "s"}`;
}
