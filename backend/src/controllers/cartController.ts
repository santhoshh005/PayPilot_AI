import { Request, Response, NextFunction } from "express";
import cartService from "../services/cartService.js";
import { AddItemBody, UpdateItemBody, ProductIdParam, CartResponse } from "../schemas/cart.js";
import { ApiResponse } from "../types/index.js";

export class CartController {
  /**
   * GET /api/cart
   * Retrieve the authoritative cart for the current session
   */
  async getCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.sessionId;
      const cart = await cartService.getCart(sessionId);

      const response: ApiResponse<CartResponse> = {
        success: true,
        data: cart,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/cart/items
   * Add a product to the cart with server-calculated totals
   */
  async addItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.sessionId;
      const { productId, quantity } = req.body as AddItemBody;

      const cart = await cartService.addItem(sessionId, productId, quantity);

      const response: ApiResponse<CartResponse> = {
        success: true,
        data: cart,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/cart/items/:productId
   * Update quantity of an item in the cart
   */
  async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.sessionId;
      const { productId } = req.params as ProductIdParam;
      const { quantity } = req.body as UpdateItemBody;

      const cart = await cartService.updateItem(sessionId, productId, quantity);

      const response: ApiResponse<CartResponse> = {
        success: true,
        data: cart,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/cart/items/:productId
   * Remove an item from the cart
   */
  async removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.sessionId;
      const { productId } = req.params as ProductIdParam;

      const cart = await cartService.removeItem(sessionId, productId);

      const response: ApiResponse<CartResponse> = {
        success: true,
        data: cart,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/cart
   * Clear all items from the cart
   */
  async clearCart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.sessionId;
      const cart = await cartService.clearCart(sessionId);

      const response: ApiResponse<CartResponse> = {
        success: true,
        data: cart,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const cartController = new CartController();
export default cartController;
