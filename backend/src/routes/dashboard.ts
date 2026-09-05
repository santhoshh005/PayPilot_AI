import { Router } from "express";
import { dashboardController } from "../controllers/dashboardController.js";

export const dashboardRouter = Router();

/**
 * GET /api/dashboard/summary
 * Aggregate business and growth metrics (range: 7d | 30d | 90d)
 */
dashboardRouter.get("/summary", (req, res, next) => {
  dashboardController.getSummary(req, res, next);
});

export default dashboardRouter;
