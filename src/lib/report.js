export const DAY_LABELS = ["Mon", "Tues", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const SIGN_WONDER_TYPES = ["Physical Healing", "Emotional Healing", "Restored Relationships"];

// Monday 00:00 of the week containing `d`. The report week runs Mon–Sun to match
// the paper form; JS weeks start Sunday, hence the shift.
export function weekStart(d = new Date()) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

export function weekEnd(start) {
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
}

function toDate(v) {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

// Which weekday column a record falls in, or -1 if outside the week.
// Reads local date parts — using UTC would file anything before 08:00 (UTC+8)
// under the previous day, and Monday's contacts would land in the prior week.
function dayIndex(value, start) {
  const d = toDate(value);
  if (!d) return -1;
  const at = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((at - start) / 86400000);
  return days >= 0 && days < 7 ? days : -1;
}

const zeros = () => [0, 0, 0, 0, 0, 0, 0];

/**
 * One report row: a count per weekday for every team member, plus column totals.
 *
 * `records` are bucketed by (owner uid, weekday). Each metric names the predicate
 * that decides whether a record counts — so adding a row means adding a predicate,
 * not another pass over the data.
 */
function buildRows(members, records, metrics, start) {
  const rows = metrics.map((m) => ({
    key: m.key,
    label: m.label,
    members: members.map((u) => ({ uid: u.id, name: u.name, days: zeros(), total: 0 })),
    totals: zeros(),
    total: 0,
  }));
  const rowIndex = new Map(members.map((u, i) => [u.id, i]));

  records.forEach((r) => {
    const day = dayIndex(r.when, start);
    if (day < 0) return;
    const mi = rowIndex.get(r.uid);
    metrics.forEach((metric, i) => {
      if (!metric.match(r.doc)) return;
      const row = rows[i];
      row.totals[day] += 1;
      row.total += 1;
      // A record owned by someone outside the team list still counts toward the
      // team total — it just has no member row to sit in.
      if (mi === undefined) return;
      row.members[mi].days[day] += 1;
      row.members[mi].total += 1;
    });
  });

  return rows;
}

const EVANGELISM_METRICS = [
  { key: "talkedTo",   label: "1. No. of new people talked to",        match: () => true },
  { key: "gospel",     label: "2. Shared gospel to how many new people", match: (p) => !!p.gospelShared },
  { key: "prayed",     label: "3. No. of people prayed for",           match: (p) => !!p.prayed },
  { key: "responsive", label: "4. No. of responsive contacts",         match: (p) => !p.noContact },
  { key: "salvations", label: "6. No. of Salvations",                  match: (p) => !!p.saved },
];

const CONNECTION_METRICS = [
  { key: "metUp",     label: "1. Met up with how many contacts",       match: () => true },
  { key: "metPrayed", label: "2. Prayed for how many contacts",        match: (m) => !!m.metPrayed },
  { key: "metGospel", label: "3. Shared gospel with how many contacts",match: (m) => !!m.metGospel },
  { key: "metSaved",  label: "4. No. of contacts received salvation",  match: (m) => !!m.metSaved },
];

const ARRANGED_METRIC = [
  { key: "arranged", label: "5. No. of meet-ups arranged", match: () => true },
];

/**
 * The whole weekly team report.
 *
 * Dating rules, which are the part worth arguing with:
 *  - Evangelism rows are dated by when the person was **met** (`createdAt`).
 *    `gospelShared`/`prayed`/`saved` are booleans with no timestamp of their own,
 *    so ticking one later still reports on the day you met them.
 *  - "Meet-ups arranged" is dated by the meeting's own date, not when it was
 *    booked, and counts regardless of whether it happened.
 *  - Connection Time counts only meet-ups confirmed as happened (`completed`).
 */
export function buildWeeklyReport({ members = [], people = [], noContact = [], meetups = [], testimonies = [], cgs = [], start }) {
  const everyone = [...people, ...noContact];

  const peopleRecords = everyone.map((p) => ({ uid: p.assignedTo, when: p.createdAt, doc: p }));
  const meetupRecords = meetups.map((m) => ({ uid: m.assignedTo, when: m.date, doc: m }));
  const happened = meetupRecords.filter((r) => r.doc.completed === true);

  const evangelism = buildRows(members, peopleRecords, EVANGELISM_METRICS, start);
  const arranged = buildRows(members, meetupRecords, ARRANGED_METRIC, start);
  // Row 5 sits between rows 4 and 6 on the form, so splice it back into place.
  evangelism.splice(4, 0, arranged[0]);

  const connection = buildRows(members, happened, CONNECTION_METRICS, start);

  // Signs & wonders are a team-level tally by type — the form has no member split.
  const signs = SIGN_WONDER_TYPES.map((type, i) => ({
    key: type,
    label: `${i + 1}. ${type}`,
    days: zeros(),
    total: 0,
  }));
  testimonies.forEach((t) => {
    if (!t.signWonder) return;
    const day = dayIndex(t.date, start);
    const row = signs.find((s) => s.key === t.category);
    if (day < 0 || !row) return;
    row.days[day] += 1;
    row.total += 1;
  });

  const hasRole = (p, r) => (p.roles || []).includes(r);
  const milestone = (p, m) => !!(p.milestones || {})[m];

  const progress = {
    Contacts: people.filter((p) => hasRole(p, "Contact")).length,
    Converts: everyone.filter((p) => p.saved).length,
    Disciples: people.filter((p) => hasRole(p, "Disciple")).length,
    Encounter: people.filter((p) => milestone(p, "NS Encounter")).length,
    "Water Baptism": people.filter((p) => milestone(p, "Water Baptism")).length,
    "Connect Group": cgs.length,
    "No. in CGs": people.filter((p) => p.cgId).length,
    "No. in Service": people.filter((p) => hasRole(p, "Core Team")).length,
  };

  return { start, evangelism, connection, signs, progress, members };
}

// ── Manual overrides ──────────────────────────────────────────────────────────
//
// A team can type its own number into any member/day cell of sections A and B.
// Those numbers are stored apart from the records the report counts, as a flat
// map of "metric|uid|day" → number, and laid over the counted report here.

export const overrideKey = (metricKey, uid, day) => `${metricKey}|${uid}|${day}`;

const OVERRIDE_SECTIONS = ["evangelism", "connection"];

function parseKey(key) {
  const [metricKey, uid, dayText] = String(key).split("|");
  const day = Number(dayText);
  if (!metricKey || !uid || !Number.isInteger(day) || day < 0 || day > 6) return null;
  return { metricKey, uid, day };
}

// The cell a key points at in a report, or null when the metric or the member
// is not in it (a member who has left the team has no row any more).
function findCell(report, key) {
  const parsed = parseKey(key);
  if (!parsed) return null;
  for (const section of OVERRIDE_SECTIONS) {
    const row = (report[section] || []).find((r) => r.key === parsed.metricKey);
    if (!row) continue;
    const member = row.members.find((m) => m.uid === parsed.uid);
    return member ? { row, member, day: parsed.day } : null;
  }
  return null;
}

/**
 * A copy of `report` with the override values in place.
 *
 * Totals move by the difference rather than being re-added from the member
 * rows: a record owned by someone outside the member list counts toward the
 * team total without having a row, and that has to survive an edit elsewhere.
 */
export function applyOverrides(report, cells) {
  const out = { ...report };
  OVERRIDE_SECTIONS.forEach((section) => {
    out[section] = (report[section] || []).map((row) => ({
      ...row,
      members: row.members.map((m) => ({ ...m, days: [...m.days] })),
      totals: [...row.totals],
    }));
  });

  Object.entries(cells || {}).forEach(([key, value]) => {
    const cell = findCell(out, key);
    if (!cell || !Number.isFinite(value)) return;
    const { row, member, day } = cell;
    const diff = value - member.days[day];
    member.days[day] = value;
    member.total += diff;
    row.totals[day] += diff;
    row.total += diff;
  });

  return out;
}

/**
 * The overrides to store after an editing session.
 *
 * `changes` holds only the cells the user changed. One that now equals what the
 * app counts stops being an override; any other is stored. Everything else in
 * `existingCells` is kept as it was, including cells for people who are no
 * longer on the team, so one person's save never erases another's edits.
 */
export function mergeOverrides(countedReport, existingCells, changes) {
  const next = { ...(existingCells || {}) };
  Object.entries(changes || {}).forEach(([key, value]) => {
    const cell = findCell(countedReport, key);
    if (cell && cell.member.days[cell.day] === value) delete next[key];
    else next[key] = value;
  });
  return next;
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function cell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const line = (cells) => cells.map(cell).join(",");

function sectionLines(title, rows) {
  const out = [line([title, ...DAY_LABELS, "Total"])];
  rows.forEach((row) => {
    out.push(line([row.label]));
    row.members.forEach((m) => out.push(line([m.name, ...m.days, m.total])));
    out.push(line(["Total:", ...row.totals, row.total]));
  });
  return out;
}

export function reportToCsv(report, { teamName = "", leaderName = "", location = "", weekNo = "" } = {}) {
  const end = new Date(report.start.getFullYear(), report.start.getMonth(), report.start.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });

  const rows = [
    line(["Country:", teamName, "", "", "", "", "", "Week Ending:", fmt(end)]),
    line(["Location:", location, "", "", "", "", "", "Week No.:", weekNo]),
    line(["Team Leader:", leaderName]),
    "",
    ...sectionLines("A. Evangelism", report.evangelism),
    "",
    ...sectionLines("B. Connection Time", report.connection),
    "",
    line(["C. Signs & Wonders", ...DAY_LABELS, "Total"]),
    ...report.signs.map((s) => line([s.label, ...s.days, s.total])),
    line(["Total:", ...report.signs.reduce((a, s) => a.map((v, i) => v + s.days[i]), zeros()),
      report.signs.reduce((a, s) => a + s.total, 0)]),
    "",
    line(["D. Progress of Work (for the week reported)", ...Object.keys(report.progress)]),
    line(["Total", ...Object.values(report.progress)]),
  ];

  return rows.join("\n");
}
