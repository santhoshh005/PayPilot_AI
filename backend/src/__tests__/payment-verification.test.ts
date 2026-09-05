import { describe, it, expect, afterAll, beforeEach } from "vitest";
import request from "supertest";
import crypto from "crypto";
import app from "../index.js";
import prisma from "../lib/prisma.js";
import razorpayService from "../services/razorpayService.js";
import { env } from "../config/env.js";

describe("Phase 8: Server-Side Razorpay Payment Verification", { timeout: 25000 }, () => {
  let inStockProduct: { id: string; name: string; price: number };

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const p = await prisma.product.findFirst({
      where: { inStock: true },
    });
    if (!p) throw new Error("No in-stock product found for tests");
    inStockProduct = { id: p.id, name: p.name, price: Number(p.price) };
  });

  // Helper to create an active cart and checkout order in PENDING status
  async function createTestOrder(sessionId: string) {
    // Add item to cart
    await request(app)
      .post("/api/cart/items")
      .set("x-session-id", sessionId)
      .send({ productId: inStockProduct.id, quantity: 1 });

    // Call checkout to create internal PENDING order + Razorpay order
    const checkoutRes = await request(app)
      .post("/api/checkout/order")
      .set("x-session-id", sessionId)
      .send({});

    expect(checkoutRes.status).toBe(200);
    return checkoutRes.body.data as {
      orderId: string;
      razorpayOrderId: string;
      amount: number;
      currency: string;
      keyId: string;
    };
  }

  describe("1. Valid Signature Verification & Atomic State Transitions", () => {
    it("1, 2, 3, 4. should verify valid payment signature, transition order to PAID, and atomically clear the cart", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const orderData = await createTestOrder(sessionId);
      const paymentId = `pay_test_${Math.random().toString(36).substring(2, 10)}`;

      // Generate valid HMAC SHA-256 signature
      const validSignature = razorpayService.generateSignature(
        orderData.razorpayOrderId,
        paymentId
      );

      // Verify cart has 1 item before verification
      const cartBefore = await request(app)
        .get("/api/cart")
        .set("x-session-id", sessionId);
      expect(cartBefore.body.data.items.length).toBe(1);

      // Send verification request
      const verifyRes = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);

      const data = verifyRes.body.data;
      expect(data.orderId).toBe(orderData.orderId);
      expect(data.status).toBe("PAID"); // 1. Order status is PAID
      expect(data.razorpayOrderId).toBe(orderData.razorpayOrderId);
      expect(data.razorpayPaymentId).toBe(paymentId); // 2. Payment ID saved
      expect(data.paidAt).toBeDefined(); // 3. paidAt populated

      // 4. Verify in PostgreSQL that order is PAID and cart is empty
      const dbOrder = await prisma.order.findUnique({
        where: { id: orderData.orderId },
      });
      expect(dbOrder?.status).toBe("PAID");
      expect(dbOrder?.razorpayPaymentId).toBe(paymentId);
      expect(dbOrder?.paidAt).not.toBeNull();

      const cartAfter = await request(app)
        .get("/api/cart")
        .set("x-session-id", sessionId);
      expect(cartAfter.body.data.items.length).toBe(0); // Cart cleared!
      expect(cartAfter.body.data.subtotal).toBe(0);
    });
  });

  describe("2. Signature Tampering, Invalid Credentials & Negative Cases", () => {
    it("5, 6, 7. should reject invalid signature, keep order PENDING, and leave cart intact", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const orderData = await createTestOrder(sessionId);
      const paymentId = `pay_test_${Math.random().toString(36).substring(2, 10)}`;

      // Tampered / fraudulent signature
      const tamperedSignature = "invalid_fraudulent_signature_00000000000000000000000000000000";

      const verifyRes = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: tamperedSignature,
        });

      expect(verifyRes.status).toBe(400); // 5. Rejected
      expect(verifyRes.body.success).toBe(false);
      expect(verifyRes.body.error.message).toContain("signature verification failed");

      // 6. Verify in DB that order remains PENDING
      const dbOrder = await prisma.order.findUnique({
        where: { id: orderData.orderId },
      });
      expect(dbOrder?.status).toBe("PENDING");
      expect(dbOrder?.razorpayPaymentId).toBeNull();
      expect(dbOrder?.paidAt).toBeNull();

      // 7. Verify cart remains intact
      const cart = await request(app)
        .get("/api/cart")
        .set("x-session-id", sessionId);
      expect(cart.body.data.items.length).toBe(1);
    });

    it("8. should reject request with mismatched payment ID against signature payload", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const orderData = await createTestOrder(sessionId);
      const paymentId1 = "pay_legitimate_123456";
      const paymentId2 = "pay_spoofed_987654";

      // Signature generated for paymentId1
      const signature = razorpayService.generateSignature(
        orderData.razorpayOrderId,
        paymentId1
      );

      // Sent with paymentId2
      const verifyRes = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: paymentId2,
          razorpay_signature: signature,
        });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.success).toBe(false);
    });

    it("9 & 11. should reject verification for non-existent order with 404 NOT_FOUND", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const fakeOrderId = "order_nonexistent_9999999999";
      const paymentId = "pay_test_123456";
      const signature = razorpayService.generateSignature(fakeOrderId, paymentId);

      const verifyRes = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: fakeOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });

      expect(verifyRes.status).toBe(404);
      expect(verifyRes.body.error.code).toBe("NOT_FOUND");
    });

    it("10. should enforce session isolation: Session A cannot verify Session B's order", async () => {
      const sessionA = (await request(app).get("/api/session")).body.data.sessionId;
      const sessionB = (await request(app).get("/api/session")).body.data.sessionId;

      // Order created by Session B
      const orderB = await createTestOrder(sessionB);
      const paymentId = "pay_sessionB_payment";
      const signature = razorpayService.generateSignature(
        orderB.razorpayOrderId,
        paymentId
      );

      // Session A attempts to verify Session B's order
      const verifyRes = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionA)
        .send({
          razorpay_order_id: orderB.razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });

      expect(verifyRes.status).toBe(404);
      expect(verifyRes.body.error.message).toContain("does not belong to the current session");

      // Verify Session B's order is still PENDING
      const dbOrder = await prisma.order.findUnique({
        where: { id: orderB.orderId },
      });
      expect(dbOrder?.status).toBe("PENDING");
    });

    it("15. should reject requests with missing or empty fields via strict Zod validation", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Missing signature
      const res1 = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: "order_123",
          razorpay_payment_id: "pay_123",
        });
      expect(res1.status).toBe(400);

      // Empty string
      const res2 = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: "",
          razorpay_payment_id: "pay_123",
          razorpay_signature: "sig_123",
        });
      expect(res2.status).toBe(400);

      // Extra unexpected financial field (strict schema)
      const res3 = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: "order_123",
          razorpay_payment_id: "pay_123",
          razorpay_signature: "sig_123",
          amount: 100,
        });
      expect(res3.status).toBe(400);
    });

    it("16. should handle malformed signatures and length mismatches safely without throwing unhandled exceptions", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const orderData = await createTestOrder(sessionId);

      // Short signature
      const shortRes = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: "pay_123",
          razorpay_signature: "short",
        });
      expect(shortRes.status).toBe(400);

      // Extremely long signature
      const longRes = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: "pay_123",
          razorpay_signature: "a".repeat(256),
        });
      expect(longRes.status).toBe(400);
    });
  });

  describe("3. Idempotency & Order Lifecycle Security", () => {
    it("12. should return idempotent success for repeated verification of already PAID order with same payment ID", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const orderData = await createTestOrder(sessionId);
      const paymentId = `pay_idem_${Math.random().toString(36).substring(2, 10)}`;
      const signature = razorpayService.generateSignature(
        orderData.razorpayOrderId,
        paymentId
      );

      // First verification call -> 200 PAID
      const res1 = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });
      expect(res1.status).toBe(200);

      // Second verification call (e.g. client retry or network double-invoke) -> 200 idempotent success
      const res2 = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.orderId).toBe(orderData.orderId);
      expect(res2.body.data.status).toBe("PAID");
    });

    it("13. should reject verification if order is already PAID with a DIFFERENT payment ID", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const orderData = await createTestOrder(sessionId);
      const paymentId1 = "pay_first_payment";
      const signature1 = razorpayService.generateSignature(
        orderData.razorpayOrderId,
        paymentId1
      );

      // Successfully pay with paymentId1
      await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: paymentId1,
          razorpay_signature: signature1,
        });

      // Attempt to verify same order with paymentId2
      const paymentId2 = "pay_second_payment";
      const signature2 = razorpayService.generateSignature(
        orderData.razorpayOrderId,
        paymentId2
      );

      const conflictRes = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: paymentId2,
          razorpay_signature: signature2,
        });

      expect(conflictRes.status).toBe(409); // Conflict!
      expect(conflictRes.body.error.code).toBe("CONFLICT");
    });

    it("14. should reject verification if internal order is marked FAILED", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const orderData = await createTestOrder(sessionId);

      // Manually set status to FAILED in DB
      await prisma.order.update({
        where: { id: orderData.orderId },
        data: { status: "FAILED" },
      });

      const paymentId = "pay_failed_order_attempt";
      const signature = razorpayService.generateSignature(
        orderData.razorpayOrderId,
        paymentId
      );

      const res = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("Order has failed");
    });

    it("17 & 18. should NEVER return RAZORPAY_KEY_SECRET or expected HMAC in response", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const orderData = await createTestOrder(sessionId);
      const paymentId = "pay_secret_check";
      const validSignature = razorpayService.generateSignature(
        orderData.razorpayOrderId,
        paymentId
      );

      const res = await request(app)
        .post("/api/payment/verify")
        .set("x-session-id", sessionId)
        .send({
          razorpay_order_id: orderData.razorpayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        });

      const responseString = JSON.stringify(res.body);
      if (env.RAZORPAY_KEY_SECRET) {
        expect(responseString).not.toContain(env.RAZORPAY_KEY_SECRET);
      }
      expect(res.body.data.keySecret).toBeUndefined();
      expect(res.body.data.expectedSignature).toBeUndefined();
    });
  });
});
