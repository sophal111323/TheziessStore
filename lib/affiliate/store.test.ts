import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The store writes to <cwd>/data/affiliates.json. Point cwd at a temp dir
// before the module loads so the test never touches the real data folder.
let tmpDir = "";
let store: typeof import("@/lib/affiliate/store");

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "affiliate-store-"));
  vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
  vi.resetModules();
  store = await import("@/lib/affiliate/store");
});

afterAll(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const base = { name: "Tester", password: "first-pass-123" };

describe("registerAffiliate never takes over an existing account (R-3)", () => {
  it("rejects a seeded promoter email and leaves the account unchanged", () => {
    const before = store.getAffiliateById("aff-davin");
    expect(before?.passwordHash).toBe("");

    const result = store.registerAffiliate({
      ...base,
      username: "attacker",
      email: "DAVIN@gmail.com ",
    });
    expect(result).toEqual({ success: false, error: "Email already registered" });

    const after = store.getAffiliateById("aff-davin");
    expect(after?.passwordHash).toBe("");
    expect(after?.username).toBe("davin");
    expect(store.authenticateAffiliate("davin@gmail.com", base.password)).toBeNull();
    expect(store.getAffiliateByUsername("attacker")).toBeNull();
  });

  it("rejects re-registering a real promoter's email; old password still works", () => {
    const first = store.registerAffiliate({ ...base, username: "realpromoter", email: "real@example.com" });
    expect(first.success).toBe(true);
    const originalHash = store.getAffiliateByUsername("realpromoter")?.passwordHash;
    expect(originalHash?.startsWith("$2")).toBe(true);

    const second = store.registerAffiliate({
      name: "Attacker",
      username: "takeover",
      email: "Real@Example.com",
      password: "attacker-pass-456",
    });
    expect(second).toEqual({ success: false, error: "Email already registered" });

    const after = store.getAffiliateByUsername("realpromoter");
    expect(after?.passwordHash).toBe(originalHash);
    expect(store.authenticateAffiliate("real@example.com", "attacker-pass-456")).toBeNull();
    expect(store.authenticateAffiliate("real@example.com", base.password)?.id).toBe(after?.id);
  });

  it("still rejects taken usernames and empty emails", () => {
    expect(store.registerAffiliate({ ...base, username: "davin", email: "new@example.com" }).success).toBe(false);
    expect(store.registerAffiliate({ ...base, username: "someone", email: "  " }).success).toBe(false);
  });
});
