import { Router } from "express";
import checkoutController from "../controllers/checkoutController.js";
import { validate } from "../middleware/validate.js";
import { createCheckoutOrderBodySchema } from "../schemas/checkout.js";
import { sensitiveLimiter } from "../middleware/rateLimiter.js";
import { env } from "../config/env.js";

const router = Router();

/**
 * POST /api/checkout/order
 * Creates a server-authoritative Razorpay Test Mode order for the active session's cart
 */
router.post(
  "/order",
  ...(env.NODE_ENV !== "test" ? [sensitiveLimiter] : []),
  validate({ body: createCheckoutOrderBodySchema }),
  checkoutController.createOrder
);

export default router;
