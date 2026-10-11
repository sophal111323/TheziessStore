import { describe, expect, it } from "vitest";
import { normalizePathForChecks } from "@/lib/pathNormalize";

describe("normalizePathForChecks", () => {
  it("decodes percent-encoded characters", () => {
    expect(normalizePathForChecks("/%61dmin")).toBe("/admin");
    expect(normalizePathForChecks("/%61dmin/security")).toBe("/admin/security");
  });

  it("collapses repeated slashes", () => {
    expect(normalizePathForChecks("//admin/x")).toBe("/admin/x");
    expect(normalizePathForChecks("/admin///x//y")).toBe("/admin/x/y");
  });

  it("strips trailing slashes except for the root", () => {
    expect(normalizePathForChecks("/admin/")).toBe("/admin");
    expect(normalizePathForChecks("/admin//")).toBe("/admin");
    expect(normalizePathForChecks("/")).toBe("/");
    expect(normalizePathForChecks("//")).toBe("/");
  });

  it("keeps the input when decoding fails", () => {
    expect(normalizePathForChecks("/admin/%E0")).toBe("/admin/%E0");
  });

  it("leaves plain paths unchanged", () => {
    expect(normalizePathForChecks("/api/orders/ABC123")).toBe("/api/orders/ABC123");
  });
});
