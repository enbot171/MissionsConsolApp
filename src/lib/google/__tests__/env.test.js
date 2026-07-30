import { describe, it, expect, afterEach } from "vitest";
import { requireEnv } from "@/lib/google/env";

const KEY = "TEST_ONLY_ENV_VAR";

afterEach(() => { delete process.env[KEY]; });

describe("requireEnv", () => {
  it("returns the value when set", () => {
    process.env[KEY] = "hello";
    expect(requireEnv(KEY)).toBe("hello");
  });

  it("throws a named error when unset", () => {
    expect(() => requireEnv(KEY)).toThrow("Missing env var: TEST_ONLY_ENV_VAR");
  });

  it("treats an empty string as missing", () => {
    process.env[KEY] = "";
    expect(() => requireEnv(KEY)).toThrow("Missing env var: TEST_ONLY_ENV_VAR");
  });
});
