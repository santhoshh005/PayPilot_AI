import { Request, Response, NextFunction } from "express";
import productService from "../services/productService.js";
import { ListProductsQuery } from "../schemas/product.js";
import { ApiResponse } from "../types/index.js";
import { FormattedProduct, ProductListResult } from "../services/productService.js";

export class ProductController {
  /**
   * GET /api/products
   * List products with search, filtering, sorting, and pagination
   */
  async getProducts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as ListProductsQuery;
      const result = await productService.listProducts(query);

      const response: ApiResponse<ProductListResult> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/products/categories
   * List all categories with product counts
   */
  async getCategories(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const categories = await productService.getCategories();

      const response: ApiResponse<Array<{ category: string; count: number }>> = {
        success: true,
        data: categories,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/products/:id
   * Get complete product specifications and details
   */
  async getProduct(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const product = await productService.getProductById(id);

      const response: ApiResponse<FormattedProduct> = {
        success: true,
        data: product,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const productController = new ProductController();
export default productController;
