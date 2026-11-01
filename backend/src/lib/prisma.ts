import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn"] : ["warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Circuit breaker state to prevent multi-second connection hangs when database is paused or unreachable
let isDbKnownOffline = false;
let lastDbCheckTime = 0;
const DB_RETRY_INTERVAL_MS = 30000; // Check database every 30 seconds

export function isDatabaseHealthy(): boolean {
  if (!isDbKnownOffline) return true;
  // If cooldown passed, allow a probe attempt
  if (Date.now() - lastDbCheckTime > DB_RETRY_INTERVAL_MS) {
    return true;
  }
  return false;
}

export function markDatabaseOffline(reason?: string): void {
  if (!isDbKnownOffline) {
    console.warn(
      `[Database] Circuit breaker tripped: database marked offline for ${
        DB_RETRY_INTERVAL_MS / 1000
      }s. Reason: ${reason || "unknown"}`
    );
  }
  isDbKnownOffline = true;
  lastDbCheckTime = Date.now();
}

export function markDatabaseOnline(): void {
  if (isDbKnownOffline) {
    console.info("[Database] Circuit breaker reset: database is back online!");
  }
  isDbKnownOffline = false;
  lastDbCheckTime = 0;
}

export default prisma;
