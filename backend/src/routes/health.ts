import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.js";
import { ApiResponse, HealthStatus } from "../types/index.js";

const router = Router();

/**
 * GET /api/health
 * Fast health check endpoint verifying process uptime and PostgreSQL connectivity.
 * Times out database probe within 2 seconds to prevent Render health-check hangs.
 */
router.get("/", async (_req: Request, res: Response) => {
  let dbStatus: "connected" | "disconnected" = "connected";

  try {
    // Ultra-lightweight ping with 2-second timeout guard
    const pingPromise = prisma.$queryRaw`SELECT 1;`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database ping timed out after 2000ms")), 2000)
    );

    await Promise.race([pingPromise, timeoutPromise]);
  } catch (error) {
    dbStatus = "disconnected";
    console.warn("[Health] Database ping failed or timed out:", (error as Error).message);
  }

  const overallStatus = dbStatus === "connected" ? "ok" : "degraded";

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
