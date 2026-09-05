import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../index.js";
import prisma from "../lib/prisma.js";
import razorpayService from "../services/razorpayService.js";
import { rupeesToPaise, paiseToRupees } from "../utils/money.js";
import { env } from "../config/env.js";
import { ExternalServiceError } from "../utils/errors.js";

describe("Phase 6: Razorpay Order Creation & Authoritative Checkout", { timeout: 20000 }, () => {
  let sampleProduct1: { id: string; name: string; price: number };
  let sampleProduct2: { id: string; name: string; price: number };
  let outOfStockProduct: { id: string; name: string };

  afterAll(async () => {
    await prisma.$disconnect();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Retrieve authoritative in-stock products
    const inStock = await prisma.product.findMany({
      where: { inStock: true },
      take: 2,
    });
    sampleProduct1 = {
      id: inStock[0].id,
      name: inStock[0].name,
      price: Number(inStock[0].price),
    };
    sampleProduct2 = {
      id: inStock[1].id,
      name: inStock[1].name,
      price: Number(inStock[1].price),
    };

    // Ensure an out-of-stock product exists for edge testing
    let oos = await prisma.product.findFirst({
      where: { inStock: false },
    });
    if (!oos) {
      oos = await prisma.product.create({
        data: {
          name: "Out of Stock Checkout Test Item",
          brand: "TestBrand",
          category: "Wireless Earbuds",
          price: 999,
          description: "Test out of stock product",
          imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500",
          specs: {},
          features: [],
          rating: 4.0,
          inStock: false,
        },
      });
    }
    outOfStockProduct = { id: oos.id, name: oos.name };

    // Mock Razorpay SDK createOrder by default to guarantee fast, deterministic offline tests
    vi.spyOn(razorpayService, "createOrder").mockImplementation(async (params) => {
      const generatedId = `order_test_${Math.random().toString(36).substring(2, 12)}`;
      return {
        id: generatedId,
        entity: "order",
        amount: params.amount,
        amount_paid: 0,
        amount_due: params.amount,
        currency: params.currency || "INR",
        receipt: params.receipt,
        status: "created",
        created_at: Math.floor(Date.now() / 1000),
      };
    });
  });

  describe("1. Monetary Edge Cases & Integer Paise Conversion", () => {
    it("should accurately convert exact INR values to integer paise without floating-point drift", () => {
      expect(rupeesToPaise(1)).toBe(100);
      expect(rupeesToPaise(10)).toBe(1000);
      expect(rupeesToPaise(1299)).toBe(129900);
      expect(rupeesToPaise(2598)).toBe(259800);
      expect(rupeesToPaise(69900)).toBe(6990000);

      // Fractional values
      expect(rupeesToPaise(1299.5)).toBe(129950);
      expect(rupeesToPaise("2499.00")).toBe(249900);
      expect(paiseToRupees(129900)).toBe(1299);
      expect(paiseToRupees(6990000)).toBe(69900);
    });

    it("should reject negative or invalid monetary values", () => {
      expect(() => rupeesToPaise(-100)).toThrow();
      expect(() => rupeesToPaise(NaN)).toThrow();
      expect(() => paiseToRupees(-50)).toThrow();
      expect(() => paiseToRupees(10.5)).toThrow();
    });
  });

  describe("2. Order Creation Validation & Error Handling", () => {
    it("1. should reject checkout on an empty cart with 400 VALIDATION_ERROR", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .post("/api/checkout/order")
        .set("x-session-id", sessionId)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toContain("empty cart");
    });

    it("13. should reject order creation if any cart item is out of stock", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Add out-of-stock item directly into cart in DB to simulate item becoming unavailable after add
      const cart = await prisma.cart.create({ data: { sessionId } });
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: outOfStockProduct.id,
          quantity: 1,
        },
      });

      const res = await request(app)
        .post("/api/checkout/order")
        .set("x-session-id", sessionId)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("out of stock");
    });

    it("15. should prevent Session A from creating an order from Session B's cart", async () => {
      const sessionA = (await request(app).get("/api/session")).body.data.sessionId;
      const sessionB = (await request(app).get("/api/session")).body.data.sessionId;

      // Session A adds item
      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionA)
        .send({ productId: sampleProduct1.id, quantity: 1 });

      // Session B attempts to checkout -> cart is empty for session B
      const res = await request(app)
        .post("/api/checkout/order")
        .set("x-session-id", sessionB)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("empty cart");
    });

    it("16. should handle Razorpay API failure safely without corrupting database state", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 1 });

      // Simulate Razorpay API service rejection
      vi.spyOn(razorpayService, "createOrder").mockRejectedValueOnce(
        new ExternalServiceError("Razorpay gateway connectivity error")
      );

      const res = await request(app)
        .post("/api/checkout/order")
        .set("x-session-id", sessionId)
        .send({});

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);

      // Verify no PAID or corrupted order was created
      const orders = await prisma.order.findMany({
        where: { sessionId },
      });
      const paidOrders = orders.filter((o) => o.status === "PAID");
      expect(paidOrders.length).toBe(0);

      // Verify cart remains intact
      const cartRes = await request(app)
        .get("/api/cart")
        .set("x-session-id", sessionId);
      expect(cartRes.body.data.items.length).toBe(1);
    });
  });

  describe("3. Authoritative Pricing & Order Creation Core Flow", () => {
    it("2, 3, 5, 6, 7, 8, 9, 10. should create a valid internal PENDING order and Razorpay order in paise", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Add product (₹1,299)
      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 2 });

      const res = await request(app)
        .post("/api/checkout/order")
        .set("x-session-id", sessionId)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.orderId).toBeDefined();
      expect(data.razorpayOrderId).toMatch(/^order_/);
      expect(data.currency).toBe("INR");
      expect(data.keyId).toBe(env.RAZORPAY_KEY_ID);

      // Expected amount: price * 2 in paise
      const expectedAmountPaise = rupeesToPaise(sampleProduct1.price * 2);
      expect(data.amount).toBe(expectedAmountPaise);

      // Verify internal Order state in PostgreSQL
      const dbOrder = await prisma.order.findUnique({
        where: { id: data.orderId },
        include: { items: true },
      });

      expect(dbOrder).toBeDefined();
      expect(dbOrder?.sessionId).toBe(sessionId);
      expect(dbOrder?.status).toBe("PENDING"); // 7. Must be PENDING
      expect(dbOrder?.razorpayOrderId).toBe(data.razorpayOrderId); // 6. Stored Razorpay order ID
      expect(dbOrder?.razorpayPaymentId).toBeNull(); // 8. Must remain null in Phase 6
      expect(dbOrder?.paidAt).toBeNull(); // 9. Must remain null in Phase 6
      expect(Number(dbOrder?.totalAmount)).toBe(sampleProduct1.price * 2);

      // 10. Verify OrderItems snapshots
      expect(dbOrder?.items.length).toBe(1);
      expect(dbOrder?.items[0].productId).toBe(sampleProduct1.id);
      expect(dbOrder?.items[0].quantity).toBe(2);
      expect(Number(dbOrder?.items[0].price)).toBe(sampleProduct1.price);

      // Verify cart was NOT cleared (payment hasn't completed yet)
      const cartRes = await request(app)
        .get("/api/cart")
        .set("x-session-id", sessionId);
      expect(cartRes.body.data.items.length).toBe(1);
    });

    it("4. should calculate correct total in paise for multiple cart items", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 2 });

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct2.id, quantity: 1 });

      const res = await request(app)
        .post("/api/checkout/order")
        .set("x-session-id", sessionId)
        .send({});

      expect(res.status).toBe(200);

      const expectedTotalRupees = sampleProduct1.price * 2 + sampleProduct2.price * 1;
      const expectedTotalPaise = rupeesToPaise(expectedTotalRupees);

      expect(res.body.data.amount).toBe(expectedTotalPaise);
    });

    it("11 & 12. should completely ignore any malicious client-supplied financial fields", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 1 });

      // Attacker attempts to override amount to 1 rupee and currency to USD
      const res = await request(app)
        .post("/api/checkout/order")
        .set("x-session-id", sessionId)
        .send({
          amount: 100, // Attempt 1 INR
          currency: "USD",
          price: 1,
          total: 1,
        });

      expect(res.status).toBe(200);
      // Must strictly use database price
      expect(res.body.data.amount).toBe(rupeesToPaise(sampleProduct1.price));
      expect(res.body.data.currency).toBe("INR");
    });

    it("17. should never return RAZORPAY_KEY_SECRET in the API response", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 1 });

      const res = await request(app)
        .post("/api/checkout/order")
        .set("x-session-id", sessionId)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.keySecret).toBeUndefined();
      expect(res.body.data.razorpayKeySecret).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(env.RAZORPAY_KEY_SECRET);
    });

    it("18. should safely reuse active PENDING order for duplicate checkout requests with identical cart", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 1 });

      // First checkout call
      const res1 = await request(app)
        .post("/api/checkout/order")
        .set("x-session-id", sessionId)
        .send({});

      // Second immediate checkout call (user clicked checkout twice)
      const res2 = await request(app)
        .post("/api/checkout/order")
        .set("x-session-id", sessionId)
        .send({});

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Reuses the same active order
      expect(res2.body.data.orderId).toBe(res1.body.data.orderId);
      expect(res2.body.data.razorpayOrderId).toBe(res1.body.data.razorpayOrderId);
    });
  });
});
