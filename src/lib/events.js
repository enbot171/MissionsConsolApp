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

// Has attendance been taken for this date? A record saved with only invites on
// it is not marked yet. Records from before invites existed have no flag, and
// back then a record always meant attendance was taken.
export const isMarked = (record) => !!record && record.marked !== false;

const added = (before, now) => [...now].filter((id) => !before.has(id));

/**
 * What this phone changed since it loaded the record: who it ticked or unticked,
 * how far it moved the walk-in number, and who it invited or un-invited.
 * `invited` left out means the invites were not touched.
 */
export function attendanceChanges(loaded, present, walkIns, invited = loaded?.invited || []) {
  const before = new Set(loaded?.present || []);
  const now = new Set(present);
  const invBefore = new Set(loaded?.invited || []);
  const invNow = new Set(invited);
  return {
    ticked: added(before, now),
    unticked: added(now, before),
    walkInsDelta: (Number(walkIns) || 0) - (Number(loaded?.walkIns) || 0),
    invitedAdded: added(invBefore, invNow),
    invitedRemoved: added(invNow, invBefore),
  };
}

// True when the changes touch who came or walk-ins, not just invites.
export const marksAttendance = ({ ticked = [], unticked = [], walkInsDelta = 0 } = {}) =>
  ticked.length > 0 || unticked.length > 0 || walkInsDelta !== 0;

export const hasChanges = (changes = {}) =>
  marksAttendance(changes) || (changes.invitedAdded || []).length > 0 || (changes.invitedRemoved || []).length > 0;

/**
 * Lays one phone's changes over the record as it is saved right now. Two people
 * marking the same service each keep the other's ticks and invites, because only
 * the differences are applied, never the whole list.
 */
export function mergeAttendance(saved, changes = {}) {
  const { ticked = [], unticked = [], walkInsDelta = 0, invitedAdded = [], invitedRemoved = [] } = changes;
  const present = new Set(saved?.present || []);
  ticked.forEach((id) => present.add(id));
  unticked.forEach((id) => present.delete(id));
  const invited = new Set(saved?.invited || []);
  invitedAdded.forEach((id) => invited.add(id));
  invitedRemoved.forEach((id) => invited.delete(id));
  return {
    present: [...present],
    walkIns: Math.max(0, (Number(saved?.walkIns) || 0) + walkInsDelta),
    invited: [...invited],
    // `markTaken` records a date where nobody came: nothing else changed.
    marked: isMarked(saved) || marksAttendance(changes) || !!changes.markTaken,
  };
}

// How many of the people invited were ticked as present.
export const invitedWhoCame = (record) => {
  const present = new Set(record?.present || []);
  return (record?.invited || []).filter((id) => present.has(id)).length;
};

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

// "6 invited · not marked yet", "12 people + 3 walk-ins · 4 of 6 invited came",
// or just the attendance when nobody was invited.
export function recordDetail(record) {
  const invited = (record?.invited || []).length;
  if (!isMarked(record)) return `${invited} invited · not marked yet`;
  const base = attendanceDetail(record);
  return invited > 0 ? `${base} · ${invitedWhoCame(record)} of ${invited} invited came` : base;
}
