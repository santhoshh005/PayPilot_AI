import prisma from "../lib/prisma.js";
import productService from "./productService.js";
import { CartResponse, CartItemResponse } from "../schemas/cart.js";
import {
  NotFoundError,
  ValidationError,
} from "../utils/errors.js";

const MAX_QUANTITY_PER_ITEM = 10;

// In-memory cart store for offline resilience when database is unreachable
const inMemoryCarts = new Map<string, Array<{ productId: string; quantity: number }>>();

export class CartService {
  /**
   * Helper: Resolves or creates a cart record for the given anonymous session.
   */
  private async getOrCreateCart(sessionId: string) {
    let cart = await prisma.cart.findUnique({
      where: { sessionId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { sessionId },
      });
    }

    return cart;
  }

  /**
   * Helper: Formats authoritative cart data from database records.
   * Ensures subtotal and line totals are strictly calculated from database product prices.
   */
  private formatCart(items: Array<{
    quantity: number;
    product: {
      id: string;
      name: string;
      brand: string;
      price: unknown;
      imageUrl: string;
      inStock: boolean;
    };
  }>): CartResponse {
    let subtotalCents = 0;
    let totalItems = 0;

    const formattedItems: CartItemResponse[] = items.map((item) => {
      const priceNum = Number(item.product.price);
      const lineTotalNum = Math.round((priceNum * item.quantity + Number.EPSILON) * 100) / 100;

      subtotalCents += Math.round(lineTotalNum * 100);
      totalItems += item.quantity;

      return {
        productId: item.product.id,
        name: item.product.name,
        brand: item.product.brand,
        price: priceNum,
        quantity: item.quantity,
        lineTotal: lineTotalNum,
        imageUrl: item.product.imageUrl,
        inStock: item.product.inStock,
      };
    });

    return {
      items: formattedItems,
      itemCount: totalItems,
      subtotal: subtotalCents / 100,
    };
  }

  /**
   * Formats an in-memory cart using product details from ProductService.
   */
  private async formatInMemoryCart(sessionId: string): Promise<CartResponse> {
    const rawItems = inMemoryCarts.get(sessionId) || [];
    const populatedItems = [];

    for (const item of rawItems) {
      try {
        const product = await productService.getProductById(item.productId);
        populatedItems.push({
          quantity: item.quantity,
          product: {
            id: product.id,
            name: product.name,
            brand: product.brand,
            price: product.price,
            imageUrl: product.imageUrl,
            inStock: product.inStock,
          },
        });
      } catch {
        // Skip unavailable items
      }
    }

    return this.formatCart(populatedItems);
  }

  /**
   * Retrieves the authoritative cart for a session.
   * Falls back to in-memory cart if database is offline.
   */
  async getCart(sessionId: string): Promise<CartResponse> {
    try {
      const cart = await this.getOrCreateCart(sessionId);

      const items = await prisma.cartItem.findMany({
        where: { cartId: cart.id },
        include: { product: true },
        orderBy: { id: "asc" },
      });

      return this.formatCart(items);
    } catch (error) {
      console.warn(
        `[CartService] Database unavailable for getCart(${sessionId}), using in-memory store:`,
        (error as Error).message
      );
      return this.formatInMemoryCart(sessionId);
    }
  }

  /**
   * Adds a product to the session's cart.
   * - Validates existence and stock in PostgreSQL (or fallback catalog).
   * - If item already exists, increments quantity (capped at MAX_QUANTITY_PER_ITEM).
   */
  async addItem(
    sessionId: string,
    productId: string,
    quantity: number = 1
  ): Promise<CartResponse> {
    if (quantity < 1) {
      throw new ValidationError("Quantity must be at least 1");
    }
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      throw new ValidationError(`Quantity cannot exceed ${MAX_QUANTITY_PER_ITEM} units per item`);
    }

    // 1. Authoritative verification of product
    const product = await productService.getProductById(productId);

    if (!product.inStock) {
      throw new ValidationError(`Product "${product.name}" is currently out of stock`);
    }

    // 2. Try PostgreSQL cart operations
    try {
      const cart = await this.getOrCreateCart(sessionId);

      await prisma.$transaction(async (tx) => {
        const existingItem = await tx.cartItem.findUnique({
          where: {
            cartId_productId: {
              cartId: cart.id,
              productId: product.id,
            },
          },
        });

        if (existingItem) {
          const newQuantity = existingItem.quantity + quantity;
          if (newQuantity > MAX_QUANTITY_PER_ITEM) {
            throw new ValidationError(
              `Cannot add ${quantity} more units. Maximum cart limit of ${MAX_QUANTITY_PER_ITEM} would be exceeded.`
            );
          }

          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQuantity },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId: product.id,
              quantity,
            },
          });
        }
      });

      return this.getCart(sessionId);
    } catch (dbError) {
      if (dbError instanceof ValidationError) throw dbError;

      console.warn(
        `[CartService] Database error on addItem, updating in-memory cart:`,
        (dbError as Error).message
      );

      // In-memory cart update
      const items = inMemoryCarts.get(sessionId) || [];
      const existing = items.find((i) => i.productId === product.id);

      if (existing) {
        const newQty = existing.quantity + quantity;
        if (newQty > MAX_QUANTITY_PER_ITEM) {
          throw new ValidationError(
            `Cannot add ${quantity} more units. Maximum cart limit of ${MAX_QUANTITY_PER_ITEM} would be exceeded.`
          );
        }
        existing.quantity = newQty;
      } else {
        items.push({ productId: product.id, quantity });
      }

      inMemoryCarts.set(sessionId, items);
      return this.formatInMemoryCart(sessionId);
    }
  }

  /**
   * Updates the exact quantity of an existing item in the cart.
   */
  async updateItem(
    sessionId: string,
    productId: string,
    quantity: number
  ): Promise<CartResponse> {
    if (quantity < 1) {
      throw new ValidationError("Quantity must be at least 1");
    }
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      throw new ValidationError(`Quantity cannot exceed ${MAX_QUANTITY_PER_ITEM} units per item`);
    }

    try {
      const cart = await this.getOrCreateCart(sessionId);

      const existingItem = await prisma.cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId,
          },
        },
      });

      if (!existingItem) {
        throw new NotFoundError("Item not found in cart");
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity },
      });

      return this.getCart(sessionId);
    } catch (dbError) {
      if (dbError instanceof ValidationError || dbError instanceof NotFoundError) {
        throw dbError;
      }

      console.warn(
        `[CartService] Database error on updateItem, updating in-memory cart:`,
        (dbError as Error).message
      );

      const items = inMemoryCarts.get(sessionId) || [];
      const item = items.find((i) => i.productId === productId);
      if (!item) {
        throw new NotFoundError("Item not found in cart");
      }
      item.quantity = quantity;
      return this.formatInMemoryCart(sessionId);
    }
  }

  /**
   * Removes an item from the session's cart.
   */
  async removeItem(sessionId: string, productId: string): Promise<CartResponse> {
    try {
      const cart = await this.getOrCreateCart(sessionId);

      const existingItem = await prisma.cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId,
          },
        },
      });

      if (!existingItem) {
        throw new NotFoundError("Item not found in cart");
      }

      await prisma.cartItem.delete({
        where: { id: existingItem.id },
      });

      return this.getCart(sessionId);
    } catch (dbError) {
      if (dbError instanceof NotFoundError) throw dbError;

      console.warn(
        `[CartService] Database error on removeItem, updating in-memory cart:`,
        (dbError as Error).message
      );

      const items = inMemoryCarts.get(sessionId) || [];
      const index = items.findIndex((i) => i.productId === productId);
      if (index === -1) {
        throw new NotFoundError("Item not found in cart");
      }
      items.splice(index, 1);
      return this.formatInMemoryCart(sessionId);
    }
  }

  /**
   * Clears all items from the session's cart.
   */
  async clearCart(sessionId: string): Promise<CartResponse> {
    try {
      const cart = await this.getOrCreateCart(sessionId);

      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    } catch (dbError) {
      console.warn(
        `[CartService] Database error on clearCart, clearing in-memory cart:`,
        (dbError as Error).message
      );
    }

    inMemoryCarts.set(sessionId, []);

    return {
      items: [],
      itemCount: 0,
      subtotal: 0,
    };
  }
}

export const cartService = new CartService();
export default cartService;
