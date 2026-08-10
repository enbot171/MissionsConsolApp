import { describe, it, expect } from "vitest";
import { buildWeeklyReport, reportToCsv, weekStart, DAY_LABELS } from "@/lib/report";

// Mon 2026-08-03 .. Sun 2026-08-09
const START = new Date(2026, 7, 3);
const at = (day, hour = 12) => new Date(2026, 7, 3 + day, hour);

const MEMBERS = [{ id: "u1", name: "Alice" }, { id: "u2", name: "Bob" }];

const row = (report, section, key) => report[section].find((r) => r.key === key);

describe("weekStart", () => {
  it("returns Monday for a mid-week date", () => {
    expect(weekStart(new Date(2026, 7, 6)).getTime()).toBe(START.getTime());
  });

  it("returns the Monday six days back for a Sunday, not the next day", () => {
    expect(weekStart(new Date(2026, 7, 9)).getTime()).toBe(START.getTime());
  });
});

describe("buildWeeklyReport — evangelism", () => {
  const people = [
    { assignedTo: "u1", createdAt: at(0), gospelShared: true, prayed: true, saved: true },
    { assignedTo: "u1", createdAt: at(0), gospelShared: false },
    { assignedTo: "u2", createdAt: at(3), prayed: true },
  ];
  const noContact = [{ assignedTo: "u1", createdAt: at(0), noContact: true, gospelShared: true }];

  const report = buildWeeklyReport({ members: MEMBERS, people, noContact, start: START });

  it("counts no-contact people as talked to but not as responsive", () => {
    expect(row(report, "evangelism", "talkedTo").totals[0]).toBe(3);
    expect(row(report, "evangelism", "responsive").totals[0]).toBe(2);
  });

  it("splits counts by member", () => {
    const talked = row(report, "evangelism", "talkedTo");
    expect(talked.members.find((m) => m.name === "Alice").total).toBe(3);
    expect(talked.members.find((m) => m.name === "Bob").total).toBe(1);
  });

  it("files each person under the weekday they were met", () => {
    expect(row(report, "evangelism", "prayed").totals).toEqual([1, 0, 0, 1, 0, 0, 0]);
  });

  it("keeps the form's row order, with meet-ups arranged in slot 5", () => {
    expect(report.evangelism.map((r) => r.key)).toEqual([
      "talkedTo", "gospel", "prayed", "responsive", "arranged", "salvations",
    ]);
  });
});

describe("buildWeeklyReport — dating", () => {
  it("ignores records outside the week", () => {
    const people = [
      { assignedTo: "u1", createdAt: new Date(2026, 7, 2, 23) },  // Sunday before
      { assignedTo: "u1", createdAt: new Date(2026, 7, 10, 1) },  // Monday after
    ];
    const report = buildWeeklyReport({ members: MEMBERS, people, start: START });
    expect(row(report, "evangelism", "talkedTo").total).toBe(0);
  });

  it("files an early-morning record under its local day, not the previous one", () => {
    // 00:30 local on Tuesday is Monday in UTC at +8 — the bug this guards against.
    const people = [{ assignedTo: "u1", createdAt: new Date(2026, 7, 4, 0, 30) }];
    const report = buildWeeklyReport({ members: MEMBERS, people, start: START });
    expect(row(report, "evangelism", "talkedTo").totals).toEqual([0, 1, 0, 0, 0, 0, 0]);
  });

  it("counts Sunday, the last column", () => {
    const people = [{ assignedTo: "u1", createdAt: at(6, 23) }];
    const report = buildWeeklyReport({ members: MEMBERS, people, start: START });
    expect(row(report, "evangelism", "talkedTo").totals[6]).toBe(1);
  });
});

describe("buildWeeklyReport — meet-ups", () => {
  const meetups = [
    { assignedTo: "u1", date: at(1), completed: true, metPrayed: true, metGospel: true },
    { assignedTo: "u1", date: at(1), completed: null },
    { assignedTo: "u2", date: at(5), completed: true, metSaved: true },
  ];
  const report = buildWeeklyReport({ members: MEMBERS, meetups, start: START });

  it("counts every meet-up as arranged, happened or not", () => {
    expect(row(report, "evangelism", "arranged").total).toBe(3);
  });

  it("counts only confirmed meet-ups under Connection Time", () => {
    expect(row(report, "connection", "metUp").total).toBe(2);
  });

  it("counts the per-meet-up outcome flags", () => {
    expect(row(report, "connection", "metPrayed").total).toBe(1);
    expect(row(report, "connection", "metGospel").total).toBe(1);
    expect(row(report, "connection", "metSaved").totals[5]).toBe(1);
  });
});

describe("buildWeeklyReport — signs & wonders", () => {
  const testimonies = [
    { date: at(2), signWonder: true, category: "Physical Healing" },
    { date: at(2), signWonder: true, category: "Physical Healing" },
    { date: at(4), signWonder: false, category: "Physical Healing" },
    { date: at(4), signWonder: true, category: "Emotional Healing" },
  ];
  const report = buildWeeklyReport({ members: MEMBERS, testimonies, start: START });

  it("tallies only testimonies flagged as a sign & wonder", () => {
    const physical = report.signs.find((s) => s.key === "Physical Healing");
    expect(physical.days[2]).toBe(2);
    expect(physical.total).toBe(2);
    expect(report.signs.find((s) => s.key === "Emotional Healing").total).toBe(1);
  });
});

describe("buildWeeklyReport — progress snapshot", () => {
  it("counts roles, milestones and CG membership", () => {
    const people = [
      { assignedTo: "u1", createdAt: at(0), roles: ["Contact"], cgId: "cg1" },
      { assignedTo: "u1", createdAt: at(0), roles: ["Disciple"], saved: true, milestones: { "Water Baptism": true } },
      { assignedTo: "u2", createdAt: at(0), roles: ["Core Team"], milestones: { "NS Encounter": true } },
    ];
    const report = buildWeeklyReport({ members: MEMBERS, people, cgs: [{ id: "cg1" }], start: START });
    expect(report.progress).toMatchObject({
      Contacts: 1, Converts: 1, Disciples: 1, Encounter: 1,
      "Water Baptism": 1, "Connect Group": 1, "No. in CGs": 1, "No. in Service": 1,
    });
  });
});

describe("reportToCsv", () => {
  const report = buildWeeklyReport({
    members: MEMBERS,
    people: [{ assignedTo: "u1", createdAt: at(0) }],
    start: START,
  });
  const csv = reportToCsv(report, { teamName: "Japan", leaderName: "Alice", location: "Osaka North", weekNo: 1 });

  it("heads the columns with the weekdays", () => {
    expect(csv.split("\n").find((l) => l.startsWith("A. Evangelism")))
      .toBe(["A. Evangelism", ...DAY_LABELS, "Total"].join(","));
  });

  it("dates the week by its Sunday", () => {
    expect(csv.split("\n")[0]).toContain("09/08/26");
  });

  it("quotes fields containing commas", () => {
    const withComma = reportToCsv(report, { teamName: "Japan, North" });
    expect(withComma.split("\n")[0]).toContain('"Japan, North"');
  });

  it("emits a member line per team member under each row", () => {
    expect(csv).toContain("\nAlice,1,0,0,0,0,0,0,1\n");
    expect(csv).toContain("\nBob,0,0,0,0,0,0,0,0\n");
  });
});
