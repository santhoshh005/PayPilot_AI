/**
 * Base custom application error with HTTP status codes and machine-readable error codes
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_ERROR",
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Requested resource not found", details?: unknown) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication or session required", details?: unknown) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access to requested resource is forbidden", details?: unknown) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict with existing resource", details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.", details?: unknown) {
    super(message, 429, "RATE_LIMITED", details);
  }
}

export class InternalError extends AppError {
  constructor(message = "An internal server error occurred", details?: unknown) {
    super(message, 500, "INTERNAL_ERROR", details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = "External service failure", details?: unknown) {
    super(message, 502, "BAD_GATEWAY", details);
  }
}

