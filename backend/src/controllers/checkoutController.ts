import { Request, Response, NextFunction } from "express";
import checkoutService from "../services/checkoutService.js";
import { ApiResponse } from "../types/index.js";
import { CheckoutOrderResponse } from "../schemas/checkout.js";

export class CheckoutController {
  /**
   * POST /api/checkout/order
   * Create a server-authoritative Razorpay order backed by an internal Order record
   */
  async createOrder(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const sessionId = req.sessionId;
      const order = await checkoutService.createCheckoutOrder(sessionId);

      const response: ApiResponse<CheckoutOrderResponse> = {
        success: true,
        data: order,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const checkoutController = new CheckoutController();
export default checkoutController;
