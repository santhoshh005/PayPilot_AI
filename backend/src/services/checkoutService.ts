import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.js";
import razorpayService from "./razorpayService.js";
import { rupeesToPaise } from "../utils/money.js";
import { CheckoutOrderResponse } from "../schemas/checkout.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";

export class CheckoutService {
  /**
   * Creates a Razorpay Order in Test Mode backed by a PostgreSQL internal Order record.
   * Calculates authoritative totals from PostgreSQL product prices, snapshots OrderItems,
   * and enforces idempotency / duplicate protection for active carts.
   */
  async createCheckoutOrder(sessionId: string): Promise<CheckoutOrderResponse> {
    // 1. Retrieve the session's cart with products
    const cart = await prisma.cart.findUnique({
      where: { sessionId },
      include: {
        items: {
          include: { product: true },
          orderBy: { id: "asc" },
        },
      },
    });

    // 2. Verify cart exists and is not empty
    if (!cart || cart.items.length === 0) {
      throw new ValidationError("Cannot create order from an empty cart");
    }

    // 3. Authoritative stock and existence verification
    for (const item of cart.items) {
      if (!item.product) {
        throw new NotFoundError(
          `Product with ID "${item.productId}" in your cart no longer exists.`
        );
      }
      if (!item.product.inStock) {
        throw new ValidationError(
          `Product "${item.product.name}" is currently out of stock. Please remove it from your cart to proceed.`
        );
      }
    }

    // 4. Calculate authoritative order total using integer paise arithmetic
    let totalAmountPaise = 0;
    for (const item of cart.items) {
      const unitPaise = rupeesToPaise(item.product.price);
      totalAmountPaise += unitPaise * item.quantity;
    }

    const totalAmountRupees = totalAmountPaise / 100;

    // 5. Idempotency / Duplicate Order Protection:
    // If an identical PENDING order with an active Razorpay order was created in the last 15 minutes,
    // safely reuse it rather than spamming duplicate orders.
    const recentPendingOrder = await prisma.order.findFirst({
      where: {
        sessionId,
        status: "PENDING",
        razorpayOrderId: { not: null },
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000), // 15-minute window
        },
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    if (recentPendingOrder && recentPendingOrder.razorpayOrderId) {
      const orderPaise = rupeesToPaise(recentPendingOrder.totalAmount);

      // Check if item composition and total amount match current cart
      const sameAmount = orderPaise === totalAmountPaise;
      const sameItemCount = recentPendingOrder.items.length === cart.items.length;

      const itemsMatch =
        sameItemCount &&
        cart.items.every((cartItem) => {
          const matchedOrderItem = recentPendingOrder.items.find(
            (oi) => oi.productId === cartItem.productId
          );
          return (
            matchedOrderItem &&
            matchedOrderItem.quantity === cartItem.quantity
          );
        });

      if (sameAmount && itemsMatch) {
        return {
          orderId: recentPendingOrder.id,
          razorpayOrderId: recentPendingOrder.razorpayOrderId,
          amount: totalAmountPaise,
          currency: "INR",
          keyId: env.RAZORPAY_KEY_ID,
        };
      }
    }

    // 6. Generate safe receipt & order ID
    const internalOrderId = crypto.randomUUID();
    const receipt = `rcpt_${internalOrderId.replace(/-/g, "").slice(0, 24)}`;

    // 7. Create Razorpay Order via Razorpay SDK in Test Mode
    const razorpayOrder = await razorpayService.createOrder({
      amount: totalAmountPaise,
      currency: "INR",
      receipt,
      notes: {
        sessionId,
        orderId: internalOrderId,
      },
    });

    // 8. Atomically persist internal Order and OrderItem snapshots in PostgreSQL
    const internalOrder = await prisma.$transaction(
      async (tx) => {
        return tx.order.create({
          data: {
            id: internalOrderId,
            sessionId,
            totalAmount: totalAmountRupees,
            status: "PENDING",
            razorpayOrderId: razorpayOrder.id,
            items: {
              create: cart.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.product.price, // Snapshot of price at creation
              })),
            },
          },
          include: { items: true },
        });
      },
      { maxWait: 10000, timeout: 20000 }
    );

    // Note: In Phase 6, cart remains intact. It is only cleared upon verified payment in Phase 8.

    return {
      orderId: internalOrder.id,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmountPaise,
      currency: "INR",
      keyId: env.RAZORPAY_KEY_ID,
    };
  }
}

export const checkoutService = new CheckoutService();
export default checkoutService;
