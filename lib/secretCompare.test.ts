import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "@/lib/secretCompare";

describe("timingSafeEqualString", () => {
  it("matches identical non-empty strings", () => {
    expect(timingSafeEqualString("abc123", "abc123")).toBe(true);
    expect(timingSafeEqualString("Bearer s3cret", "Bearer s3cret")).toBe(true);
  });

  it("rejects different contents of the same length", () => {
    expect(timingSafeEqualString("abc123", "abc124")).toBe(false);
    expect(timingSafeEqualString("xbc123", "abc123")).toBe(false);
  });

  it("rejects prefixes and longer values", () => {
    expect(timingSafeEqualString("abc", "abc123")).toBe(false);
    expect(timingSafeEqualString("abc123", "abc")).toBe(false);
    expect(timingSafeEqualString("abc\u0000", "abc")).toBe(false);
  });

  it("fails closed on empty, null and undefined", () => {
    expect(timingSafeEqualString("", "")).toBe(false);
    expect(timingSafeEqualString("", "a")).toBe(false);
    expect(timingSafeEqualString("a", "")).toBe(false);
    expect(timingSafeEqualString(null, "a")).toBe(false);
    expect(timingSafeEqualString("a", undefined)).toBe(false);
    expect(timingSafeEqualString(undefined, undefined)).toBe(false);
  });

  it("is case sensitive", () => {
    expect(timingSafeEqualString("Secret", "secret")).toBe(false);
  });
});
