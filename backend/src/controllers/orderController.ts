import { Request, Response, NextFunction } from "express";
import orderService from "../services/orderService.js";
import { ApiResponse } from "../types/index.js";
import { OrderListResult, OrderDetailDto } from "../schemas/order.js";

export class OrderController {
  /**
   * GET /api/orders
   * Retrieves paginated order history for the current authenticated session
   */
  async listOrders(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const sessionId = req.sessionId;
      const result = await orderService.listOrders(sessionId, req.query as any);

      const response: ApiResponse<OrderListResult> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/orders/:orderId
   * Retrieves detailed order info strictly for the current authenticated session
   */
  async getOrderById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const sessionId = req.sessionId;
      const { orderId } = req.params;
      const result = await orderService.getOrderById(sessionId, orderId);

      const response: ApiResponse<OrderDetailDto> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();
export default orderController;
