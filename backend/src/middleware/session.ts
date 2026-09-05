import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";

const uuidSchema = z.string().uuid();

export const SESSION_HEADER = "x-session-id";

/**
 * Anonymous Session Resolution Middleware.
 * Resolves an existing Session from the database using the X-Session-Id header,
 * or automatically provisions and persists a new Session record in PostgreSQL.
 */
export async function sessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip session resolution for server-to-server webhook endpoints
    if (req.path === "/payment/webhook" || req.originalUrl?.includes("/payment/webhook")) {
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

    // 1. If valid format provided, attempt to locate existing session in PostgreSQL
    if (validSessionId) {
      const existingSession = await prisma.session.findUnique({
        where: { id: validSessionId },
      });

      if (existingSession) {
        req.sessionId = existingSession.id;
        req.sessionRecord = existingSession;
        res.setHeader(SESSION_HEADER, existingSession.id);
        return next();
      }
    }

    // 2. No valid session found or none provided -> create new anonymous Session
    const newSession = await prisma.session.create({
      data: {},
    });

    req.sessionId = newSession.id;
    req.sessionRecord = newSession;
    res.setHeader(SESSION_HEADER, newSession.id);

    next();
  } catch (error) {
    next(error);
  }
}

export default sessionMiddleware;
