import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { signAdminToken, verifyAdminToken } from "@/lib/auth";
import { ADMIN_SESSION_TOKEN_TYPE } from "@/lib/adminSessionClaims";

const TEST_SECRET = "test-admin-jwt-secret-at-least-32-characters-long";

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("admin session JWT", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_JWT_SECRET", TEST_SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a typed HS256 session token", () => {
    const token = signAdminToken("admin-1");
    const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
    expect(header.alg).toBe("HS256");

    const payload = verifyAdminToken(token);
    expect(payload?.adminId).toBe("admin-1");
    expect(payload?.typ).toBe(ADMIN_SESSION_TOKEN_TYPE);
  });

  it("rejects the pending-2FA token", () => {
    const token = jwt.sign(
      { type: "admin-2fa-pending", adminId: "admin-1", email: "a@example.com" },
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: 300 }
    );
    expect(verifyAdminToken(token)).toBeNull();
  });

  it("rejects the Telegram-key pending token", () => {
    const token = jwt.sign(
      { type: "admin-telegram-key-pending", adminId: "admin-1", email: "a@example.com", keyHash: "x" },
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: 300 }
    );
    expect(verifyAdminToken(token)).toBeNull();
  });

  it("rejects the lock-hint token", () => {
    const token = jwt.sign(
      { type: "admin-lock-hint", identifier: "admin-login:a@example.com" },
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: 300 }
    );
    expect(verifyAdminToken(token)).toBeNull();
  });

  it("rejects a creator session token signed with the same secret", () => {
    const token = jwt.sign({ affiliateId: "aff-1", type: "creator_session" }, TEST_SECRET, {
      algorithm: "HS256",
    });
    expect(verifyAdminToken(token)).toBeNull();
  });

  it("rejects a Telegram customer token signed with the same secret", () => {
    const token = jwt.sign({ userId: "u1", telegramUserId: "1", username: null }, TEST_SECRET, {
      algorithm: "HS256",
    });
    expect(verifyAdminToken(token)).toBeNull();
  });

  it("rejects a legacy untyped { adminId } token", () => {
    const token = jwt.sign({ adminId: "admin-1", email: "a@example.com", role: "OWNER" }, TEST_SECRET, {
      algorithm: "HS256",
    });
    expect(verifyAdminToken(token)).toBeNull();
  });

  it("rejects an HS512-signed session token", () => {
    const token = jwt.sign({ adminId: "admin-1", typ: ADMIN_SESSION_TOKEN_TYPE }, TEST_SECRET, {
      algorithm: "HS512",
    });
    expect(verifyAdminToken(token)).toBeNull();
  });

  it("rejects an alg:none token", () => {
    const token = `${base64url({ alg: "none", typ: "JWT" })}.${base64url({
      adminId: "admin-1",
      typ: ADMIN_SESSION_TOKEN_TYPE,
    })}.`;
    expect(verifyAdminToken(token)).toBeNull();
  });

  it("rejects an expired session token", () => {
    const token = jwt.sign(
      { adminId: "admin-1", typ: ADMIN_SESSION_TOKEN_TYPE, exp: Math.floor(Date.now() / 1000) - 10 },
      TEST_SECRET,
      { algorithm: "HS256" }
    );
    expect(verifyAdminToken(token)).toBeNull();
  });

  it("rejects a session token signed with another secret", () => {
    const token = jwt.sign({ adminId: "admin-1", typ: ADMIN_SESSION_TOKEN_TYPE }, "another-secret-another-secret-123", {
      algorithm: "HS256",
    });
    expect(verifyAdminToken(token)).toBeNull();
  });

  it("fails closed without a secret", () => {
    const token = signAdminToken("admin-1");
    vi.stubEnv("ADMIN_JWT_SECRET", "");
    expect(verifyAdminToken(token)).toBeNull();
    expect(() => signAdminToken("admin-1")).toThrow();
  });
});
