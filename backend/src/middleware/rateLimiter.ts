import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

/**
 * General API rate limiter for standard endpoints.
 * 200 requests per 15 minutes window.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.path === "/health" || req.originalUrl?.includes("/health"),
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests from this IP. Please try again later.",
    },
  },
  handler: (_req: Request, res: Response, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Stricter rate limiter for resource-intensive or payment-critical endpoints (AI Chat, Order checkout).
 * 30 requests per minute window.
 */
export const sensitiveLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Rate limit exceeded for this operation. Please slow down.",
    },
  },
  handler: (_req: Request, res: Response, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});
