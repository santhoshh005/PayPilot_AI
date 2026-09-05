import prisma from "../lib/prisma.js";
import { CartResponse, CartItemResponse } from "../schemas/cart.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../utils/errors.js";

const MAX_QUANTITY_PER_ITEM = 10;

export class CartService {
  /**
   * Helper: Resolves or creates a cart record for the given anonymous session.
   */
  private async getOrCreateCart(sessionId: string) {
    let cart = await prisma.cart.findUnique({
      where: { sessionId },
    });

    if (!cart) {
      // Create cart for this session
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
    let subtotalCents = 0; // Using integer calculation to avoid floating point drift
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
   * Retrieves the authoritative cart for a session.
   */
  async getCart(sessionId: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(sessionId);

    const items = await prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: { product: true },
      orderBy: { id: "asc" },
    });

    return this.formatCart(items);
  }

  /**
   * Adds a product to the session's cart.
   * - Validates existence and stock in PostgreSQL.
   * - If item already exists, increments quantity (capped at MAX_QUANTITY_PER_ITEM).
   * - Returns authoritative cart state.
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

    // 1. Authoritative verification of product in PostgreSQL
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID "${productId}" does not exist`);
    }

    if (!product.inStock) {
      throw new ValidationError(`Product "${product.name}" is currently out of stock`);
    }

    // 2. Resolve cart
    const cart = await this.getOrCreateCart(sessionId);

    // 3. Atomically upsert cart item
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
  }

  /**
   * Removes an item from the session's cart.
   */
  async removeItem(sessionId: string, productId: string): Promise<CartResponse> {
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
  }

  /**
   * Clears all items from the session's cart.
   */
  async clearCart(sessionId: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(sessionId);

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return {
      items: [],
      itemCount: 0,
      subtotal: 0,
    };
  }
}

export const cartService = new CartService();
export default cartService;
