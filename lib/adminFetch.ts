/**
 * Admin API Client with CSRF Token Support
 * 
 * Automatically includes X-CSRF-Token header on all mutating requests.
 * Use this instead of raw fetch() in admin frontend code.
 */

const CSRF_ERROR_MESSAGE = "CSRF token missing or invalid";

let cachedCsrfToken: string | null = null;
// Shared in-flight request so concurrent mutations fetch the token only once.
let pendingCsrfToken: Promise<string> | null = null;

async function requestCsrfToken(): Promise<string> {
  try {
    const res = await fetch("/api/admin/auth/session", {
      credentials: "include",
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (typeof data?.csrfToken === "string" && data.csrfToken) {
        cachedCsrfToken = data.csrfToken;
        return data.csrfToken;
      }
    }
  } catch (err) {
    console.error("Failed to fetch CSRF token:", err);
  }

  return "";
}

/**
 * Fetch and cache CSRF token from server
 */
async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  if (!pendingCsrfToken) {
    pendingCsrfToken = requestCsrfToken().finally(() => {
      pendingCsrfToken = null;
    });
  }

  return pendingCsrfToken;
}

/**
 * Clear cached CSRF token (call after logout)
 */
export function clearCsrfToken() {
  cachedCsrfToken = null;
}

async function isCsrfRejection(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  try {
    const data = await res.clone().json();
    return data?.error === CSRF_ERROR_MESSAGE;
  } catch {
    return false;
  }
}

async function sendWithCsrf(url: string, options: RequestInit | undefined, csrfToken: string) {
  const headers = new Headers(options?.headers || {});
  if (csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}

/**
 * Admin fetch wrapper with automatic CSRF token injection
 * 
 * @param url - API endpoint URL
 * @param options - Standard fetch options
 * @returns fetch Response
 */
export async function adminFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const method = (options?.method || "GET").toUpperCase();
  const isStateMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  // Add CSRF token for mutating requests
  if (isStateMutating) {
    const res = await sendWithCsrf(url, options, await getCsrfToken());

    // Token may have expired (24h) or belong to a previous session: refresh once.
    if (await isCsrfRejection(res)) {
      clearCsrfToken();
      return sendWithCsrf(url, options, await getCsrfToken());
    }

    return res;
  }

  // GET/HEAD requests don't need CSRF token
  return fetch(url, {
    ...options,
    credentials: "include",
  });
}
