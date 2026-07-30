import { describe, it, expect } from "vitest";
import { shouldApplyRemote } from "@/lib/google/eventMapping";

const at = (ms) => ({ toMillis: () => ms });

describe("shouldApplyRemote", () => {
  it("applies a Google change made after our last push", () => {
    expect(shouldApplyRemote({ updated: "2026-08-01T10:00:05Z" }, { syncedAt: Date.parse("2026-08-01T10:00:00Z") })).toBe(true);
  });

  it("ignores the echo of our own push", () => {
    expect(shouldApplyRemote({ updated: "2026-08-01T10:00:01Z" }, { syncedAt: Date.parse("2026-08-01T10:00:00Z") })).toBe(false);
  });

  it("ignores a Google change older than a local edit", () => {
    expect(shouldApplyRemote(
      { updated: "2026-08-01T10:00:00Z" },
      { updatedAt: at(Date.parse("2026-08-01T10:05:00Z")) }
    )).toBe(false);
  });

  it("applies when the meetup has never been synced or edited", () => {
    expect(shouldApplyRemote({ updated: "2026-08-01T10:00:00Z" }, {})).toBe(true);
  });

  it("applies when the event has no updated timestamp", () => {
    expect(shouldApplyRemote({}, { syncedAt: Date.now() })).toBe(true);
  });
});
