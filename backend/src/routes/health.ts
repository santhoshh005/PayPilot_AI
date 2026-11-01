import { Router, Request, Response } from "express";
import prisma, {
  isDatabaseHealthy,
  markDatabaseOffline,
  markDatabaseOnline,
} from "../lib/prisma.js";
import { env } from "../config/env.js";
import { ApiResponse, HealthStatus } from "../types/index.js";

const router = Router();

/**
 * GET /api/health
 * Fast health check endpoint verifying process uptime and PostgreSQL connectivity.
 * Uses a circuit breaker to avoid 2-second timeout hangs when database is offline.
 */
router.get("/", async (_req: Request, res: Response) => {
  let dbStatus: "connected" | "disconnected" = "connected";

  if (!isDatabaseHealthy()) {
    dbStatus = "disconnected";
  } else {
    try {
      // Lightweight ping with 1.5-second timeout guard
      const pingPromise = prisma.$queryRaw`SELECT 1;`;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Database ping timed out after 1500ms")),
          1500
        )
      );

      await Promise.race([pingPromise, timeoutPromise]);
      markDatabaseOnline();
    } catch (error) {
      dbStatus = "disconnected";
      markDatabaseOffline((error as Error).message);
    }
  }

  const overallStatus = "ok";

  const responseData: ApiResponse<HealthStatus> = {
    success: true,
    data: {
      status: overallStatus,
      service: "paypilot-backend",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      database: dbStatus,
    },
  };

  // Return HTTP 200 so container orchestrators (Render) keep the service alive
  // while in-memory fallback handles frontend catalog and AI chat.
  res.status(200).json(responseData);
});

export default router;
