import { Request, Response, NextFunction } from "express";
import { NotFoundError } from "../utils/errors.js";

/**
 * 404 Handler for undefined API routes.
 * Returns consistent structured JSON error responses instead of HTML error pages.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
}

export default notFoundHandler;
