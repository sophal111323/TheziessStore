import { describe, expect, it } from "vitest";
import { isIpAllowedByEnv, normalizeIp, parseIpAllowlist } from "@/lib/ipAllowlist";

/** Shorthand: is `ip` allowed by allowlist `env`? */
function allowed(ip: string | null | undefined, env: string): boolean {
  return isIpAllowedByEnv(ip, env).allowed;
}

describe("isIpAllowedByEnv - unconfigured", () => {
  it.each([undefined, null, "", "   ", " , ,"])("allows everyone when env is %j", (env) => {
    expect(isIpAllowedByEnv("203.0.113.7", env)).toEqual({ allowed: true, configured: false });
    expect(isIpAllowedByEnv("unknown", env)).toEqual({ allowed: true, configured: false });
  });

  it("reports configured when entries exist", () => {
    expect(isIpAllowedByEnv("203.0.113.7", "203.0.113.7")).toEqual({ allowed: true, configured: true });
    expect(isIpAllowedByEnv("203.0.113.8", "203.0.113.7")).toEqual({ allowed: false, configured: true });
  });
});

describe("IPv4", () => {
  it("matches exact addresses", () => {
    expect(allowed("203.0.113.7", "203.0.113.7")).toBe(true);
    expect(allowed(" 203.0.113.7 ", "203.0.113.7")).toBe(true);
    expect(allowed("203.0.113.70", "203.0.113.7")).toBe(false);
  });

  it("matches /24", () => {
    expect(allowed("203.0.113.0", "203.0.113.0/24")).toBe(true);
    expect(allowed("203.0.113.255", "203.0.113.0/24")).toBe(true);
    expect(allowed("203.0.114.1", "203.0.113.0/24")).toBe(false);
  });

  it("matches /32 as a single host", () => {
    expect(allowed("10.0.0.5", "10.0.0.5/32")).toBe(true);
    expect(allowed("10.0.0.6", "10.0.0.5/32")).toBe(false);
  });

  it("matches /0 for every IPv4 address", () => {
    expect(allowed("1.2.3.4", "0.0.0.0/0")).toBe(true);
    expect(allowed("255.255.255.255", "0.0.0.0/0")).toBe(true);
  });

  it("matches any entry in a list", () => {
    expect(allowed("10.0.0.5", "203.0.113.0/24, 10.0.0.5")).toBe(true);
    expect(allowed("203.0.113.9", "203.0.113.0/24, 10.0.0.5")).toBe(true);
    expect(allowed("198.51.100.9", "203.0.113.0/24, 10.0.0.5")).toBe(false);
  });
});

describe("IPv6", () => {
  it("matches exact addresses regardless of spelling", () => {
    expect(allowed("2001:db8::1", "2001:db8::1")).toBe(true);
    expect(allowed("2001:0db8::1", "2001:db8::1")).toBe(true);
    expect(allowed("2001:db8::1", "2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(true);
    expect(allowed("2001:DB8::1", "2001:db8::1")).toBe(true);
    expect(allowed("2001:db8::2", "2001:db8::1")).toBe(false);
  });

  it("matches /32", () => {
    expect(allowed("2001:db8:abcd::1", "2001:db8::/32")).toBe(true);
    expect(allowed("2001:db9::1", "2001:db8::/32")).toBe(false);
  });

  it("matches /128 as a single host", () => {
    expect(allowed("2001:db8::1", "2001:db8::1/128")).toBe(true);
    expect(allowed("2001:db8::2", "2001:db8::1/128")).toBe(false);
  });

  it("matches ::/0 for every IPv6 address", () => {
    expect(allowed("2001:db8::1", "::/0")).toBe(true);
    expect(allowed("fe80::1", "::/0")).toBe(true);
  });

  it("expands :: shorthand", () => {
    expect(allowed("::1", "0:0:0:0:0:0:0:1")).toBe(true);
    expect(allowed("0000:0000:0000:0000:0000:0000:0000:0001", "::1")).toBe(true);
    expect(allowed("fe80::", "fe80:0:0:0:0:0:0:0")).toBe(true);
    expect(allowed("fe80::abcd", "fe80::/10")).toBe(true);
    expect(allowed("::2", "::1")).toBe(false);
  });

  it("strips brackets", () => {
    expect(allowed("[2001:db8::1]", "2001:db8::1")).toBe(true);
    expect(allowed("2001:db8::1", "[2001:db8::1]")).toBe(true);
    expect(allowed("[2001:db8::1]", "2001:db8::/32")).toBe(true);
  });
});

describe("IPv4-mapped IPv6", () => {
  it("normalizes ::ffff:a.b.c.d to IPv4", () => {
    expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
    expect(normalizeIp("[::FFFF:1.2.3.4]")).toBe("1.2.3.4");
  });

  it("matches IPv4 exact and CIDR entries", () => {
    expect(allowed("::ffff:1.2.3.4", "1.2.3.4")).toBe(true);
    expect(allowed("::ffff:1.2.3.4", "1.2.3.0/24")).toBe(true);
    expect(allowed("1.2.3.4", "::ffff:1.2.3.4")).toBe(true);
    expect(allowed("::ffff:1.2.3.5", "1.2.3.4")).toBe(false);
    expect(allowed("::ffff:1.2.4.4", "1.2.3.0/24")).toBe(false);
  });
});

describe("invalid request IPs are rejected while configured", () => {
  const env = "0.0.0.0/0, ::/0, 1.2.3.4, 2001:db8::1";

  it.each([
    "unknown",
    "UNKNOWN",
    "",
    "   ",
    "1.2.3",
    "256.1.1.1",
    "1.2.3.4.5",
    "2001:db8:::1",
    "1:2:3:4:5:6:7:",
    ":1:2:3:4:5:6:7",
    "1:2:3:4:5:6:7:8:9",
    "1:2:3:4::5:6:7:8",
    "1::2::3",
    "12345::1",
    "g::1",
    "not-an-ip",
  ])("rejects %j", (ip) => {
    expect(isIpAllowedByEnv(ip, env)).toEqual({ allowed: false, configured: true });
  });

  it("rejects null/undefined", () => {
    expect(isIpAllowedByEnv(null, env)).toEqual({ allowed: false, configured: true });
    expect(isIpAllowedByEnv(undefined, env)).toEqual({ allowed: false, configured: true });
  });
});

describe("malformed entries never match", () => {
  it.each([
    ["unknown", "unknown"],
    ["not-an-ip", "not-an-ip"],
    ["1.2.3", "1.2.3"],
    ["256.1.1.1", "256.1.1.1"],
    ["1.2.3.4", "1.2.3.4/33"],
    ["1.2.3.4", "1.2.3.0/abc"],
    ["1.2.3.4", "1.2.3.0/"],
    ["1.2.3.4", "1.2.3/24"],
    ["1.2.3.4", "/24"],
    ["2001:db8::1", "2001:db8::/129"],
    ["2001:db8::1", "2001:db8:::1"],
    ["2001:db8::1", "2001:db8:::/32"],
    ["1:2:3:4:5:6:7:0", "1:2:3:4:5:6:7:"],
    ["2001:db8::1", "garbage/32"],
  ])("ip %j vs entry %j", (ip, entry) => {
    expect(allowed(ip, entry)).toBe(false);
  });

  it("a malformed entry does not block valid entries in the same list", () => {
    expect(allowed("1.2.3.4", "garbage, 1.2.3.4")).toBe(true);
  });
});

describe("parseIpAllowlist", () => {
  it("splits, trims and drops empty entries", () => {
    expect(parseIpAllowlist(" 1.2.3.4 , ,2001:db8::/32,")).toEqual(["1.2.3.4", "2001:db8::/32"]);
    expect(parseIpAllowlist(undefined)).toEqual([]);
  });
});
