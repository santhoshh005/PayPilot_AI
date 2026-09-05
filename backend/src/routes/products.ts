import { Router } from "express";
import productController from "../controllers/productController.js";
import { validate } from "../middleware/validate.js";
import {
  listProductsQuerySchema,
  productIdParamSchema,
} from "../schemas/product.js";

const router = Router();

/**
 * GET /api/products
 * Browse and search catalog with pagination, filters, and sorting
 */
router.get(
  "/",
  validate({ query: listProductsQuerySchema }),
  productController.getProducts
);

/**
 * GET /api/products/categories
 * List all available categories
 */
router.get("/categories", productController.getCategories);

/**
 * GET /api/products/:id
 * Retrieve detailed product specifications
 */
router.get(
  "/:id",
  validate({ params: productIdParamSchema }),
  productController.getProduct
);

export default router;
