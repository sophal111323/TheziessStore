// lib/ipAllowlist.ts
//
// IP allowlist matcher for webhook / server-to-server endpoints.
//
// Supported entry formats (comma-separated env values):
//   - Exact IPv4:  "203.0.113.7"
//   - IPv4 CIDR:   "203.0.113.0/24"
//   - Exact IPv6:  "2001:db8::1"
//   - IPv6 CIDR:   "2001:db8::/32"
//
// Semantics:
//   - Env var unset/empty → allow everyone ({ configured: false }). The
//     caller's own HMAC signature check remains the hard auth gate.
//   - Env var set → the request IP MUST match at least one entry, otherwise
//     the request is rejected. Unknown/missing IPs are rejected too
//     (fail-closed while the allowlist is active).
//   - Malformed entries never match (fail-closed, never fail-open).
//
// Pure string/number logic only — safe in both Node and Edge runtimes.

export type IpAllowlistResult = {
  /** Whether the request IP may proceed. */
  allowed: boolean;
  /** Whether an allowlist is actually configured (env var non-empty). */
  configured: boolean;
};

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }

  return value >>> 0;
}

/**
 * Parse an IPv6 address into a 128-bit BigInt (FIND-006 fix).
 * Handles both full and compressed IPv6 notation.
 * Returns null if the IP is invalid.
 */
function ipv6ToInt(ip: string): bigint | null {
  let normalized = ip.toLowerCase();

  // Handle IPv6-mapped IPv4 (e.g., "::ffff:192.0.2.1")
  const mappedMatch = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedMatch) {
    const ipv4Int = ipv4ToInt(mappedMatch[1]);
    if (ipv4Int === null) return null;
    return BigInt(0xffff00000000) | BigInt(ipv4Int);
  }

  // Expand "::" shorthand
  if (normalized.includes("::")) {
    const sides = normalized.split("::");
    if (sides.length > 2) return null; // malformed: multiple "::"

    const left = sides[0] ? sides[0].split(":") : [];
    const right = sides[1] ? sides[1].split(":") : [];
    const missing = 8 - (left.length + right.length);

    // "::" must stand for at least one zero group.
    if (missing < 1) return null; // too many groups

    normalized = [
      ...left,
      ...Array(missing).fill("0"),
      ...right,
    ].join(":");
  }

  const groups = normalized.split(":");
  if (groups.length !== 8) return null;

  let result = 0n;
  for (const group of groups) {
    // Every group must be 1-4 hex digits; empty groups (e.g. "1:2:3:4:5:6:7:"
    // or "2001:db8:::1") are only valid as part of a single "::".
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    const value = parseInt(group, 16);
    if (isNaN(value)) return null;
    result = (result << 16n) | BigInt(value);
  }

  return result;
}

/**
 * Normalize an IP string: trim, lowercase, strip IPv6 brackets
 * ("[2001:db8::1]" → "2001:db8::1") and IPv6-mapped IPv4 prefixes
 * ("::ffff:1.2.3.4" → "1.2.3.4" — common behind proxies).
 */
export function normalizeIp(value: string): string {
  let ip = value.trim().toLowerCase();

  if (ip.startsWith("[") && ip.endsWith("]")) {
    ip = ip.slice(1, -1);
  }

  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) ip = mapped[1];

  return ip;
}

function ipMatchesEntry(ip: string, entry: string): boolean {
  const normIp = normalizeIp(ip);
  const normEntry = normalizeIp(entry);

  const slash = normEntry.indexOf("/");
  
  if (slash !== -1) {
    const base = normEntry.slice(0, slash);
    const bitsRaw = normEntry.slice(slash + 1);

    if (!/^\d{1,3}$/.test(bitsRaw)) return false;
    const bits = Number(bitsRaw);

    // Try IPv4 CIDR first
    if (base.includes(".")) {
      if (bits > 32) return false;

      const baseInt = ipv4ToInt(base);
      const ipInt = ipv4ToInt(normIp);
      if (baseInt === null || ipInt === null) return false;

      if (bits === 0) return true; // "0.0.0.0/0" matches every IPv4 address
      const mask = (0xffffffff << (32 - bits)) >>> 0;
      return ((baseInt & mask) >>> 0) === ((ipInt & mask) >>> 0);
    }

    // Try IPv6 CIDR (FIND-006 fix)
    if (base.includes(":")) {
      if (bits > 128) return false;

      const baseInt = ipv6ToInt(base);
      const ipInt = ipv6ToInt(normIp);
      if (baseInt === null || ipInt === null) return false;

      if (bits === 0) return true; // "::/0" matches every IPv6 address
      const mask = (BigInt(1) << BigInt(128 - bits)) - BigInt(1);
      const inverseMask = ~mask;
      return (baseInt & inverseMask) === (ipInt & inverseMask);
    }

    return false;
  }

  // Exact match (IPv4 or IPv6). Compare parsed values so equivalent IPv6
  // spellings ("2001:0db8::1" vs "2001:db8::1") match, and anything that
  // does not parse (malformed entry or IP) never matches.
  const ipV4 = ipv4ToInt(normIp);
  const entryV4 = ipv4ToInt(normEntry);
  if (ipV4 !== null && entryV4 !== null) return ipV4 === entryV4;

  const ipV6 = ipv6ToInt(normIp);
  const entryV6 = ipv6ToInt(normEntry);
  if (ipV6 !== null && entryV6 !== null) return ipV6 === entryV6;

  return false;
}

/** Parse a comma-separated allowlist env value into entries. */
export function parseIpAllowlist(raw: string | null | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Evaluate a request IP against an allowlist env value.
 *
 * Examples:
 *   isIpAllowedByEnv("203.0.113.7", "")                        // { allowed: true,  configured: false }
 *   isIpAllowedByIp("198.51.100.9", "203.0.113.0/24")          // { allowed: false, configured: true  }
 *   isIpAllowedByEnv("203.0.113.7", "203.0.113.0/24,10.0.0.5") // { allowed: true, configured: true  }
 *   isIpAllowedByEnv("unknown", "203.0.113.0/24")              // { allowed: false, configured: true  }
 */
export function isIpAllowedByEnv(
  ip: string | null | undefined,
  envValue: string | null | undefined
): IpAllowlistResult {
  const entries = parseIpAllowlist(envValue);
  if (entries.length === 0) {
    return { allowed: true, configured: false };
  }

  const candidate = (ip || "").trim();
  if (!candidate || candidate.toLowerCase() === "unknown") {
    // No verifiable IP while an allowlist is active → reject.
    return { allowed: false, configured: true };
  }

  const allowed = entries.some((entry) => ipMatchesEntry(candidate, entry));
  return { allowed, configured: true };
}
