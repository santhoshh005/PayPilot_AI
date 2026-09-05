import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import express, { Request, Response } from "express";
import { z } from "zod";
import app from "../index.js";
import prisma from "../lib/prisma.js";
import { validate } from "../middleware/validate.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { ConflictError, UnauthorizedError } from "../utils/errors.js";

describe("Phase 2: Backend Foundation", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("1. Anonymous Session Management", () => {
    it("should provision a new UUID session if no X-Session-Id header is provided", async () => {
      const res = await request(app).get("/api/session");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toBeDefined();

      const newSessionId = res.body.data.sessionId;
      // Verify UUID v4 pattern
      expect(newSessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      // Verify header is set on the response
      expect(res.headers["x-session-id"]).toBe(newSessionId);

      // Verify the session actually persists in PostgreSQL
      const dbSession = await prisma.session.findUnique({
        where: { id: newSessionId },
      });
      expect(dbSession).toBeDefined();
      expect(dbSession?.id).toBe(newSessionId);
    });

    it("should reuse the existing session when a valid X-Session-Id is provided", async () => {
      // Step 1: Create an initial session
      const firstRes = await request(app).get("/api/session");
      const existingSessionId = firstRes.body.data.sessionId;

      // Step 2: Use the existing session ID in a subsequent request
      const secondRes = await request(app)
        .get("/api/session")
        .set("x-session-id", existingSessionId);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.data.sessionId).toBe(existingSessionId);
      expect(secondRes.headers["x-session-id"]).toBe(existingSessionId);
    });

    it("should create a fresh session if an invalid or non-existent session ID is provided", async () => {
      const fakeId = "00000000-0000-4000-a000-000000000000";
      const res = await request(app)
        .get("/api/session")
        .set("x-session-id", fakeId);

      expect(res.status).toBe(200);
      expect(res.body.data.sessionId).not.toBe(fakeId);
    });
  });

  describe("2. Error Handling & 404 Routes", () => {
    it("should return a structured 404 JSON response for unknown routes", async () => {
      const res = await request(app).get("/api/non-existent-route");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(res.body.error.message).toContain("Cannot GET /api/non-existent-route");
    });

    it("should handle custom typed application errors with proper HTTP status codes", async () => {
      const testApp = express();
      testApp.use(express.json());

      testApp.get("/test-conflict", () => {
        throw new ConflictError("Resource already exists in database");
      });

      testApp.get("/test-unauthorized", () => {
        throw new UnauthorizedError("Session expired or missing");
      });

      testApp.use(errorHandler);

      const resConflict = await request(testApp).get("/test-conflict");
      expect(resConflict.status).toBe(409);
      expect(resConflict.body.success).toBe(false);
      expect(resConflict.body.error.code).toBe("CONFLICT");
      expect(resConflict.body.error.message).toBe("Resource already exists in database");

      const resUnauthorized = await request(testApp).get("/test-unauthorized");
      expect(resUnauthorized.status).toBe(401);
      expect(resUnauthorized.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should catch malformed JSON and return 400 INVALID_JSON", async () => {
      const res = await request(app)
        .post("/api/health")
        .set("Content-Type", "application/json")
        .send("{ broken: json, ");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_JSON");
    });
  });

  describe("3. Zod Validation Middleware", () => {
    const testApp = express();
    testApp.use(express.json());

    const testSchema = {
      body: z.object({
        query: z.string().min(3, "Query must be at least 3 characters"),
        budget: z.number().positive("Budget must be positive"),
      }),
      query: z.object({
        limit: z
          .string()
          .optional()
          .transform((v) => (v ? parseInt(v, 10) : 5)),
      }),
    };

    testApp.post(
      "/validate-test",
      validate(testSchema),
      (req: Request, res: Response) => {
        res.json({ success: true, received: { body: req.body, query: req.query } });
      }
    );

    testApp.use(errorHandler);

    it("should accept valid body and query parameters", async () => {
      const res = await request(testApp)
        .post("/validate-test?limit=10")
        .send({ query: "earbuds", budget: 2500 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.received.body.query).toBe("earbuds");
      expect(res.body.received.body.budget).toBe(2500);
      expect(res.body.received.query.limit).toBe(10);
    });

    it("should reject invalid body and return 400 VALIDATION_ERROR with field details", async () => {
      const res = await request(testApp)
        .post("/validate-test")
        .send({ query: "a", budget: -50 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toBeDefined();
      expect(Array.isArray(res.body.error.details)).toBe(true);

      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toContain("query");
      expect(fields).toContain("budget");
    });
  });

  describe("4. CORS Configuration", () => {
    it("should allow requests from the configured frontend URL", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", "http://localhost:5173");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });
  });
});
