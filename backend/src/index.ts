import express, { Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import prisma from "./lib/prisma.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { generalLimiter } from "./middleware/rateLimiter.js";
import { sessionMiddleware } from "./middleware/session.js";
import apiRouter from "./routes/index.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ForbiddenError } from "./utils/errors.js";

const app = express();

// Behind Render's proxy: trust one hop so rate limiting keys on the real client IP
app.set("trust proxy", 1);
app.disable("x-powered-by");

// 1. Basic Security Headers (lightweight, zero-dep)
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});

// 2. CORS Configuration
const configuredOrigins = (env.FRONTEND_URL || "")
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/$/, "");
      if (
        allowedOrigins.has(normalizedOrigin) ||
        /^https:\/\/[a-zA-Z0-9-]+-santhoshh005s-projects\.vercel\.app$/.test(normalizedOrigin) ||
        /^https:\/\/paypilot[a-zA-Z0-9-]*\.vercel\.app$/.test(normalizedOrigin)
      ) {
        return callback(null, true);
      }
      return callback(new ForbiddenError("Origin not allowed by CORS policy"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Session-Id", "Authorization"],
    exposedHeaders: ["X-Session-Id"],
  })
);

// 3. Body Parsers with Safe Size Limits & Raw Webhook Buffer Preservation
app.use(
  "/api/payment/webhook",
  express.raw({ type: "*/*", limit: "1mb" }),
  (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
    }
    next();
  }
);

app.use(
  express.json({
    limit: "1mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 4. Request Logging
app.use(requestLogger);

// 5. Rate Limiting (In-memory, bypasses in test environment).
// Applied globally because the API router is also mounted at the root path below.
if (env.NODE_ENV !== "test") {
  app.use(generalLimiter);
}

// 6. Root Informational Endpoint
app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "PayPilot AI API",
    description: "Agentic Commerce & Payment Assistant Backend",
    version: "1.0.0",
    status: "online",
    documentation: "/api/health",
  });
});

// 7. Base API Router with Anonymous Session Resolution (supports both /api/* and root /* routes)
app.use("/api", sessionMiddleware, apiRouter);
app.use(sessionMiddleware, apiRouter);

// 8. 404 Handler for Unmatched Routes
app.use(notFoundHandler);

// 9. Centralized Error Handling Middleware
app.use(errorHandler);

// 10. Server Lifecycle & Graceful Shutdown
let server: ReturnType<typeof app.listen> | null = null;

if (env.NODE_ENV !== "test") {
  server = app.listen(env.PORT, () => {
    console.log(`🚀 [PayPilot AI Backend] Running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
  });

  const handleShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);
    if (server) {
      server.close(() => {
        console.log("🔒 HTTP server closed.");
      });
    }
    try {
      await prisma.$disconnect();
      console.log("🗄️ Database disconnected cleanly.");
      process.exit(0);
    } catch (err) {
      console.error("❌ Error during database disconnect:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

export default app;
