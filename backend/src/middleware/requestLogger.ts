import { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

/**
 * Lightweight HTTP request logger middleware.
 * Formats structured logs with method, path, status, and execution duration.
 * Strictly avoids logging sensitive headers or payload bodies.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (env.NODE_ENV === "test") {
    return next();
  }

  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color =
      status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : "\x1b[32m";
    const reset = "\x1b[0m";

    console.log(
      `[HTTP] ${req.method} ${req.originalUrl} -> ${color}${status}${reset} (${duration}ms)`
    );
  });

  next();
}

export default requestLogger;
