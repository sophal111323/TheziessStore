import "@/lib/env";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Redact database credentials from error logs (FIND-011 fix)
// Intercepts Prisma error events and sanitizes connection strings before logging
if (typeof (prisma as any).$on === "function") {
  (prisma as any).$on("error", (e: any) => {
    if (e && typeof e === "object") {
      const sanitized = JSON.stringify(e, (key, value) => {
        if (typeof value === "string") {
          // Redact connection string credentials: postgresql://user:password@host -> postgresql://***:***@host
          return value.replace(
            /postgresql:\/\/[^:]+:[^@]+@/gi,
            "postgresql://***:***@"
          );
        }
        return value;
      });
      console.error("[Prisma Error - Sanitized]", sanitized);
    } else {
      console.error("[Prisma Error]", e);
    }
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;