import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.js";
import { ApiResponse, HealthStatus } from "../types/index.js";

const router = Router();

/**
 * GET /api/health
 * Lightweight health check endpoint verifying process uptime and PostgreSQL connectivity.
 */
router.get("/", async (_req: Request, res: Response) => {
  let dbStatus: "connected" | "disconnected" = "connected";

  try {
    // Ultra-lightweight ping to verify database pool connection
    await prisma.$queryRaw`SELECT 1;`;
  } catch (error) {
    dbStatus = "disconnected";
    console.warn("[Health] Database ping failed:", (error as Error).message);
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

  const statusCode = overallStatus === "ok" ? 200 : 503;
  res.status(statusCode).json(responseData);
});

export default router;
