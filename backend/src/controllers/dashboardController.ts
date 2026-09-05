import { Request, Response, NextFunction } from "express";
import { dashboardQuerySchema } from "../schemas/dashboard.js";
import { dashboardService } from "../services/dashboardService.js";

export class DashboardController {
  /**
   * GET /api/dashboard/summary
   * Returns aggregate revenue, order counts, AOV, top products, and daily sales trends.
   */
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedQuery = dashboardQuerySchema.parse(req.query);
      const summary = await dashboardService.getSummary(parsedQuery.range);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
export default dashboardController;
