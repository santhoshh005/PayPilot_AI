import { Request, Response, NextFunction } from "express";
import paymentService from "../services/paymentService.js";
import webhookService from "../services/webhookService.js";
import { ApiResponse } from "../types/index.js";
import { PaymentVerificationResponse } from "../schemas/payment.js";

export class PaymentController {
  /**
   * POST /api/payment/verify
   * Securely verifies Razorpay payment signature and marks order as PAID
   */
  async verifyPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const sessionId = req.sessionId;
      const result = await paymentService.verifyPayment(sessionId, req.body);

      const response: ApiResponse<PaymentVerificationResponse> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/payment/webhook
   * Processes server-to-server Razorpay webhook events with HMAC-SHA256 verification
   */
  async handleWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const signatureHeader =
        (req.headers["x-razorpay-signature"] as string | undefined) ||
        (req.headers["X-Razorpay-Signature"] as string | undefined);

      const headerEventId =
        (req.headers["x-razorpay-event-id"] as string | undefined) ||
        (req.headers["X-Razorpay-Event-Id"] as string | undefined);

      // Raw body buffer captured by body-parser verify or express.raw
      const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : undefined);

      const result = await webhookService.processWebhook({
        rawBody,
        signatureHeader,
        headerEventId,
      });

      // Minimal safe response: zero secret or signature leakage
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
export default paymentController;
