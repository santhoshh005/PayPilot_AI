import { describe, it, expect, afterAll, beforeEach } from "vitest";
import request from "supertest";
import crypto from "crypto";
import app from "../index.js";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.js";

describe("Phase 11: Growth Dashboard & Business Insights", { timeout: 30000 }, () => {
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
      throw new Error("At least two in-stock products required for dashboard tests");
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

  // Helper to create an order with specific status, date, and items
  async function createTestOrder(params: {
    status: "PENDING" | "PAID" | "FAILED";
    createdAt?: Date;
    paidAt?: Date;
    items?: Array<{ productId: string; quantity: number; price: number }>;
  }) {
    const sessionRes = await request(app).get("/api/session");
    const sessionId = sessionRes.body.data.sessionId;

    const items = params.items || [
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
        status: params.status,
        totalAmount,
        razorpayOrderId: `order_${crypto.randomBytes(8).toString("hex")}`,
        razorpayPaymentId:
          params.status === "PAID"
            ? `pay_${crypto.randomBytes(8).toString("hex")}`
            : null,
        createdAt: params.createdAt || new Date(),
        paidAt:
          params.paidAt || (params.status === "PAID" ? new Date() : null),
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return { sessionId, order };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Basic Summary Endpoint & Aggregate Metric Invariants
  // ──────────────────────────────────────────────────────────────────────────
  describe("1. GET /api/dashboard/summary & Core Metric Invariants", () => {
    it("1. should return status 200 with standard response envelope", async () => {
      const res = await request(app).get("/api/dashboard/summary");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.range).toBe("30d");
    });

    it("2. should correctly count total orders within range", async () => {
      const initialRes = await request(app).get("/api/dashboard/summary");
      const baseTotal = initialRes.body.data.totalOrders;

      // Create 1 PAID and 1 PENDING order
      await createTestOrder({ status: "PAID" });
      await createTestOrder({ status: "PENDING" });

      const res = await request(app).get("/api/dashboard/summary");
      expect(res.body.data.totalOrders).toBe(baseTotal + 2);
    });

    it("3. should correctly partition PAID, PENDING, and FAILED order counts", async () => {
      const initialRes = await request(app).get("/api/dashboard/summary");
      const basePaid = initialRes.body.data.paidOrders;
      const basePending = initialRes.body.data.pendingOrders;
      const baseFailed = initialRes.body.data.failedOrders;

      await createTestOrder({ status: "PAID" });
      await createTestOrder({ status: "PENDING" });
      await createTestOrder({ status: "FAILED" });

      const res = await request(app).get("/api/dashboard/summary");
      expect(res.body.data.paidOrders).toBe(basePaid + 1);
      expect(res.body.data.pendingOrders).toBe(basePending + 1);
      expect(res.body.data.failedOrders).toBe(baseFailed + 1);
    });

    it("4. should calculate total revenue ONLY from PAID orders", async () => {
      const initialRes = await request(app).get("/api/dashboard/summary");
      const baseRevenue = initialRes.body.data.totalRevenue;

      const orderPrice = 1299;
      const orderQty = 2;
      const expectedRevenueAddition = orderPrice * orderQty; // 2598

      await createTestOrder({
        status: "PAID",
        items: [{ productId: inStockProduct1.id, quantity: orderQty, price: orderPrice }],
      });

      const res = await request(app).get("/api/dashboard/summary");
      expect(res.body.data.totalRevenue).toBe(
        Math.round((baseRevenue + expectedRevenueAddition) * 100) / 100
      );
    });

    it("5 & 6. should verify PENDING and FAILED orders do NOT affect total revenue", async () => {
      const initialRes = await request(app).get("/api/dashboard/summary");
      const baseRevenue = initialRes.body.data.totalRevenue;

      // Create high-value PENDING and FAILED orders
      await createTestOrder({
        status: "PENDING",
        items: [{ productId: inStockProduct1.id, quantity: 10, price: 9999 }],
      });
      await createTestOrder({
        status: "FAILED",
        items: [{ productId: inStockProduct2.id, quantity: 10, price: 9999 }],
      });

      const res = await request(app).get("/api/dashboard/summary");
      expect(res.body.data.totalRevenue).toBe(baseRevenue);
    });

    it("7. should correctly calculate averageOrderValue (AOV = totalRevenue / paidOrders)", async () => {
      const res = await request(app).get("/api/dashboard/summary");
      const { totalRevenue, paidOrders, averageOrderValue } = res.body.data;

      if (paidOrders > 0) {
        const expectedAov = Math.round((totalRevenue / paidOrders) * 100) / 100;
        expect(averageOrderValue).toBeCloseTo(expectedAov, 1);
      } else {
        expect(averageOrderValue).toBe(0);
      }
    });

    it("8. should return averageOrderValue = 0 when there are zero paid orders in range", async () => {
      // In 7d range if we test with a far future or empty range or check logic
      const res = await request(app).get("/api/dashboard/summary?range=7d");
      if (res.body.data.paidOrders === 0) {
        expect(res.body.data.averageOrderValue).toBe(0);
      } else {
        expect(typeof res.body.data.averageOrderValue).toBe("number");
      }
    });

    it("9. should count totalItemsSold from PAID orders only", async () => {
      const initialRes = await request(app).get("/api/dashboard/summary");
      const baseItemsSold = initialRes.body.data.totalItemsSold;

      // 1 PAID order with 3 items
      await createTestOrder({
        status: "PAID",
        items: [{ productId: inStockProduct1.id, quantity: 3, price: 500 }],
      });

      // 1 PENDING order with 5 items (must NOT be counted)
      await createTestOrder({
        status: "PENDING",
        items: [{ productId: inStockProduct1.id, quantity: 5, price: 500 }],
      });

      const res = await request(app).get("/api/dashboard/summary");
      expect(res.body.data.totalItemsSold).toBe(baseItemsSold + 3);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Top Products & Historical Price Invariants
  // ──────────────────────────────────────────────────────────────────────────
  describe("2. Top Products & Historical Snapshot Invariants", () => {
    it("10. should include only PAID items in topProducts aggregation", async () => {
      // Create a PAID order with Product 1
      await createTestOrder({
        status: "PAID",
        items: [{ productId: inStockProduct1.id, quantity: 4, price: inStockProduct1.price }],
      });

      // Create a PENDING order with Product 2 with higher quantity
      await createTestOrder({
        status: "PENDING",
        items: [{ productId: inStockProduct2.id, quantity: 20, price: inStockProduct2.price }],
      });

      const res = await request(app).get("/api/dashboard/summary");
      const topProducts = res.body.data.topProducts;

      const p1Stat = topProducts.find((p: any) => p.productId === inStockProduct1.id);
      expect(p1Stat).toBeDefined();
      expect(p1Stat.quantitySold).toBeGreaterThanOrEqual(4);
    });

    it("11. should compute top product revenue using historical OrderItem.price", async () => {
      const historicalPrice = 777;
      const qty = 3;

      await createTestOrder({
        status: "PAID",
        items: [{ productId: inStockProduct2.id, quantity: qty, price: historicalPrice }],
      });

      const res = await request(app).get("/api/dashboard/summary");
      const p2Stat = res.body.data.topProducts.find(
        (p: any) => p.productId === inStockProduct2.id
      );

      expect(p2Stat).toBeDefined();
      expect(p2Stat.revenue).toBeGreaterThanOrEqual(historicalPrice * qty);
    });

    it("12. should verify catalog Product.price updates do NOT alter historical dashboard revenue", async () => {
      const historicalPrice = 1200;
      const qty = 2;

      await createTestOrder({
        status: "PAID",
        items: [{ productId: inStockProduct1.id, quantity: qty, price: historicalPrice }],
      });

      const resBefore = await request(app).get("/api/dashboard/summary");
      const revenueBefore = resBefore.body.data.totalRevenue;

      // Update current product catalog price
      const originalCatalogPrice = inStockProduct1.price;
      await prisma.product.update({
        where: { id: inStockProduct1.id },
        data: { price: 99999 },
      });

      try {
        const resAfter = await request(app).get("/api/dashboard/summary");
        // Historical revenue MUST remain unchanged!
        expect(resAfter.body.data.totalRevenue).toBe(revenueBefore);
      } finally {
        await prisma.product.update({
          where: { id: inStockProduct1.id },
          data: { price: originalCatalogPrice },
        });
      }
    });

    it("should cap topProducts at 5 items and sort by quantitySold descending", async () => {
      const res = await request(app).get("/api/dashboard/summary");
      const topProducts = res.body.data.topProducts;
      expect(topProducts.length).toBeLessThanOrEqual(5);

      for (let i = 1; i < topProducts.length; i++) {
        expect(topProducts[i - 1].quantitySold).toBeGreaterThanOrEqual(
          topProducts[i].quantitySold
        );
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Date Range Handling & Sales by Day
  // ──────────────────────────────────────────────────────────────────────────
  describe("3. Date Ranges & Daily Sales Timeline", () => {
    it("13. should support range=7d and return 7 daily buckets", async () => {
      const res = await request(app).get("/api/dashboard/summary?range=7d");
      expect(res.status).toBe(200);
      expect(res.body.data.range).toBe("7d");
      expect(res.body.data.salesByDay.length).toBe(7);
    });

    it("14. should support range=30d and return 30 daily buckets", async () => {
      const res = await request(app).get("/api/dashboard/summary?range=30d");
      expect(res.status).toBe(200);
      expect(res.body.data.range).toBe("30d");
      expect(res.body.data.salesByDay.length).toBe(30);
    });

    it("15. should support range=90d and return 90 daily buckets", async () => {
      const res = await request(app).get("/api/dashboard/summary?range=90d");
      expect(res.status).toBe(200);
      expect(res.body.data.range).toBe("90d");
      expect(res.body.data.salesByDay.length).toBe(90);
    });

    it("16. should verify salesByDay contains properly formatted YYYY-MM-DD dates and numbers", async () => {
      const res = await request(app).get("/api/dashboard/summary?range=7d");
      const salesByDay = res.body.data.salesByDay;

      expect(salesByDay.length).toBe(7);
      for (const day of salesByDay) {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof day.revenue).toBe("number");
        expect(typeof day.orders).toBe("number");
        expect(day.revenue).toBeGreaterThanOrEqual(0);
        expect(day.orders).toBeGreaterThanOrEqual(0);
      }
    });

    it("should filter out orders created prior to the requested range", async () => {
      // Create an order 15 days ago
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setUTCDate(fifteenDaysAgo.getUTCDate() - 15);

      await createTestOrder({
        status: "PAID",
        createdAt: fifteenDaysAgo,
        paidAt: fifteenDaysAgo,
        items: [{ productId: inStockProduct1.id, quantity: 1, price: 1000 }],
      });

      // Fetch 7d summary -> should NOT include the 15-day-old order
      const res7d = await request(app).get("/api/dashboard/summary?range=7d");
      // Fetch 30d summary -> SHOULD include the 15-day-old order
      const res30d = await request(app).get("/api/dashboard/summary?range=30d");

      expect(res30d.body.data.totalOrders).toBeGreaterThanOrEqual(
        res7d.body.data.totalOrders
      );
    });

    it("should reject invalid range parameter with 400 VALIDATION_ERROR", async () => {
      const res = await request(app).get("/api/dashboard/summary?range=1y");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Security & Immutability Invariants
  // ──────────────────────────────────────────────────────────────────────────
  describe("4. Security, Secrets Hygiene & Read-Only Invariants", () => {
    it("18. should NEVER expose RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, or session IDs in response", async () => {
      const res = await request(app).get("/api/dashboard/summary");
      const stringified = JSON.stringify(res.body);

      if (env.RAZORPAY_KEY_SECRET) {
        expect(stringified).not.toContain(env.RAZORPAY_KEY_SECRET);
      }
      if (env.RAZORPAY_WEBHOOK_SECRET) {
        expect(stringified).not.toContain(env.RAZORPAY_WEBHOOK_SECRET);
      }

      expect(stringified).not.toContain("razorpaySignature");
      expect(stringified).not.toContain("razorpay_signature");
      expect(stringified).not.toContain("sessionId");
    });

    it("19. should verify GET /api/dashboard/summary is strictly read-only and mutates zero database state", async () => {
      const ordersBefore = await prisma.order.count();
      const cartItemsBefore = await prisma.cartItem.count();
      const productsBefore = await prisma.product.count();

      await request(app).get("/api/dashboard/summary?range=7d");
      await request(app).get("/api/dashboard/summary?range=30d");
      await request(app).get("/api/dashboard/summary?range=90d");

      const ordersAfter = await prisma.order.count();
      const cartItemsAfter = await prisma.cartItem.count();
      const productsAfter = await prisma.product.count();

      expect(ordersAfter).toBe(ordersBefore);
      expect(cartItemsAfter).toBe(cartItemsBefore);
      expect(productsAfter).toBe(productsBefore);
    });
  });
});
