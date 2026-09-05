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

const app = express();

// 1. Basic Security Headers (lightweight, zero-dep)
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
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
      return callback(new Error(`CORS policy does not allow access from ${origin}`));
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
  express.raw({ type: "*/*", limit: "5mb" }),
  (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
    }
    next();
  }
);

app.use(
  express.json({
    limit: "5mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// 4. Request Logging
app.use(requestLogger);

// 5. Rate Limiting (In-memory, bypasses in test environment)
if (env.NODE_ENV !== "test") {
  app.use("/api", generalLimiter);
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

// 7. Base API Router with Anonymous Session Resolution
app.use("/api", sessionMiddleware, apiRouter);

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
