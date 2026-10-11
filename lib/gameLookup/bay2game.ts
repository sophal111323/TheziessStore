/**
 * lib/gameLookup/bay2game.ts
 *
 * Bay2Game Game ID Validation & Player Lookup Provider
 * Documentation: https://bay2game.xyz/developer_docs/validation-check/
 *
 * Features:
 * - Real-time Player ID checking across supported games (MLBB, Free Fire, PUBG Mobile, Blood Strike, Honor of Kings)
 * - Converts internal game slug into verified Bay2Game game code
 * - Validates Server/Zone ID requirements
 * - Applies AbortController timeout protection (10s)
 * - Preserves Roblox official user lookup API separately
 * - Extracts username, region, game title, and normalized status
 */

export type SupportedGameSlug =
  | "mobile-legends"
  | "mlbb"
  | "free-fire"
  | "ff-global"
  | "freefire"
  | "freefire-indo"
  | "pubg-mobile"
  | "pubgm"
  | "blood-strike"
  | "bloodstrike"
  | "honor-of-king"
  | "honor-of-kings"
  | "hok"
  | "magic-chess"
  | "knives-out"
  | "farlight84"
  | "ro-blox"
  | "roblox";

export type GameLookupConfig = {
  bay2GameCode?: string;
  needsServer: boolean;
  useRoblox?: boolean;
  gameTitle: string;
};

export const GAME_LOOKUP_CONFIG: Record<string, GameLookupConfig> = {
  // Mobile Legends (Bang Bang) — requires server/zone id
  "mobile-legends": {
    bay2GameCode: "mlbb",
    needsServer: true,
    gameTitle: "Mobile Legends: Bang Bang",
  },
  "mlbb": {
    bay2GameCode: "mlbb",
    needsServer: true,
    gameTitle: "Mobile Legends: Bang Bang",
  },

  // Garena Free Fire — primary cluster bd/sg for Cambodia/SEA
  "free-fire": {
    bay2GameCode: "freefire_bd",
    needsServer: false,
    gameTitle: "Garena Free Fire",
  },
  "ff-global": {
    bay2GameCode: "freefire_bd",
    needsServer: false,
    gameTitle: "Garena Free Fire",
  },
  "freefire": {
    bay2GameCode: "freefire_bd",
    needsServer: false,
    gameTitle: "Garena Free Fire",
  },
  "freefire-indo": {
    bay2GameCode: "freefire_id",
    needsServer: false,
    gameTitle: "Free Fire Indonesia",
  },

  // PUBG Mobile — no server/zone id needed
  "pubg-mobile": {
    bay2GameCode: "pubgm",
    needsServer: false,
    gameTitle: "PUBG Mobile",
  },
  "pubgm": {
    bay2GameCode: "pubgm",
    needsServer: false,
    gameTitle: "PUBG Mobile",
  },

  // Blood Strike — no server/zone id needed
  "blood-strike": {
    bay2GameCode: "bloodstrike",
    needsServer: false,
    gameTitle: "Blood Strike",
  },
  "bloodstrike": {
    bay2GameCode: "bloodstrike",
    needsServer: false,
    gameTitle: "Blood Strike",
  },

  // Honor of Kings — no server/zone id needed
  "honor-of-king": {
    bay2GameCode: "hok",
    needsServer: false,
    gameTitle: "Honor of Kings",
  },
  "honor-of-kings": {
    bay2GameCode: "hok",
    needsServer: false,
    gameTitle: "Honor of Kings",
  },
  "hok": {
    bay2GameCode: "hok",
    needsServer: false,
    gameTitle: "Honor of Kings",
  },

  // Magic Chess Go Go
  "magic-chess": {
    bay2GameCode: "magic_chest_gogo",
    needsServer: true,
    gameTitle: "Magic Chess Go Go",
  },

  // Knives Out
  "knives-out": {
    bay2GameCode: "knivesout",
    needsServer: true,
    gameTitle: "Knives Out",
  },

  // Farlight 84
  "farlight84": {
    bay2GameCode: "farlight84",
    needsServer: false,
    gameTitle: "Farlight 84",
  },

  // Roblox — preserved separately using official Roblox API
  "ro-blox": {
    needsServer: false,
    useRoblox: true,
    gameTitle: "Roblox",
  },
  "roblox": {
    needsServer: false,
    useRoblox: true,
    gameTitle: "Roblox",
  },
};

export function getGameLookupConfig(gameSlug: string): GameLookupConfig | null {
  if (!gameSlug || typeof gameSlug !== "string") return null;
  const normalized = gameSlug.trim().toLowerCase();
  return GAME_LOOKUP_CONFIG[normalized] ?? null;
}

export type GameLookupResult = {
  success: boolean;
  username: string | null;
  region?: string | null;
  game?: string | null;
  error?: string;
};

interface Bay2GameCheckIdResponse {
  status?: string;
  message?: string;
  username?: string | null;
  region?: string | null;
  game_title?: string | null;
  timestamp?: string;
  developer?: string;
}

const BAY2GAME_CHECKID_BASE = (
  process.env.BAY2GAME_CHECKID_BASE_URL || "https://checkid.bay2game.xyz"
)
  .trim()
  .replace(/\/+$/, "");

/**
 * Official Roblox API lookup for User ID validation
 */
async function lookupRoblox(uid: string): Promise<GameLookupResult> {
  const cleanUid = uid.trim();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    const res = await fetch(
      `https://users.roblox.com/v1/users/${encodeURIComponent(cleanUid)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "DYTOPUP/1.0",
        },
        cache: "no-store",
        signal: controller.signal,
      }
    );

    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        username: null,
        error: "Player not found — check your ID",
      };
    }

    const data = (await res.json().catch(() => null)) as {
      name?: unknown;
      displayName?: unknown;
    } | null;

    const nickname =
      typeof data?.name === "string" && data.name.trim().length > 0
        ? data.name.trim()
        : typeof data?.displayName === "string" && data.displayName.trim().length > 0
        ? data.displayName.trim()
        : null;

    if (!nickname || nickname.toLowerCase() === cleanUid.toLowerCase()) {
      return {
        success: false,
        username: null,
        error: "Player not found — check your ID",
      };
    }

    return {
      success: true,
      username: nickname,
      game: "Roblox",
    };
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
    return {
      success: false,
      username: null,
      error: isTimeout
        ? "ID check timed out. Please try again."
        : "Unable to validate player ID. Please try again.",
    };
  }
}

/**
 * Resolves ordered list of Bay2Game candidate codes to query, including regional fallbacks.
 */
function getCandidateCodes(gameSlug: string, explicitCode?: string): string[] {
  const codes: string[] = [];

  if (explicitCode) {
    codes.push(explicitCode);
  }

  const cfg = getGameLookupConfig(gameSlug);
  if (cfg?.bay2GameCode && !codes.includes(cfg.bay2GameCode)) {
    codes.push(cfg.bay2GameCode);
  }

  // Free Fire regional fallback chain: bd (fastest for KH/SG/BD) -> sgmy -> global
  const isFreeFire =
    gameSlug === "free-fire" ||
    gameSlug === "ff-global" ||
    gameSlug === "freefire" ||
    codes.some((c) => c.startsWith("freefire"));

  if (isFreeFire) {
    const ffFallbacks = ["freefire_bd", "freefire_sgmy", "freefire_global"];
    for (const code of ffFallbacks) {
      if (!codes.includes(code)) {
        codes.push(code);
      }
    }
  }

  return codes;
}

/**
 * Single upstream call to Bay2Game API with timeout
 */
async function queryBay2GameSingle(
  gameCode: string,
  uid: string,
  serverId?: string,
  timeoutMs = 6_000
): Promise<{ success: boolean; data?: Bay2GameCheckIdResponse | null; error?: string }> {
  const url = new URL(`${BAY2GAME_CHECKID_BASE}/check_id`);
  url.searchParams.set("game", gameCode);
  url.searchParams.set("userid", uid);
  if (serverId) {
    url.searchParams.set("serverid", serverId);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "DYTOPUP/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const data = (await res.json().catch(() => null)) as Bay2GameCheckIdResponse | null;
    return { success: true, data };
  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
    return {
      success: false,
      error: isTimeout ? "Timeout" : err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Validates a Player ID and returns nickname, region, and game title using Bay2Game ID Checker API.
 * Includes intelligent regional fallback for games like Free Fire.
 *
 * @param gameSlug Internal game slug (e.g., "mobile-legends", "free-fire", "pubg-mobile")
 * @param uid Player User ID
 * @param serverId Optional Server/Zone ID (required for games like Mobile Legends)
 * @param overrideGameCode Optional explicit game code override
 */
export async function lookupBay2GameNickname(
  gameSlug: string,
  uid: string,
  serverId?: string,
  overrideGameCode?: string | null
): Promise<GameLookupResult> {
  const cleanSlug = (gameSlug || "").trim().toLowerCase();
  const cleanUid = (uid || "").trim();
  const cleanServerId = (serverId || "").trim();
  const explicitCode = (overrideGameCode || "").trim();

  const cfg = getGameLookupConfig(cleanSlug);

  // Roblox uses official Roblox API
  if (cfg?.useRoblox) {
    return lookupRoblox(cleanUid);
  }

  const candidateCodes = getCandidateCodes(cleanSlug, explicitCode);

  if (candidateCodes.length === 0) {
    return {
      success: false,
      username: null,
      error: "Unsupported game",
    };
  }

  const needsServer = cfg ? cfg.needsServer : Boolean(cleanServerId);
  if (needsServer && !cleanServerId) {
    return {
      success: false,
      username: null,
      error: "Server ID is required",
    };
  }

  const deadline = Date.now() + 10_000;
  let lastErrorMessage = "Player not found — check your ID";

  for (let i = 0; i < candidateCodes.length; i++) {
    const code = candidateCodes[i];
    const timeLeft = deadline - Date.now();
    if (timeLeft < 1_500 && i > 0) {
      break;
    }

    const attemptTimeout = Math.min(6_000, Math.max(2_000, timeLeft));
    const result = await queryBay2GameSingle(
      code,
      cleanUid,
      cleanServerId || undefined,
      attemptTimeout
    );

    if (!result.success) {
      if (result.error === "Timeout") {
        lastErrorMessage = "ID check timed out. Please try again.";
      }
      continue;
    }

    const data = result.data;
    if (!data || typeof data !== "object") {
      continue;
    }

    // Success response verification
    if (
      data.status === "APPROVED" &&
      typeof data.username === "string" &&
      data.username.trim().length > 0
    ) {
      const username = data.username.trim();

      // If upstream echoes the UID back instead of a real nickname
      if (username.toLowerCase() === cleanUid.toLowerCase()) {
        lastErrorMessage = "Player not found — check your ID";
        continue;
      }

      return {
        success: true,
        username,
        region: typeof data.region === "string" && data.region.trim() ? data.region.trim() : null,
        game:
          cfg?.gameTitle ||
          (typeof data.game_title === "string" &&
          data.game_title.trim() &&
          data.game_title !== "null"
            ? data.game_title.trim()
            : code),
      };
    }

    // Process error response messages
    const rawMessage = typeof data.message === "string" ? data.message.toLowerCase() : "";
    if (rawMessage.includes("not support region")) {
      lastErrorMessage = "Not supported in this region";
    } else if (rawMessage.includes("invalid game code") || rawMessage.includes("game is inactive")) {
      lastErrorMessage = "Unsupported game";
    } else if (rawMessage.includes("user not found") || rawMessage.includes("invalid")) {
      lastErrorMessage = "Player not found — check your ID";
    }
  }

  return {
    success: false,
    username: null,
    error: lastErrorMessage,
  };
}

/**
 * Backward-compatible helper returning username or null
 */
export async function lookupGameNickname(
  gameSlug: string,
  uid: string,
  serverId?: string
): Promise<string | null> {
  const result = await lookupBay2GameNickname(gameSlug, uid, serverId);
  return result.success ? result.username : null;
}

