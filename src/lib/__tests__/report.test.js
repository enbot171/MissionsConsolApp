import { describe, it, expect } from "vitest";
import {
  buildWeeklyReport, reportToCsv, weekStart, DAY_LABELS,
  applyOverrides, mergeOverrides, overrideKey,
} from "@/lib/report";

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

describe("report overrides", () => {
  const people = [
    { assignedTo: "u1", createdAt: at(0) },
    { assignedTo: "u1", createdAt: at(0) },
    { assignedTo: "u2", createdAt: at(3), prayed: true },
    // Owned by someone who is not on the member list: counts toward the team
    // total but has no row of its own.
    { assignedTo: "gone", createdAt: at(0) },
  ];
  const build = () => buildWeeklyReport({ members: MEMBERS, people, start: START });
  const talked = (report) => row(report, "evangelism", "talkedTo");
  const member = (r, uid) => r.members.find((m) => m.uid === uid);

  it("builds keys as metric|uid|day", () => {
    expect(overrideKey("talkedTo", "u1", 0)).toBe("talkedTo|u1|0");
  });

  it("replaces one cell and moves the row, column and grand totals by the difference", () => {
    const out = applyOverrides(build(), { "talkedTo|u1|0": 5 });
    const r = talked(out);
    expect(member(r, "u1").days[0]).toBe(5);
    expect(member(r, "u1").total).toBe(5);
    // Counted Monday total was 3 (two for u1, one for the departed owner).
    expect(r.totals[0]).toBe(6);
    expect(r.total).toBe(7);
  });

  it("applies several cells in one row, including an override to zero", () => {
    const out = applyOverrides(build(), { "talkedTo|u1|0": 0, "talkedTo|u2|3": 4, "talkedTo|u2|6": 2 });
    const r = talked(out);
    expect(member(r, "u1").total).toBe(0);
    expect(member(r, "u2").days).toEqual([0, 0, 0, 4, 0, 0, 2]);
    expect(member(r, "u2").total).toBe(6);
    expect(r.totals).toEqual([1, 0, 0, 4, 0, 0, 2]);
    expect(r.total).toBe(7);
  });

  it("reaches rows in the connection section too", () => {
    const out = applyOverrides(build(), { "metUp|u2|1": 3 });
    const r = row(out, "connection", "metUp");
    expect(member(r, "u2").days[1]).toBe(3);
    expect(r.total).toBe(3);
  });

  it("ignores keys for unknown metrics, unknown members and bad days", () => {
    const counted = build();
    const out = applyOverrides(counted, { "nope|u1|0": 9, "talkedTo|gone|0": 9, "talkedTo|u1|7": 9, "talkedTo|u1|x": 9 });
    expect(out.evangelism).toEqual(counted.evangelism);
    expect(out.connection).toEqual(counted.connection);
  });

  it("does not change the report it was given", () => {
    const counted = build();
    const before = JSON.stringify(counted);
    applyOverrides(counted, { "talkedTo|u1|0": 5 });
    expect(JSON.stringify(counted)).toBe(before);
  });

  it("returns the counted numbers when there are no overrides", () => {
    const counted = build();
    expect(applyOverrides(counted, {}).evangelism).toEqual(counted.evangelism);
    expect(applyOverrides(counted, undefined).evangelism).toEqual(counted.evangelism);
  });

  it("carries overrides into the CSV", () => {
    const csv = reportToCsv(applyOverrides(build(), { "talkedTo|u1|0": 5 }));
    expect(csv).toContain("Alice,5,0,0,0,0,0,0,5");
  });

  describe("mergeOverrides", () => {
    it("stores a changed cell that differs from the count", () => {
      expect(mergeOverrides(build(), {}, { "talkedTo|u1|0": 5 })).toEqual({ "talkedTo|u1|0": 5 });
    });

    it("drops a changed cell that equals the count, so it follows the count again", () => {
      const existing = { "talkedTo|u1|0": 5 };
      expect(mergeOverrides(build(), existing, { "talkedTo|u1|0": 2 })).toEqual({});
    });

    it("overwrites an existing override that was changed", () => {
      expect(mergeOverrides(build(), { "talkedTo|u1|0": 5 }, { "talkedTo|u1|0": 8 })).toEqual({ "talkedTo|u1|0": 8 });
    });

    it("keeps overrides that were not touched, including a departed member's", () => {
      const existing = { "talkedTo|left|2": 4, "gospel|u2|1": 1 };
      expect(mergeOverrides(build(), existing, { "talkedTo|u1|0": 5 })).toEqual({
        "talkedTo|left|2": 4, "gospel|u2|1": 1, "talkedTo|u1|0": 5,
      });
    });

    it("does not change the maps it was given", () => {
      const existing = { "talkedTo|u1|0": 5 };
      const changes = { "talkedTo|u1|0": 2 };
      mergeOverrides(build(), existing, changes);
      expect(existing).toEqual({ "talkedTo|u1|0": 5 });
      expect(changes).toEqual({ "talkedTo|u1|0": 2 });
    });
  });
});
