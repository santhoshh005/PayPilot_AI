import { Router } from "express";
import paymentController from "../controllers/paymentController.js";
import { validate } from "../middleware/validate.js";
import { verifyPaymentBodySchema } from "../schemas/payment.js";
import { sensitiveLimiter } from "../middleware/rateLimiter.js";
import { env } from "../config/env.js";

const router = Router();

/**
 * POST /api/payment/verify
 * Cryptographically verifies Razorpay payment signature and updates order to PAID
 */
router.post(
  "/verify",
  ...(env.NODE_ENV !== "test" ? [sensitiveLimiter] : []),
  validate({ body: verifyPaymentBodySchema }),
  paymentController.verifyPayment
);

/**
 * POST /api/payment/webhook
 * Processes incoming Razorpay webhook events with HMAC-SHA256 signature verification.
 */
router.post(
  "/webhook",
  paymentController.handleWebhook
);

export default router;
