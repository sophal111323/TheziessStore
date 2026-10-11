/**
 * lib/passwordPolicy.ts — Password strength validation
 *
 * Enforces minimum password requirements for admin accounts:
 * - Minimum 12 characters
 * - Contains lowercase letter
 * - Contains uppercase letter
 * - Contains digit
 * - Contains special character
 */

export type PasswordValidationResult = {
  valid: boolean;
  error?: string;
};

export function validatePasswordStrength(
  password: string
): PasswordValidationResult {
  if (!password || password.length < 12) {
    return {
      valid: false,
      error: "Password must be at least 12 characters",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one lowercase letter",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one uppercase letter",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one digit",
    };
  }

  // Special characters: any non-alphanumeric character
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain at least one special character",
    };
  }

  return { valid: true };
}
