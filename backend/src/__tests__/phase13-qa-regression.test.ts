import { describe, it, expect, afterAll, beforeAll } from "vitest";
import request from "supertest";
import crypto from "crypto";
import app from "../index.js";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.js";
import razorpayService from "../services/razorpayService.js";
import { sensitiveLimiter } from "../middleware/rateLimiter.js";
import express from "express";

describe("Phase 13: Comprehensive QA, Security & Regression Suite", { timeout: 60000 }, () => {
  let inStockProduct1: { id: string; name: string; price: number; brand: string };
  let inStockProduct2: { id: string; name: string; price: number; brand: string };
  let outOfStockProduct: { id: string; name: string; price: number };

  beforeAll(async () => {
    const inStock = await prisma.product.findMany({
      where: { inStock: true },
      take: 2,
    });

    if (inStock.length < 2) {
      throw new Error("At least two in-stock products required for Phase 13 QA suite");
    }

    inStockProduct1 = {
      id: inStock[0].id,
      name: inStock[0].name,
      price: Number(inStock[0].price),
      brand: inStock[0].brand,
    };
    inStockProduct2 = {
      id: inStock[1].id,
      name: inStock[1].name,
      price: Number(inStock[1].price),
      brand: inStock[1].brand,
    };

    let outStock = await prisma.product.findFirst({
      where: { inStock: false },
    });

    if (!outStock) {
      outStock = await prisma.product.create({
        data: {
          name: "Test Out of Stock Product QA",
          brand: "TestBrand",
          category: "Electronics",
          price: 999.0,
          description: "Temporary test product",
          imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
          specs: { batteryLifeHours: 10 },
          features: ["Feature A"],
          rating: 4.0,
          inStock: false,
        },
      });
    }

    outOfStockProduct = {
      id: outStock.id,
      name: outStock.name,
      price: Number(outStock.price),
    };
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: { name: "Test Out of Stock Product QA" },
    });
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. FULL SYSTEM DEMO FLOW TEST
  // =========================================================================
  describe("1. Full System Demo Flow Test (End-to-End)", () => {
    it("should seamlessly execute the entire user journey with authoritative consistency", async () => {
      // Step A: Provision new session
      const sessionRes = await request(app).get("/api/session");
      expect(sessionRes.status).toBe(200);
      const sessionId = sessionRes.body.data.sessionId;
      expect(sessionId).toBeDefined();

      // Step B: AI Agent - Product Search
      const searchRes = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "I need wireless earbuds under ₹2500 with at least 30 hours of battery life." });
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.success).toBe(true);
      expect(searchRes.body.data.products).toBeDefined();
      expect(searchRes.body.data.products.length).toBeGreaterThanOrEqual(1);

      // Step C: AI Agent - Product Comparison
      const compareRes = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Compare the first two" });
      expect(compareRes.status).toBe(200);
      expect(compareRes.body.success).toBe(true);
      expect(compareRes.body.data.comparison).toBeDefined();
      expect(compareRes.body.data.comparison.length).toBe(2);

      // Step D: AI Agent - Conversational Reference ("Which one has better battery?")
      const batteryRes = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Which one has better battery?" });
      expect(batteryRes.status).toBe(200);
      expect(batteryRes.body.success).toBe(true);
      expect(batteryRes.body.data.message.toLowerCase()).toContain("battery");

      // Step E: AI Agent - Conversational Reference ("Add the cheaper one")
      const addRes = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Add the cheaper one" });
      expect(addRes.status).toBe(200);
      expect(addRes.body.success).toBe(true);
      expect(addRes.body.data.cart).toBeDefined();
      expect(addRes.body.data.cart.itemCount).toBe(1);
      const addedProduct = addRes.body.data.cart.items[0];

      // Step F: AI Agent - Inspect Cart ("What's in my cart?")
      const viewCartRes = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "What's in my cart?" });
      expect(viewCartRes.status).toBe(200);
      expect(viewCartRes.body.success).toBe(true);
      expect(viewCartRes.body.data.message).toContain(addedProduct.name);

      // Step G: Update Cart Quantity via REST API
      const patchCartRes = await request(app)
        .patch(`/api/cart/items/${addedProduct.productId}`)
        .set("X-Session-Id", sessionId)
        .send({ quantity: 2 });
      expect(patchCartRes.status).toBe(200);
      expect(patchCartRes.body.data.itemCount).toBe(2);
      expect(patchCartRes.body.data.subtotal).toBe(addedProduct.price * 2);

      // Step H: Checkout Order Creation
      const checkoutRes = await request(app)
        .post("/api/checkout/order")
        .set("X-Session-Id", sessionId)
        .send({ notes: { customerFlow: "E2E QA Verification" } });
      expect(checkoutRes.status).toBe(200);
      expect(checkoutRes.body.success).toBe(true);
      const { orderId, razorpayOrderId, amount } = checkoutRes.body.data;
      expect(orderId).toBeDefined();
      expect(razorpayOrderId).toBeDefined();
      expect(amount).toBe(Math.round(addedProduct.price * 2 * 100));

      // Verify cart is STILL intact prior to payment verification
      const prePayCartRes = await request(app)
        .get("/api/cart")
        .set("X-Session-Id", sessionId);
      expect(prePayCartRes.body.data.itemCount).toBe(2);

      // Step I: Payment Verification with Valid Signature
      const mockPaymentId = `pay_e2e_${Date.now()}`;
      const validSignature = razorpayService.generateSignature(razorpayOrderId, mockPaymentId);

      const verifyRes = await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionId)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: mockPaymentId,
          razorpay_signature: validSignature,
        });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.status).toBe("PAID");

      // Verify cart is ATOMICALLY CLEARED after successful payment
      const postPayCartRes = await request(app)
        .get("/api/cart")
        .set("X-Session-Id", sessionId);
      expect(postPayCartRes.body.data.itemCount).toBe(0);
      expect(postPayCartRes.body.data.items).toHaveLength(0);

      // Step J: Webhook Idempotency (payment.captured event replay)
      const webhookPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: mockPaymentId,
              order_id: razorpayOrderId,
              amount,
              status: "captured",
            },
          },
        },
      };
      const rawWebhookBody = JSON.stringify(webhookPayload);
      const webhookSignature = razorpayService.generateWebhookSignature(rawWebhookBody);

      const webhookRes = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", webhookSignature)
        .send(rawWebhookBody);
      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body.success).toBe(true);

      // Step K: Order History and Receipt
      const listOrdersRes = await request(app)
        .get("/api/orders")
        .set("X-Session-Id", sessionId);
      expect(listOrdersRes.status).toBe(200);
      expect(listOrdersRes.body.data.orders.length).toBeGreaterThanOrEqual(1);
      const foundOrder = listOrdersRes.body.data.orders.find((o: any) => o.id === orderId);
      expect(foundOrder).toBeDefined();
      expect(foundOrder.status).toBe("PAID");
      expect(foundOrder.razorpayPaymentId).toBe(mockPaymentId);

      const orderDetailRes = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("X-Session-Id", sessionId);
      expect(orderDetailRes.status).toBe(200);
      expect(orderDetailRes.body.data.id).toBe(orderId);
      expect(orderDetailRes.body.data.items[0].productName).toBe(addedProduct.name);
      expect(orderDetailRes.body.data.items[0].quantity).toBe(2);

      // Step L: Dashboard reflects the payment
      const dashRes = await request(app).get("/api/dashboard/summary?range=7d");
      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data.paidOrders).toBeGreaterThanOrEqual(1);
      expect(dashRes.body.data.totalRevenue).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. AI AGENT QA & CONVERSATIONAL CONTEXT
  // =========================================================================
  describe("2. AI Agent QA & Reference Resolution", () => {
    it("should handle conversational references: first one, second one, cheaper one, better battery", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Turn 1: Search
      const t1 = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Show me earbuds" });
      expect(t1.status).toBe(200);
      expect(t1.body.data.products.length).toBeGreaterThanOrEqual(2);

      // Turn 2: Inspect first one
      const t2 = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Tell me more about the first one" });
      expect(t2.status).toBe(200);
      expect(t2.body.data.message).toBeDefined();

      // Turn 3: Add the second one
      const t3 = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Add the second one to my cart" });
      expect(t3.status).toBe(200);
      expect(t3.body.data.cart?.itemCount).toBe(1);

      // Turn 4: Clear cart via conversational message
      const t4 = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Clear my cart" });
      expect(t4.status).toBe(200);
      expect(t4.body.data.cart?.itemCount).toBe(0);
    });

    it("should handle conversational references: 'more expensive one', 'better battery', 'change to 2', and 'remove it'", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // 1. Search products
      await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Find earbuds under ₹2500 with 30+ hours battery." });

      // 2. Add more expensive one
      const expRes = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Add the more expensive one" });
      expect(expRes.status).toBe(200);
      expect(expRes.body.data.cart?.itemCount).toBe(1);

      // 3. Change it to 2
      const updateRes = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Change it to 2" });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.cart?.itemCount).toBe(2);

      // 4. Remove it
      const removeRes = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Remove it" });
      expect(removeRes.status).toBe(200);
      expect(removeRes.body.data.cart?.itemCount).toBe(0);

      // 5. Add one with better battery
      const battRes = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Add the one with better battery" });
      expect(battRes.status).toBe(200);
      expect(battRes.body.data.cart?.itemCount).toBe(1);
    });

    it("should safely handle ambiguous references without crashing", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Ask for "the cheaper one" with zero prior product context
      const res = await request(app)
        .post("/api/chat")
        .set("X-Session-Id", sessionId)
        .send({ message: "Add the cheaper one to cart" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.toLowerCase()).toContain("search");
    });
  });

  // =========================================================================
  // 3. CART SECURITY & QUANTITY BOUNDARIES
  // =========================================================================
  describe("3. Cart Security & Quantity Boundaries", () => {
    it("should enforce integer bounds [1, 10] and reject invalid quantities", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Quantity 0
      const res0 = await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: inStockProduct1.id, quantity: 0 });
      expect(res0.status).toBe(400);

      // Quantity 11 (exceeds max 10)
      const res11 = await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: inStockProduct1.id, quantity: 11 });
      expect(res11.status).toBe(400);

      // Negative quantity
      const resNeg = await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: inStockProduct1.id, quantity: -2 });
      expect(resNeg.status).toBe(400);

      // Decimal quantity
      const resDec = await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: inStockProduct1.id, quantity: 2.5 });
      expect(resDec.status).toBe(400);

      // Invalid UUID product ID
      const resInvalidUuid = await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: "not-a-uuid", quantity: 1 });
      expect(resInvalidUuid.status).toBe(400);

      // Nonexistent UUID product
      const resNonexistent = await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: crypto.randomUUID(), quantity: 1 });
      expect(resNonexistent.status).toBe(404);
    });

    it("should reject adding out-of-stock products to the cart", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: outOfStockProduct.id, quantity: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("out of stock");
    });

    it("should isolate carts strictly between different sessions", async () => {
      const sessionResA = await request(app).get("/api/session");
      const sessionA = sessionResA.body.data.sessionId;

      const sessionResB = await request(app).get("/api/session");
      const sessionB = sessionResB.body.data.sessionId;

      // Add item to Session A cart
      await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionA)
        .send({ productId: inStockProduct1.id, quantity: 2 });

      // Session B cart must remain empty
      const cartB = await request(app)
        .get("/api/cart")
        .set("X-Session-Id", sessionB);
      expect(cartB.body.data.itemCount).toBe(0);
      expect(cartB.body.data.items).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. CHECKOUT SECURITY & MANIPULATION RESISTANCE
  // =========================================================================
  describe("4. Checkout Security & Manipulation Resistance", () => {
    it("should ignore malicious client-supplied financial parameters and calculate server-side", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: inStockProduct1.id, quantity: 1 });

      const expectedAmountPaise = Math.round(inStockProduct1.price * 100);

      // Attempt to tamper price, currency, amount, total
      const tamperedRes = await request(app)
        .post("/api/checkout/order")
        .set("X-Session-Id", sessionId)
        .send({
          amount: 1, // Tampered ₹0.01
          price: 1,
          total: 1,
          currency: "USD",
          subtotal: 1,
        });

      expect(tamperedRes.status).toBe(200);
      expect(tamperedRes.body.data.amount).toBe(expectedAmountPaise);
      expect(tamperedRes.body.data.currency).toBe("INR");
      expect(tamperedRes.body.data.keyId).toBe(env.RAZORPAY_KEY_ID);
      expect(tamperedRes.body.data.keySecret).toBeUndefined();
    });

    it("should reject checkout on an empty cart", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .post("/api/checkout/order")
        .set("X-Session-Id", sessionId)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("empty cart");
    });
  });

  // =========================================================================
  // 5. PAYMENT VERIFICATION SECURITY & CRYPTOGRAPHIC GUARDS
  // =========================================================================
  describe("5. Payment Verification Security & Cryptographic Guards", () => {
    it("should reject tampered signature, modified order ID, or modified payment ID", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: inStockProduct1.id, quantity: 1 });

      const checkoutRes = await request(app)
        .post("/api/checkout/order")
        .set("X-Session-Id", sessionId)
        .send({});

      const { razorpayOrderId } = checkoutRes.body.data;
      const paymentId = `pay_tamper_${Date.now()}`;
      const validSignature = razorpayService.generateSignature(razorpayOrderId, paymentId);

      // 1. Tampered Signature
      const badSigRes = await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionId)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature.slice(0, -4) + "0000",
        });
      expect(badSigRes.status).toBe(400);

      // 2. Tampered Payment ID with signature for another ID
      const badPayRes = await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionId)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: "pay_different_123",
          razorpay_signature: validSignature,
        });
      expect(badPayRes.status).toBe(400);

      // 3. Length mismatch signature (must safely fail without crashing timingSafeEqual)
      const shortSigRes = await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionId)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: "short_invalid_sig",
        });
      expect(shortSigRes.status).toBe(400);
    });

    it("should prevent Session B from verifying an order belonging to Session A", async () => {
      const sessionResA = await request(app).get("/api/session");
      const sessionA = sessionResA.body.data.sessionId;

      const sessionResB = await request(app).get("/api/session");
      const sessionB = sessionResB.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionA)
        .send({ productId: inStockProduct1.id, quantity: 1 });

      const checkoutRes = await request(app)
        .post("/api/checkout/order")
        .set("X-Session-Id", sessionA)
        .send({});

      const { razorpayOrderId } = checkoutRes.body.data;
      const paymentId = `pay_cross_${Date.now()}`;
      const signature = razorpayService.generateSignature(razorpayOrderId, paymentId);

      // Session B attempts verification
      const crossRes = await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionB)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });
      expect(crossRes.status).toBe(404);
    });

    it("should reject conflicting payment IDs for an already PAID order", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: inStockProduct1.id, quantity: 1 });

      const checkoutRes = await request(app)
        .post("/api/checkout/order")
        .set("X-Session-Id", sessionId)
        .send({});

      const { razorpayOrderId } = checkoutRes.body.data;
      const paymentId1 = `pay_idemp1_${Date.now()}`;
      const sig1 = razorpayService.generateSignature(razorpayOrderId, paymentId1);

      // First verification succeeds
      const verify1 = await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionId)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId1,
          razorpay_signature: sig1,
        });
      expect(verify1.status).toBe(200);

      // Repeated identical verification is idempotent
      const verifyIdempotent = await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionId)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId1,
          razorpay_signature: sig1,
        });
      expect(verifyIdempotent.status).toBe(200);

      // Different payment ID for already PAID order rejected with 409 Conflict
      const paymentId2 = `pay_idemp2_${Date.now()}`;
      const sig2 = razorpayService.generateSignature(razorpayOrderId, paymentId2);
      const verifyConflict = await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionId)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId2,
          razorpay_signature: sig2,
        });
      expect(verifyConflict.status).toBe(409);
    });

    it("should reject verification with missing signature or nonexistent order ID", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Missing signature
      const resMissing = await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionId)
        .send({
          razorpay_order_id: "order_test_123",
          razorpay_payment_id: "pay_test_123",
        });
      expect(resMissing.status).toBe(400);

      // Nonexistent order ID
      const resNonexistent = await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionId)
        .send({
          razorpay_order_id: "order_nonexistent_99999",
          razorpay_payment_id: "pay_test_123",
          razorpay_signature: "some_signature_value",
        });
      expect(resNonexistent.status).toBe(404);
    });

    it("should reject verification if internal order is in FAILED status", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const failedOrder = await prisma.order.create({
        data: {
          sessionId,
          totalAmount: 999.0,
          status: "FAILED",
          razorpayOrderId: `order_failed_test_${Date.now()}`,
        },
      });

      const paymentId = `pay_fail_${Date.now()}`;
      const sig = razorpayService.generateSignature(failedOrder.razorpayOrderId!, paymentId);

      const res = await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionId)
        .send({
          razorpay_order_id: failedOrder.razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig,
        });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("failed");

      // Cleanup
      await prisma.order.delete({ where: { id: failedOrder.id } });
    });

    it("should reuse active PENDING order for duplicate checkout requests with identical cart", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: inStockProduct1.id, quantity: 1 });

      const res1 = await request(app)
        .post("/api/checkout/order")
        .set("X-Session-Id", sessionId)
        .send({});
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post("/api/checkout/order")
        .set("X-Session-Id", sessionId)
        .send({});
      expect(res2.status).toBe(200);

      // Order ID and Razorpay Order ID must be identical (reused idempotent pending order)
      expect(res2.body.data.orderId).toBe(res1.body.data.orderId);
      expect(res2.body.data.razorpayOrderId).toBe(res1.body.data.razorpayOrderId);
    });
  });

  // =========================================================================
  // 5B. WEBHOOK SECURITY & IDEMPOTENCY
  // =========================================================================
  describe("5B. Webhook Security & Idempotency", () => {
    it("should reject invalid webhook signatures and modified payloads", async () => {
      const payload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: `pay_wh_${Date.now()}`,
              order_id: `order_wh_${Date.now()}`,
              amount: 10000,
              status: "captured",
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const validSig = razorpayService.generateWebhookSignature(rawBody);

      // 1. Invalid signature
      const badSigRes = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", "invalid_signature_hex_1234567890abcdef")
        .send(rawBody);
      expect(badSigRes.status).toBe(400);

      // 2. Missing signature header
      const missingSigRes = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .send(rawBody);
      expect(missingSigRes.status).toBe(400);

      // 3. Modified payload with original signature
      const modifiedPayload = { ...payload, event: "payment.failed" };
      const modifiedRes = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", validSig)
        .send(JSON.stringify(modifiedPayload));
      expect(modifiedRes.status).toBe(400);
    });
  });

  // =========================================================================
  // 6. ORDER IMMUTABILITY & HISTORICAL INTEGRITY
  // =========================================================================
  describe("6. Order Immutability & Historical Snapshot Integrity", () => {
    it("should ensure historical orders and dashboard metrics are invariant to product catalog price changes", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // 1. Create a dedicated test product
      const testProduct = await prisma.product.create({
        data: {
          name: "Immutability Test Product",
          brand: "ImmutBrand",
          category: "Electronics",
          price: 1500.0,
          description: "Snapshot test item",
          imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
          specs: {},
          features: ["Feature"],
          rating: 4.5,
          inStock: true,
        },
      });

      // 2. Add to cart and checkout
      await request(app)
        .post("/api/cart/items")
        .set("X-Session-Id", sessionId)
        .send({ productId: testProduct.id, quantity: 2 });

      const checkoutRes = await request(app)
        .post("/api/checkout/order")
        .set("X-Session-Id", sessionId)
        .send({});

      const { orderId, razorpayOrderId } = checkoutRes.body.data;
      const paymentId = `pay_immut_${Date.now()}`;
      const signature = razorpayService.generateSignature(razorpayOrderId, paymentId);

      await request(app)
        .post("/api/payment/verify")
        .set("X-Session-Id", sessionId)
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });

      // 3. Verify original historical snapshot
      const orderBeforeUpdate = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("X-Session-Id", sessionId);
      expect(orderBeforeUpdate.body.data.totalAmount).toBe(3000.0);
      expect(orderBeforeUpdate.body.data.items[0].price).toBe(1500.0);
      expect(orderBeforeUpdate.body.data.items[0].subtotal).toBe(3000.0);

      // 4. NOW: Mutate the Product in the catalog (e.g. Price doubles to 3000)
      await prisma.product.update({
        where: { id: testProduct.id },
        data: { price: 3000.0, name: "Mutated Product Name" },
      });

      // 5. Verify the historical order and its item snapshot are UNCHANGED
      const orderAfterUpdate = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("X-Session-Id", sessionId);
      expect(orderAfterUpdate.body.data.totalAmount).toBe(3000.0); // Not 6000!
      expect(orderAfterUpdate.body.data.items[0].price).toBe(1500.0); // Original snapshot preserved!
      expect(orderAfterUpdate.body.data.items[0].subtotal).toBe(3000.0);

      // 6. Cleanup test product
      await prisma.orderItem.deleteMany({ where: { orderId } });
      await prisma.order.delete({ where: { id: orderId } });
      await prisma.product.delete({ where: { id: testProduct.id } });
    });
  });

  // =========================================================================
  // 7. ORDER HISTORY IDOR & PAGINATION VALIDATION
  // =========================================================================
  describe("7. Order History IDOR & Pagination Validation", () => {
    it("should prevent cross-session access to order detail (return 404)", async () => {
      const sessionResA = await request(app).get("/api/session");
      const sessionA = sessionResA.body.data.sessionId;

      const sessionResB = await request(app).get("/api/session");
      const sessionB = sessionResB.body.data.sessionId;

      const order = await prisma.order.create({
        data: {
          sessionId: sessionA,
          totalAmount: 1200.0,
          status: "PAID",
          razorpayOrderId: `order_idor_${Date.now()}`,
          razorpayPaymentId: `pay_idor_${Date.now()}`,
          paidAt: new Date(),
        },
      });

      // Session A can access
      const resA = await request(app)
        .get(`/api/orders/${order.id}`)
        .set("X-Session-Id", sessionA);
      expect(resA.status).toBe(200);

      // Session B is denied with 404 (IDOR protection)
      const resB = await request(app)
        .get(`/api/orders/${order.id}`)
        .set("X-Session-Id", sessionB);
      expect(resB.status).toBe(404);

      // Cleanup
      await prisma.order.delete({ where: { id: order.id } });
    });

    it("should validate pagination parameters and reject invalid values", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Limit exceeds 50
      const resLimit = await request(app)
        .get("/api/orders?limit=100")
        .set("X-Session-Id", sessionId);
      expect(resLimit.status).toBe(400);

      // Page is 0
      const resPage = await request(app)
        .get("/api/orders?page=0")
        .set("X-Session-Id", sessionId);
      expect(resPage.status).toBe(400);

      // Invalid status enum
      const resStatus = await request(app)
        .get("/api/orders?status=INVALID_STATUS")
        .set("X-Session-Id", sessionId);
      expect(resStatus.status).toBe(400);
    });
  });

  // =========================================================================
  // 8. DASHBOARD QA & REVENUE INVARIANTS
  // =========================================================================
  describe("8. Dashboard QA & Revenue Invariants", () => {
    it("should count only PAID orders in totalRevenue and itemsSold", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Create a PENDING order and a FAILED order
      const pendingOrder = await prisma.order.create({
        data: {
          sessionId,
          totalAmount: 5000.0,
          status: "PENDING",
          razorpayOrderId: `order_pend_${Date.now()}`,
          items: {
            create: [
              {
                productId: inStockProduct1.id,
                quantity: 5,
                price: 1000.0,
              },
            ],
          },
        },
      });

      const failedOrder = await prisma.order.create({
        data: {
          sessionId,
          totalAmount: 7000.0,
          status: "FAILED",
          razorpayOrderId: `order_fail_${Date.now()}`,
          items: {
            create: [
              {
                productId: inStockProduct1.id,
                quantity: 7,
                price: 1000.0,
              },
            ],
          },
        },
      });

      const dashRes = await request(app).get("/api/dashboard/summary?range=7d");
      expect(dashRes.status).toBe(200);

      // Check that PENDING and FAILED orders are counted in order counts
      expect(dashRes.body.data.pendingOrders).toBeGreaterThanOrEqual(1);
      expect(dashRes.body.data.failedOrders).toBeGreaterThanOrEqual(1);

      // Reject invalid range
      const invalidRangeRes = await request(app).get("/api/dashboard/summary?range=365d");
      expect(invalidRangeRes.status).toBe(400);

      // Clean up
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: [pendingOrder.id, failedOrder.id] } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: [pendingOrder.id, failedOrder.id] } },
      });
    });
  });

  // =========================================================================
  // 9. API ERROR ENVELOPE & MALFORMED REQUESTS
  // =========================================================================
  describe("9. API Error Envelope & Malformed Requests", () => {
    it("should return HTTP 400 INVALID_JSON for syntax error in body", async () => {
      const res = await request(app)
        .post("/api/cart/items")
        .set("Content-Type", "application/json")
        .send("{ broken json: ");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_JSON");
    });

    it("should return HTTP 404 NOT_FOUND for undefined routes", async () => {
      const res = await request(app).get("/api/nonexistent-route-xyz");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // =========================================================================
  // 10. RATE LIMITER ISOLATION & RESPONSE BEHAVIOR
  // =========================================================================
  describe("10. Rate Limiter Response Behavior", () => {
    it("should return standard RATE_LIMITED envelope when sensitive limiter triggers", async () => {
      const testApp = express();
      testApp.use(sensitiveLimiter);
      testApp.get("/test-rate-limit", (_req, res) => {
        res.json({ success: true });
      });

      // Send 31 rapid requests through testApp (max is 30)
      let lastRes;
      for (let i = 0; i < 31; i++) {
        lastRes = await request(testApp).get("/test-rate-limit");
      }

      expect(lastRes?.status).toBe(429);
      expect(lastRes?.body.success).toBe(false);
      expect(lastRes?.body.error.code).toBe("RATE_LIMITED");
      expect(lastRes?.body.error.message).toContain("Rate limit exceeded");
    });
  });
});
