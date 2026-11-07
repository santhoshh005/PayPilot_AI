import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import crypto from "crypto";
import prisma, {
  isDatabaseHealthy,
  markDatabaseOffline,
  markDatabaseOnline,
} from "../lib/prisma.js";
import { BoundedMap } from "../utils/boundedMap.js";

const uuidSchema = z.string().uuid();

export const SESSION_HEADER = "x-session-id";

// In-memory fallback session store when database is offline or sleeping
const inMemorySessions = new BoundedMap<
  string,
  { id: string; createdAt: Date; updatedAt: Date }
>(10000);

/**
 * Anonymous Session Resolution Middleware.
 * Resolves an existing Session from PostgreSQL (or in-memory fallback),
 * ensuring requests never crash with 500 when database is offline.
 */
export async function sessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip session resolution for server-to-server webhook endpoints
    if (
      req.path === "/payment/webhook" ||
      req.originalUrl?.includes("/payment/webhook")
    ) {
      return next();
    }

    const rawSessionId = req.headers[SESSION_HEADER] as string | undefined;

    let validSessionId: string | null = null;

    if (rawSessionId) {
      const parsed = uuidSchema.safeParse(rawSessionId.trim());
      if (parsed.success) {
        validSessionId = parsed.data;
      }
    }

    // 1. If valid format provided, attempt to locate existing session in PostgreSQL (if DB healthy)
    if (validSessionId) {
      if (isDatabaseHealthy()) {
        try {
          const existingSession = await prisma.session.findUnique({
            where: { id: validSessionId },
          });

          if (existingSession) {
            markDatabaseOnline();
            req.sessionId = existingSession.id;
            req.sessionRecord = existingSession;
            res.setHeader(SESSION_HEADER, existingSession.id);
            return next();
          }
        } catch (dbError) {
          markDatabaseOffline((dbError as Error).message);
        }
      }

      // Check in-memory store for session
      const memSession = inMemorySessions.get(validSessionId);
      if (memSession) {
        req.sessionId = memSession.id;
        req.sessionRecord = memSession;
        res.setHeader(SESSION_HEADER, memSession.id);
        return next();
      }
    }

    // 2. No valid existing session found -> Provision new anonymous Session in PostgreSQL or memory
    if (isDatabaseHealthy()) {
      try {
        const newSession = await prisma.session.create({
          data: {},
        });

        markDatabaseOnline();
        req.sessionId = newSession.id;
        req.sessionRecord = newSession;
        res.setHeader(SESSION_HEADER, newSession.id);
        return next();
      } catch (dbError) {
        markDatabaseOffline((dbError as Error).message);
      }
    }

    const fallbackId = crypto.randomUUID();
    const fallbackSession = {
      id: fallbackId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemorySessions.set(fallbackId, fallbackSession);
    req.sessionId = fallbackId;
    req.sessionRecord = fallbackSession;
    res.setHeader(SESSION_HEADER, fallbackId);
    return next();
  } catch (error) {
    // Absolute failsafe: never block user traffic on session error
    const fallbackId = crypto.randomUUID();
    const fallbackSession = {
      id: fallbackId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    req.sessionId = fallbackId;
    req.sessionRecord = fallbackSession;
    res.setHeader(SESSION_HEADER, fallbackId);
    next();
  }
}

export default sessionMiddleware;
