/**
 * Secure error logger for production environments
 * 
 * Logs errors without exposing stack traces, SQL queries, or internal details to logs
 * that might be accessible in production monitoring systems.
 */

interface ErrorWithCode {
  message?: string;
  code?: string;
  name?: string;
}

/**
 * Log an error securely - only logs message and code, never stack traces or query details
 * 
 * @param context - Description of where/what was happening when the error occurred
 * @param error - The error object to log
 */
export function logError(context: string, error: unknown): void {
  // In development, log full error for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${context}]`, error);
    return;
  }

  // In production, sanitize error output - only log safe fields
  const safeError: Record<string, any> = {
    context,
    timestamp: new Date().toISOString(),
  };

  if (error && typeof error === 'object') {
    const err = error as ErrorWithCode;
    
    // Only include message and code - never stack, query, or other internal details
    if (err.message) {
      safeError.message = err.message;
    }
    
    if (err.code) {
      safeError.code = err.code;
    }
    
    if (err.name) {
      safeError.name = err.name;
    }
  } else if (typeof error === 'string') {
    safeError.message = error;
  } else {
    safeError.message = 'Unknown error';
  }

  console.error(JSON.stringify(safeError));
}
