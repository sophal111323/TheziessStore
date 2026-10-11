/**
 * CSRF Token Generation and Verification
 * 
 * Provides HMAC-based CSRF tokens for admin session protection.
 * Uses ADMIN_JWT_SECRET as the signing key.
 */

import crypto from "crypto";

/**
 * Generate a CSRF token for a given session ID
 * 
 * @param sessionId - The admin session ID to bind the token to
 * @returns CSRF token string
 */
export function generateCsrfToken(sessionId: string): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  
  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET not configured - cannot generate CSRF token");
  }

  // Create HMAC with session ID and a timestamp for freshness
  const timestamp = Date.now().toString();
  const payload = `${sessionId}:${timestamp}`;
  
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  
  // Format: timestamp.hmac
  return `${timestamp}.${hmac}`;
}

/**
 * Verify a CSRF token for a given session ID
 * 
 * @param sessionId - The admin session ID to verify against
 * @param token - The CSRF token to verify
 * @returns true if valid, false otherwise
 */
export function verifyCsrfToken(sessionId: string, token: string | null): boolean {
  if (!token) {
    return false;
  }

  const secret = process.env.ADMIN_JWT_SECRET;
  
  if (!secret) {
    // Fail closed - if secret not configured, reject all tokens
    return false;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return false;
    }

    const [timestamp, providedHmac] = parts;
    
    // Verify token is not too old (24 hour expiry)
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge < 0 || tokenAge > 24 * 60 * 60 * 1000) {
      return false;
    }

    // Recompute expected HMAC
    const payload = `${sessionId}:${timestamp}`;
    const expectedHmac = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    
    // Timing-safe comparison
    if (expectedHmac.length !== providedHmac.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedHmac),
      Buffer.from(providedHmac)
    );
  } catch {
    return false;
  }
}
