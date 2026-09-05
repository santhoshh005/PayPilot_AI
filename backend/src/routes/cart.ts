import { Router } from "express";
import cartController from "../controllers/cartController.js";
import { validate } from "../middleware/validate.js";
import {
  addItemSchema,
  updateItemSchema,
  productIdParamSchema,
} from "../schemas/cart.js";

const router = Router();

/**
 * GET /api/cart
 * Fetch current user's cart
 */
router.get("/", cartController.getCart);

/**
 * POST /api/cart/items
 * Add an item to the cart
 */
router.post(
  "/items",
  validate({ body: addItemSchema }),
  cartController.addItem
);

/**
 * PATCH /api/cart/items/:productId
 * Update quantity of a cart item
 */
router.patch(
  "/items/:productId",
  validate({ params: productIdParamSchema, body: updateItemSchema }),
  cartController.updateItem
);

/**
 * DELETE /api/cart/items/:productId
 * Remove a product from the cart
 */
router.delete(
  "/items/:productId",
  validate({ params: productIdParamSchema }),
  cartController.removeItem
);

/**
 * DELETE /api/cart
 * Clear entire cart
 */
router.delete("/", cartController.clearCart);

export default router;
