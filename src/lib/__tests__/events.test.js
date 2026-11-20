import { describe, it, expect } from "vitest";
import {
  addDays, occurrencesBetween, eventDates, attendanceTotal, serviceCount,
  attendanceChanges, mergeAttendance, attendanceId, isMarked, hasChanges, marksAttendance,
  invitedWhoCame, recordDetail,
} from "@/lib/events";
import { weekStart, weekEnd, buildWeeklyReport } from "@/lib/report";
import { toDateInput } from "@/lib/dates";

// Sun 2026-11-01 is the first service.
const SERVICE = { recurrence: "weekly", dateStr: "2026-11-01", isService: true };
const ONE_OFF = { recurrence: "none", dateStr: "2026-11-21" };

describe("addDays", () => {
  it("crosses a month and a year", () => {
    expect(addDays("2026-11-29", 7)).toBe("2026-12-06");
    expect(addDays("2026-12-27", 7)).toBe("2027-01-03");
  });

  it("goes backwards", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("occurrencesBetween", () => {
  it("gives a one-off event only its own date", () => {
    expect(occurrencesBetween(ONE_OFF, "2026-11-16", "2026-11-22")).toEqual(["2026-11-21"]);
    expect(occurrencesBetween(ONE_OFF, "2026-11-23", "2026-11-29")).toEqual([]);
  });

  it("repeats a weekly event every seven days", () => {
    expect(occurrencesBetween(SERVICE, "2026-11-01", "2026-11-30"))
      .toEqual(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"]);
  });

  it("never shows a date before the first one", () => {
    expect(occurrencesBetween(SERVICE, "2026-10-01", "2026-11-08")).toEqual(["2026-11-01", "2026-11-08"]);
  });

  it("starts mid-range on the right weekday", () => {
    expect(occurrencesBetween(SERVICE, "2026-11-10", "2026-11-25")).toEqual(["2026-11-15", "2026-11-22"]);
  });

  it("includes a range that starts exactly on an occurrence", () => {
    expect(occurrencesBetween(SERVICE, "2026-11-15", "2026-11-15")).toEqual(["2026-11-15"]);
  });

  it("stops after endedOn, which itself still counts", () => {
    const stopped = { ...SERVICE, endedOn: "2026-11-15" };
    expect(occurrencesBetween(stopped, "2026-11-01", "2026-12-31"))
      .toEqual(["2026-11-01", "2026-11-08", "2026-11-15"]);
  });

  it("carries on across the new year", () => {
    expect(occurrencesBetween(SERVICE, "2026-12-21", "2027-01-10"))
      .toEqual(["2026-12-27", "2027-01-03", "2027-01-10"]);
  });

  it("puts exactly one Sunday service in each Monday-to-Sunday report week", () => {
    let start = weekStart(new Date(2026, 10, 4));
    for (let i = 0; i < 60; i++) {
      const from = toDateInput(start);
      const to = addDays(toDateInput(weekEnd(start)), -1);
      expect(occurrencesBetween(SERVICE, from, to)).toHaveLength(1);
      start = weekEnd(start);
    }
  });

  it("returns nothing for an event with no date or an upside-down range", () => {
    expect(occurrencesBetween({ recurrence: "weekly" }, "2026-11-01", "2026-11-30")).toEqual([]);
    expect(occurrencesBetween(SERVICE, "2026-11-30", "2026-11-01")).toEqual([]);
  });
});

describe("eventDates", () => {
  it("keeps a saved date the pattern no longer produces", () => {
    const moved = { recurrence: "none", dateStr: "2026-11-28" };
    expect(eventDates(moved, ["2026-11-21"], "2026-11-01", "2026-11-30"))
      .toEqual(["2026-11-21", "2026-11-28"]);
  });

  it("does not list a date twice", () => {
    expect(eventDates(SERVICE, ["2026-11-08"], "2026-11-01", "2026-11-15"))
      .toEqual(["2026-11-01", "2026-11-08", "2026-11-15"]);
  });
});

describe("counting", () => {
  it("adds people ticked and walk-ins", () => {
    expect(attendanceTotal({ present: ["a", "b"], walkIns: 3 })).toBe(5);
  });

  it("treats a missing record or missing fields as zero", () => {
    expect(attendanceTotal(null)).toBe(0);
    expect(attendanceTotal({})).toBe(0);
  });

  it("counts only Sunday-service records, and adds two services together", () => {
    const records = [
      { isService: true, present: ["a", "b"], walkIns: 1 },
      { isService: true, present: ["c"], walkIns: 0 },
      { isService: false, present: ["a", "b", "c", "d"], walkIns: 9 },
    ];
    expect(serviceCount(records)).toBe(4);
    expect(serviceCount()).toBe(0);
  });
});

describe("saving attendance", () => {
  it("works out what this phone changed", () => {
    const loaded = { present: ["a", "b"], walkIns: 2 };
    expect(attendanceChanges(loaded, ["b", "c"], 5)).toEqual({
      ticked: ["c"], unticked: ["a"], walkInsDelta: 3, invitedAdded: [], invitedRemoved: [],
    });
  });

  it("treats a first save as ticking everyone chosen", () => {
    expect(attendanceChanges(null, ["a"], 1)).toEqual({
      ticked: ["a"], unticked: [], walkInsDelta: 1, invitedAdded: [], invitedRemoved: [],
    });
  });

  it("leaves invites alone when they are not passed", () => {
    const changes = attendanceChanges({ present: [], invited: ["a"] }, ["a"], 0);
    expect(changes.invitedAdded).toEqual([]);
    expect(changes.invitedRemoved).toEqual([]);
  });

  it("keeps both people's ticks when two phones save from the same start", () => {
    const loaded = { present: ["a"], walkIns: 1 };
    const one = attendanceChanges(loaded, ["a", "b"], 2);
    const two = attendanceChanges(loaded, ["a", "c"], 3);

    const afterOne = mergeAttendance(loaded, one);
    const afterBoth = mergeAttendance(afterOne, two);

    expect(afterBoth.present.sort()).toEqual(["a", "b", "c"]);
    expect(afterBoth.walkIns).toBe(4);
  });

  it("keeps a tick this phone could not see, such as an archived person", () => {
    const saved = { present: ["archived", "a"], walkIns: 0 };
    const changes = attendanceChanges(saved, ["archived", "a", "b"], 0);
    expect(mergeAttendance(saved, changes).present.sort()).toEqual(["a", "archived", "b"]);
  });

  it("never lets walk-ins drop below zero", () => {
    expect(mergeAttendance({ present: [], walkIns: 1 }, { walkInsDelta: -5 }).walkIns).toBe(0);
  });

  it("starts from nothing when no record is saved yet", () => {
    expect(mergeAttendance(null, { ticked: ["a"], walkInsDelta: 2 })).toEqual({
      present: ["a"], walkIns: 2, invited: [], marked: true,
    });
  });


  it("uses one fixed id per event per date", () => {
    expect(attendanceId("ev1", "2026-11-22")).toBe("ev1_2026-11-22");
  });
});

describe("invites", () => {
  it("works out who this phone invited and un-invited", () => {
    const loaded = { present: [], walkIns: 0, invited: ["a", "b"] };
    const changes = attendanceChanges(loaded, [], 0, ["b", "c"]);
    expect(changes.invitedAdded).toEqual(["c"]);
    expect(changes.invitedRemoved).toEqual(["a"]);
    expect(hasChanges(changes)).toBe(true);
    expect(marksAttendance(changes)).toBe(false);
  });

  it("saves invites alone as not marked yet", () => {
    const merged = mergeAttendance(null, { invitedAdded: ["a", "b"] });
    expect(merged).toEqual({ present: [], walkIns: 0, invited: ["a", "b"], marked: false });
    expect(isMarked(merged)).toBe(false);
  });

  it("marks the record once someone is ticked or walk-ins change", () => {
    const invitesOnly = { present: [], walkIns: 0, invited: ["a"], marked: false };
    expect(mergeAttendance(invitesOnly, { ticked: ["a"] }).marked).toBe(true);
    expect(mergeAttendance(invitesOnly, { walkInsDelta: 2 }).marked).toBe(true);
  });

  it("can mark a date where nobody came", () => {
    const invitesOnly = { present: [], walkIns: 0, invited: ["a"], marked: false };
    expect(mergeAttendance(invitesOnly, { markTaken: true })).toEqual({
      present: [], walkIns: 0, invited: ["a"], marked: true,
    });
  });

  it("keeps a record marked when only invites change later", () => {
    const marked = { present: ["a"], walkIns: 0, invited: [], marked: true };
    expect(mergeAttendance(marked, { invitedAdded: ["b"] }).marked).toBe(true);
  });

  it("counts records saved before invites existed as marked", () => {
    expect(isMarked({ present: ["a"], walkIns: 1 })).toBe(true);
    expect(mergeAttendance({ present: ["a"], walkIns: 1 }, { invitedAdded: ["b"] }).marked).toBe(true);
    expect(isMarked(null)).toBe(false);
  });

  it("keeps both people's invites when two phones save from the same start", () => {
    const loaded = { present: [], walkIns: 0, invited: ["a"], marked: false };
    const one = attendanceChanges(loaded, [], 0, ["a", "b"]);
    const two = attendanceChanges(loaded, [], 0, ["c"]);
    const after = mergeAttendance(mergeAttendance(loaded, one), two);
    expect(after.invited.sort()).toEqual(["b", "c"]);
    expect(after.marked).toBe(false);
  });

  it("counts how many invited people came", () => {
    expect(invitedWhoCame({ present: ["a", "x"], invited: ["a", "b"] })).toBe(1);
    expect(invitedWhoCame(null)).toBe(0);
  });

  it("describes a record with and without invites", () => {
    expect(recordDetail({ present: [], walkIns: 0, invited: ["a", "b"], marked: false })).toBe("2 invited · not marked yet");
    expect(recordDetail({ present: ["a"], walkIns: 1, invited: ["a", "b"], marked: true }))
      .toBe("1 person + 1 walk-in · 1 of 2 invited came");
    expect(recordDetail({ present: ["a"], walkIns: 0 })).toBe("1 person + 0 walk-ins");
  });

  it("adds nothing to No. in Service for invites alone", () => {
    expect(serviceCount([{ isService: true, present: [], walkIns: 0, invited: ["a", "b"], marked: false }])).toBe(0);
  });
});

describe("weekly report: No. in Service", () => {
  const start = new Date(2026, 10, 16);

  it("is 0 with no service attendance", () => {
    expect(buildWeeklyReport({ start }).progress["No. in Service"]).toBe(0);
  });

  it("is people ticked plus walk-ins at that week's service", () => {
    const serviceAttendance = [{ isService: true, present: ["a", "b", "c"], walkIns: 2 }];
    expect(buildWeeklyReport({ start, serviceAttendance }).progress["No. in Service"]).toBe(5);
  });
});
