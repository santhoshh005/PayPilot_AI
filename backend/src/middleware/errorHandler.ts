import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { env } from "../config/env.js";

/**
 * Global centralized error handling middleware.
 * Ensures all API errors conform to the standard error response envelope.
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // 1. If it's a known operational AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // 2. If it's an unhandled Zod validation error
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
      rule: issue.code,
    }));

    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details,
      },
    });
    return;
  }

  // 3. If it's a JSON syntax error from express.json()
  if (err instanceof SyntaxError && "status" in err && (err as { status: number }).status === 400) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON payload provided in request body",
      },
    });
    return;
  }

  // 4. Unknown/Internal errors
  // Safe logging (never log req.headers authorization or body secrets)
  console.error(`[Error] Unhandled Exception at ${req.method} ${req.originalUrl}:`, {
    name: err.name,
    message: err.message,
    stack: env.NODE_ENV !== "production" ? err.stack : undefined,
  });

  const message =
    env.NODE_ENV === "production"
      ? "An unexpected internal server error occurred"
      : err.message || "Internal server error";

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message,
      ...(env.NODE_ENV !== "production" && err.stack ? { details: err.stack } : {}),
    },
  });
}

export default errorHandler;
