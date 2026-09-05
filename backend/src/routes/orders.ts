import { Router } from "express";
import orderController from "../controllers/orderController.js";
import { validate } from "../middleware/validate.js";
import { listOrdersQuerySchema, orderIdParamSchema } from "../schemas/order.js";

const router = Router();

/**
 * GET /api/orders
 * Returns paginated orders belonging to the current session
 */
router.get(
  "/",
  validate({ query: listOrdersQuerySchema }),
  orderController.listOrders
);

/**
 * GET /api/orders/:orderId
 * Returns complete order details with authorization checks
 */
router.get(
  "/:orderId",
  validate({ params: orderIdParamSchema }),
  orderController.getOrderById
);

export default router;
