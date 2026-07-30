import { describe, it, expect } from "vitest";
import { meetupToEvent, eventToMeetupPatch, DEFAULT_DURATION_MINUTES } from "@/lib/google/eventMapping";

const meetup = {
  id: "m1",
  personName: "Marcus Tan",
  date: new Date("2026-08-12T15:00:00.000Z"),
  location: "Starbucks Orchard",
  notes: "Invite to CG",
};

describe("meetupToEvent", () => {
  it("maps the person's name to the event title", () => {
    expect(meetupToEvent(meetup).summary).toBe("Marcus Tan");
  });

  it("defaults to a one hour block", () => {
    const e = meetupToEvent(meetup);
    const ms = new Date(e.end.dateTime) - new Date(e.start.dateTime);
    expect(ms).toBe(DEFAULT_DURATION_MINUTES * 60 * 1000);
  });

  it("stamps the meetup id so inbound sync can match it back", () => {
    expect(meetupToEvent(meetup).extendedProperties.private.consolAppMeetupId).toBe("m1");
  });

  it("accepts a Firestore Timestamp as well as a Date", () => {
    const ts = { toDate: () => new Date("2026-08-12T15:00:00.000Z") };
    const e = meetupToEvent({ ...meetup, date: ts });
    expect(e.start.dateTime).toBe("2026-08-12T15:00:00.000Z");
  });

  it("omits location and description when blank rather than sending empty strings", () => {
    const e = meetupToEvent({ ...meetup, location: "", notes: "" });
    expect(e.location).toBeUndefined();
    expect(e.description).toBeUndefined();
  });

  it("throws a named error when the meetup has no date", () => {
    expect(() => meetupToEvent({ ...meetup, date: null })).toThrow("Meetup has no date");
  });
});

describe("eventToMeetupPatch", () => {
  it("extracts date, location and notes", () => {
    const patch = eventToMeetupPatch({
      status: "confirmed",
      start: { dateTime: "2026-08-13T09:30:00Z" },
      location: "Cafe",
      description: "notes here",
    });
    expect(patch.date.toISOString()).toBe("2026-08-13T09:30:00.000Z");
    expect(patch.location).toBe("Cafe");
    expect(patch.notes).toBe("notes here");
  });

  it("returns null for a cancelled event so callers delete instead of patch", () => {
    expect(eventToMeetupPatch({ status: "cancelled", id: "x" })).toBeNull();
  });

  it("returns null for an all-day event with no dateTime", () => {
    expect(eventToMeetupPatch({ status: "confirmed", start: { date: "2026-08-13" } })).toBeNull();
  });

  it("returns null for an unparseable dateTime instead of an Invalid Date", () => {
    expect(eventToMeetupPatch({ status: "confirmed", start: { dateTime: "not a date" } })).toBeNull();
  });

  it("defaults missing location and notes to empty strings", () => {
    const patch = eventToMeetupPatch({ status: "confirmed", start: { dateTime: "2026-08-13T09:30:00Z" } });
    expect(patch.location).toBe("");
    expect(patch.notes).toBe("");
  });
});
