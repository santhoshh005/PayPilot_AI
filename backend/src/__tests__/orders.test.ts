import { describe, it, expect, afterAll, beforeEach } from "vitest";
import request from "supertest";
import crypto from "crypto";
import app from "../index.js";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.js";

describe("Phase 10: Order Management & History API", { timeout: 30000 }, () => {
  let inStockProduct1: { id: string; name: string; price: number };
  let inStockProduct2: { id: string; name: string; price: number };

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const products = await prisma.product.findMany({
      where: { inStock: true },
      take: 2,
    });
    if (products.length < 2) {
      throw new Error("At least two in-stock products required for order tests");
    }
    inStockProduct1 = {
      id: products[0].id,
      name: products[0].name,
      price: Number(products[0].price),
    };
    inStockProduct2 = {
      id: products[1].id,
      name: products[1].name,
      price: Number(products[1].price),
    };
  });

  // Helper to provision a session and create an order with known status and items
  async function createOrderForSession(params?: {
    status?: "PENDING" | "PAID" | "FAILED";
    paidAt?: Date;
    paymentId?: string;
    items?: Array<{ productId: string; quantity: number; price: number }>;
  }) {
    const sessionRes = await request(app).get("/api/session");
    const sessionId = sessionRes.body.data.sessionId;

    const items = params?.items || [
      {
        productId: inStockProduct1.id,
        quantity: 2,
        price: inStockProduct1.price,
      },
    ];

    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const order = await prisma.order.create({
      data: {
        sessionId,
        status: params?.status || "PENDING",
        totalAmount,
        razorpayOrderId: `order_${crypto.randomBytes(8).toString("hex")}`,
        razorpayPaymentId: params?.paymentId || (params?.status === "PAID" ? `pay_${crypto.randomBytes(8).toString("hex")}` : null),
        paidAt: params?.paidAt || (params?.status === "PAID" ? new Date() : null),
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    return { sessionId, order };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Order Listing (GET /api/orders)
  // ──────────────────────────────────────────────────────────────────────────
  describe("1. Order Listing Endpoint (GET /api/orders)", () => {
    it("1. should return only the current session's orders", async () => {
      const { sessionId, order } = await createOrderForSession({ status: "PAID" });

      // Create an order for a completely different session
      await createOrderForSession({ status: "PENDING" });

      const res = await request(app)
        .get("/api/orders")
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.orders)).toBe(true);
      expect(res.body.data.orders.length).toBe(1);
      expect(res.body.data.orders[0].id).toBe(order.id);
      expect(res.body.data.orders[0].currency).toBe("INR");
    });

    it("2. should sort orders newest first (createdAt: desc)", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Create first order
      const order1 = await prisma.order.create({
        data: {
          sessionId,
          status: "PENDING",
          totalAmount: 1000,
          createdAt: new Date(Date.now() - 60000), // 1 minute ago
        },
      });

      // Create second order
      const order2 = await prisma.order.create({
        data: {
          sessionId,
          status: "PAID",
          totalAmount: 2000,
          createdAt: new Date(), // Now
        },
      });

      const res = await request(app)
        .get("/api/orders")
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      const orders = res.body.data.orders;
      expect(orders.length).toBe(2);
      expect(orders[0].id).toBe(order2.id); // Newer first
      expect(orders[1].id).toBe(order1.id);
    });

    it("3. should handle pagination correctly across multiple pages", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Create 3 orders
      for (let i = 0; i < 3; i++) {
        await prisma.order.create({
          data: {
            sessionId,
            status: "PAID",
            totalAmount: 1000 * (i + 1),
            createdAt: new Date(Date.now() + i * 1000),
          },
        });
      }

      // Fetch page 1 with limit 2
      const page1Res = await request(app)
        .get("/api/orders?page=1&limit=2")
        .set("x-session-id", sessionId);

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.data.orders.length).toBe(2);
      expect(page1Res.body.data.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });

      // Fetch page 2 with limit 2
      const page2Res = await request(app)
        .get("/api/orders?page=2&limit=2")
        .set("x-session-id", sessionId);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.data.orders.length).toBe(1);
      expect(page2Res.body.data.pagination.page).toBe(2);
    });

    it("4. should return safe empty order history when session has no orders", async () => {
      const sessionRes = await request(app).get("/api/session");
      const freshSessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .get("/api/orders")
        .set("x-session-id", freshSessionId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toEqual([]);
      expect(res.body.data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      });
    });

    it("5. should apply default pagination (page 1, limit 10)", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .get("/api/orders")
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(10);
    });

    it("6. should reject limit exceeding maximum (50) with 400 VALIDATION_ERROR", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .get("/api/orders?limit=100")
        .set("x-session-id", sessionId);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("7. should reject invalid page values (e.g. 0 or negative) with 400 VALIDATION_ERROR", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .get("/api/orders?page=0")
        .set("x-session-id", sessionId);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("8. should filter orders by status (e.g. ?status=PAID)", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Create 1 PAID and 1 PENDING order
      await prisma.order.create({
        data: { sessionId, status: "PAID", totalAmount: 1500 },
      });
      await prisma.order.create({
        data: { sessionId, status: "PENDING", totalAmount: 2500 },
      });

      const res = await request(app)
        .get("/api/orders?status=PAID")
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      expect(res.body.data.orders.length).toBe(1);
      expect(res.body.data.orders[0].status).toBe("PAID");
    });

    it("9. should reject invalid status filter with 400 VALIDATION_ERROR", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .get("/api/orders?status=UNKNOWN_STATUS")
        .set("x-session-id", sessionId);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("10. should reject limit less than 1 (limit=0) with 400 VALIDATION_ERROR", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .get("/api/orders?limit=0")
        .set("x-session-id", sessionId);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("11. should filter orders by status=FAILED", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await prisma.order.create({
        data: { sessionId, status: "FAILED", totalAmount: 899 },
      });
      await prisma.order.create({
        data: { sessionId, status: "PAID", totalAmount: 1899 },
      });

      const res = await request(app)
        .get("/api/orders?status=FAILED")
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      expect(res.body.data.orders.length).toBe(1);
      expect(res.body.data.orders[0].status).toBe("FAILED");
      expect(res.body.data.orders[0].totalAmount).toBe(899);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Order Details (GET /api/orders/:orderId) & Ownership Security
  // ──────────────────────────────────────────────────────────────────────────
  describe("2. Order Details & Ownership Enforcement", () => {
    it("5 & 10. should allow owner to retrieve complete order details by orderId", async () => {
      const { sessionId, order } = await createOrderForSession({
        status: "PAID",
        items: [
          { productId: inStockProduct1.id, quantity: 2, price: inStockProduct1.price },
          { productId: inStockProduct2.id, quantity: 1, price: inStockProduct2.price },
        ],
      });

      const res = await request(app)
        .get(`/api/orders/${order.id}`)
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const detail = res.body.data;
      expect(detail.id).toBe(order.id);
      expect(detail.status).toBe("PAID");
      expect(detail.currency).toBe("INR");
      expect(detail.totalAmount).toBe(
        inStockProduct1.price * 2 + inStockProduct2.price
      );
      expect(detail.items.length).toBe(2);
    });

    it("6 & 13. should prevent Session A from accessing Session B's order (returns safe 404)", async () => {
      // Create Order in Session B
      const { order: orderB } = await createOrderForSession({ status: "PAID" });

      // Create a separate Session A
      const sessionARes = await request(app).get("/api/session");
      const sessionAId = sessionARes.body.data.sessionId;

      // Session A attempts to access Order B
      const res = await request(app)
        .get(`/api/orders/${orderB.id}`)
        .set("x-session-id", sessionAId);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");

      // Verify ZERO details of Order B were leaked
      const stringifiedBody = JSON.stringify(res.body);
      expect(stringifiedBody).not.toContain(orderB.id);
      expect(stringifiedBody).not.toContain(orderB.razorpayOrderId!);
      expect(stringifiedBody).not.toContain(String(orderB.totalAmount));
    });

    it("7 & 12. should return safe 404 NOT_FOUND for non-existent order UUID", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const nonExistentUuid = crypto.randomUUID();
      const res = await request(app)
        .get(`/api/orders/${nonExistentUuid}`)
        .set("x-session-id", sessionId);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("14. should reject malformed non-UUID orderId with 400 VALIDATION_ERROR", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .get("/api/orders/not-a-valid-uuid-12345")
        .set("x-session-id", sessionId);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("8. should return complete order items with quantity, price, subtotal, and product details", async () => {
      const { sessionId, order } = await createOrderForSession({
        items: [{ productId: inStockProduct1.id, quantity: 3, price: inStockProduct1.price }],
      });

      const res = await request(app)
        .get(`/api/orders/${order.id}`)
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      const item = res.body.data.items[0];
      expect(item.productId).toBe(inStockProduct1.id);
      expect(item.name).toBe(inStockProduct1.name);
      expect(item.productName).toBe(inStockProduct1.name);
      expect(item.quantity).toBe(3);
      expect(item.price).toBe(inStockProduct1.price);
      expect(item.subtotal).toBe(inStockProduct1.price * 3);
    });

    it("9 & 10. should use historical OrderItem snapshot price even if current Product.price changes", async () => {
      const originalPrice = 1499;
      const { sessionId, order } = await createOrderForSession({
        items: [{ productId: inStockProduct1.id, quantity: 1, price: originalPrice }],
      });

      // Update product's current price in catalog database
      const previousProductPrice = inStockProduct1.price;
      await prisma.product.update({
        where: { id: inStockProduct1.id },
        data: { price: 9999 },
      });

      try {
        const res = await request(app)
          .get(`/api/orders/${order.id}`)
          .set("x-session-id", sessionId);

        expect(res.status).toBe(200);
        // Must return historical 1499, NOT updated 9999!
        expect(res.body.data.items[0].price).toBe(originalPrice);
        expect(res.body.data.items[0].subtotal).toBe(originalPrice);
      } finally {
        // Restore catalog price
        await prisma.product.update({
          where: { id: inStockProduct1.id },
          data: { price: previousProductPrice },
        });
      }
    });

    it("15. should verify totalAmount equals the sum of item subtotals in order detail", async () => {
      const { sessionId, order } = await createOrderForSession({
        items: [
          { productId: inStockProduct1.id, quantity: 2, price: inStockProduct1.price },
          { productId: inStockProduct2.id, quantity: 3, price: inStockProduct2.price },
        ],
      });

      const res = await request(app)
        .get(`/api/orders/${order.id}`)
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      const detail = res.body.data;
      const computedSum = detail.items.reduce(
        (acc: number, item: any) => acc + item.subtotal,
        0
      );
      expect(detail.totalAmount).toBe(computedSum);
      expect(detail.itemCount).toBe(5);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Status Representations, Immutability & Security
  // ──────────────────────────────────────────────────────────────────────────
  describe("3. Order Status & Security Invariants", () => {
    it("11. should display payment information on PAID orders", async () => {
      const testPaymentId = "pay_test_snapshot_999";
      const { sessionId, order } = await createOrderForSession({
        status: "PAID",
        paymentId: testPaymentId,
      });

      const res = await request(app)
        .get(`/api/orders/${order.id}`)
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("PAID");
      expect(res.body.data.razorpayPaymentId).toBe(testPaymentId);
      expect(res.body.data.paidAt).not.toBeNull();
    });

    it("12. should return PENDING order with correct status and null payment details", async () => {
      const { sessionId, order } = await createOrderForSession({ status: "PENDING" });

      const res = await request(app)
        .get(`/api/orders/${order.id}`)
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.paidAt).toBeNull();
    });

    it("13. should return FAILED order with correct status", async () => {
      const { sessionId, order } = await createOrderForSession({ status: "FAILED" });

      const res = await request(app)
        .get(`/api/orders/${order.id}`)
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("FAILED");
    });

    it("15 & 16. should verify GET endpoints are strictly read-only and never mutate order state or cart", async () => {
      const { sessionId, order } = await createOrderForSession({ status: "PENDING" });

      // Add item to cart
      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: inStockProduct1.id, quantity: 1 });

      const cartBefore = await prisma.cartItem.count({
        where: { cart: { sessionId } },
      });
      expect(cartBefore).toBe(1);

      // Perform GET /api/orders and GET /api/orders/:orderId
      await request(app).get("/api/orders").set("x-session-id", sessionId);
      await request(app).get(`/api/orders/${order.id}`).set("x-session-id", sessionId);

      // Verify order status unchanged
      const orderAfter = await prisma.order.findUnique({ where: { id: order.id } });
      expect(orderAfter?.status).toBe("PENDING");
      expect(orderAfter?.paidAt).toBeNull();

      // Verify cart remains intact
      const cartAfter = await prisma.cartItem.count({
        where: { cart: { sessionId } },
      });
      expect(cartAfter).toBe(1);
    });

    it("16 & 21. should NEVER expose RAZORPAY_KEY_SECRET or RAZORPAY_WEBHOOK_SECRET in responses", async () => {
      const { sessionId, order } = await createOrderForSession({ status: "PAID" });

      const listRes = await request(app).get("/api/orders").set("x-session-id", sessionId);
      const detailRes = await request(app).get(`/api/orders/${order.id}`).set("x-session-id", sessionId);

      const listStr = JSON.stringify(listRes.body);
      const detailStr = JSON.stringify(detailRes.body);

      if (env.RAZORPAY_KEY_SECRET) {
        expect(listStr).not.toContain(env.RAZORPAY_KEY_SECRET);
        expect(detailStr).not.toContain(env.RAZORPAY_KEY_SECRET);
      }
      if (env.RAZORPAY_WEBHOOK_SECRET) {
        expect(listStr).not.toContain(env.RAZORPAY_WEBHOOK_SECRET);
        expect(detailStr).not.toContain(env.RAZORPAY_WEBHOOK_SECRET);
      }
    });
  });
});
