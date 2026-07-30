import { describe, it, expect, beforeAll } from "vitest";
import { signState, verifyState } from "@/lib/google/state";

beforeAll(() => { process.env.GOOGLE_STATE_SECRET = "test-secret"; });

describe("state", () => {
  it("round-trips a uid", () => {
    expect(verifyState(signState("user-123"))).toBe("user-123");
  });

  it("rejects a tampered payload", () => {
    const state = signState("user-123");
    const [payload, sig] = state.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "attacker", exp: Date.now() + 60000 })).toString("base64url");
    expect(() => verifyState(`${forged}.${sig}`)).toThrow("Invalid state");
  });

  it("rejects an expired state", () => {
    const expired = signState("user-123", Date.now() - 1000);
    expect(() => verifyState(expired)).toThrow("Expired state");
  });

  it("rejects a malformed state", () => {
    expect(() => verifyState("garbage")).toThrow("Invalid state");
  });
});
