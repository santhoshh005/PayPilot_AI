import { describe, it, expect, afterAll, beforeEach } from "vitest";
import request from "supertest";
import crypto from "crypto";
import app from "../index.js";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.js";

describe("Phase 9: Secure Razorpay Webhook Handlers", { timeout: 30000 }, () => {
  let inStockProduct: { id: string; name: string; price: number };
  const testWebhookSecret = env.RAZORPAY_WEBHOOK_SECRET || "placeholder_webhook_secret";

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
  async function createTestOrder() {
    const sessionRes = await request(app).get("/api/session");
    const sessionId = sessionRes.body.data.sessionId;

    await request(app)
      .post("/api/cart/items")
      .set("x-session-id", sessionId)
      .send({ productId: inStockProduct.id, quantity: 1 });

    const checkoutRes = await request(app)
      .post("/api/checkout/order")
      .set("x-session-id", sessionId)
      .send({});

    expect(checkoutRes.status).toBe(200);
    return {
      ...(checkoutRes.body.data as {
        orderId: string;
        razorpayOrderId: string;
        amount: number;
        currency: string;
      }),
      sessionId,
    };
  }

  // Helper to construct realistic Razorpay webhook JSON payload
  function createWebhookPayload(params: {
    event: string;
    razorpayOrderId: string;
    paymentId?: string;
    eventId?: string;
  }) {
    const paymentId = params.paymentId || `pay_${crypto.randomBytes(8).toString("hex")}`;
    return {
      entity: "event",
      account_id: "acc_test_paypilot",
      event: params.event,
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: paymentId,
            entity: "payment",
            amount: 250000,
            currency: "INR",
            status: params.event === "payment.captured" ? "captured" : "failed",
            order_id: params.razorpayOrderId,
            captured: params.event === "payment.captured",
            description: "PayPilot AI Checkout",
            created_at: Math.floor(Date.now() / 1000),
          },
        },
        order: {
          entity: {
            id: params.razorpayOrderId,
            entity: "order",
            amount: 250000,
            amount_paid: params.event === "payment.captured" ? 250000 : 0,
            amount_due: params.event === "payment.captured" ? 0 : 250000,
            currency: "INR",
            status: params.event === "payment.captured" ? "paid" : "attempted",
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  // Helper to compute valid webhook signature
  function signPayload(rawBody: string, secret = testWebhookSecret): string {
    return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. payment.captured Lifecycle & Cart Atomicity
  // ──────────────────────────────────────────────────────────────────────────
  describe("1. Valid payment.captured Event", () => {
    it("1. should verify valid webhook signature, transition PENDING order to PAID, and atomically clear cart", async () => {
      const orderData = await createTestOrder();
      const sessionId = orderData.sessionId;

      // Verify cart has 1 item before webhook
      const cartBefore = await prisma.cartItem.count({
        where: { cart: { sessionId } },
      });
      expect(cartBefore).toBe(1);

      const paymentId = `pay_cap_${crypto.randomBytes(6).toString("hex")}`;
      const payloadObj = createWebhookPayload({
        event: "payment.captured",
        razorpayOrderId: orderData.razorpayOrderId,
        paymentId,
      });

      const rawBody = JSON.stringify(payloadObj);
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify Order transitioned to PAID in database
      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderData.orderId },
      });
      expect(updatedOrder).not.toBeNull();
      expect(updatedOrder?.status).toBe("PAID");
      expect(updatedOrder?.razorpayPaymentId).toBe(paymentId);
      expect(updatedOrder?.paidAt).not.toBeNull();

      // Verify Cart was atomically cleared in database
      const cartAfter = await prisma.cartItem.count({
        where: { cart: { sessionId } },
      });
      expect(cartAfter).toBe(0);
    });

    it("12. should verify cart items are deleted after payment.captured", async () => {
      const orderData = await createTestOrder();
      const sessionId = orderData.sessionId;

      const payloadObj = createWebhookPayload({
        event: "payment.captured",
        razorpayOrderId: orderData.razorpayOrderId,
      });
      const rawBody = JSON.stringify(payloadObj);
      const signature = signPayload(rawBody);

      await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(rawBody);

      const cartItems = await prisma.cartItem.findMany({
        where: { cart: { sessionId } },
      });
      expect(cartItems).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Signature Validation & Security Guards
  // ──────────────────────────────────────────────────────────────────────────
  describe("2. Webhook Signature Security & Error Handling", () => {
    it("2. should reject invalid webhook signature with HTTP 400 and preserve PENDING order", async () => {
      const orderData = await createTestOrder();
      const sessionId = orderData.sessionId;

      const payloadObj = createWebhookPayload({
        event: "payment.captured",
        razorpayOrderId: orderData.razorpayOrderId,
      });
      const rawBody = JSON.stringify(payloadObj);

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", "invalid_signature_hex_1234567890abcdef")
        .send(rawBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");

      // Verify order remains PENDING
      const order = await prisma.order.findUnique({
        where: { id: orderData.orderId },
      });
      expect(order?.status).toBe("PENDING");

      // Verify cart remains intact
      const cartCount = await prisma.cartItem.count({
        where: { cart: { sessionId } },
      });
      expect(cartCount).toBe(1);
    });

    it("3. should reject missing X-Razorpay-Signature header with HTTP 400", async () => {
      const payloadObj = createWebhookPayload({
        event: "payment.captured",
        razorpayOrderId: "order_dummy",
      });
      const rawBody = JSON.stringify(payloadObj);

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .send(rawBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toMatch(/Missing X-Razorpay-Signature/i);
    });

    it("4. should return HTTP 500 when RAZORPAY_WEBHOOK_SECRET is not configured on server", async () => {
      const prevSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      process.env.RAZORPAY_WEBHOOK_SECRET = "";

      try {
        const payloadObj = createWebhookPayload({
          event: "payment.captured",
          razorpayOrderId: "order_dummy",
        });
        const rawBody = JSON.stringify(payloadObj);

        // Even with a signature, missing server secret should trigger 500
        const res = await request(app)
          .post("/api/payment/webhook")
          .set("Content-Type", "application/json")
          .set("X-Razorpay-Signature", "any_signature")
          .send(rawBody);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe("INTERNAL_ERROR");
      } finally {
        process.env.RAZORPAY_WEBHOOK_SECRET = prevSecret;
      }
    });

    it("5. should reject tampered payload where body differs from signature with HTTP 400", async () => {
      const originalPayload = createWebhookPayload({
        event: "payment.captured",
        razorpayOrderId: "order_original",
      });
      const rawOriginal = JSON.stringify(originalPayload);
      const signatureForOriginal = signPayload(rawOriginal);

      // Tampered payload
      const tamperedPayload = {
        ...originalPayload,
        account_id: "acc_malicious_attacker",
      };
      const rawTampered = JSON.stringify(tamperedPayload);

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signatureForOriginal)
        .send(rawTampered);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("11. should reject invalid/malformed JSON webhook payload with HTTP 400", async () => {
      const malformedBody = "{ invalid_json_payload: not_valid";
      const signature = signPayload(malformedBody);

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(malformedBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. payment.failed Event & Cart Preservation
  // ──────────────────────────────────────────────────────────────────────────
  describe("3. payment.failed Event Handling", () => {
    it("6. should transition PENDING order to FAILED upon payment.failed event", async () => {
      const orderData = await createTestOrder();

      const payloadObj = createWebhookPayload({
        event: "payment.failed",
        razorpayOrderId: orderData.razorpayOrderId,
      });
      const rawBody = JSON.stringify(payloadObj);
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderData.orderId },
      });
      expect(updatedOrder?.status).toBe("FAILED");
    });

    it("13. should preserve cart items intact when payment.failed event occurs", async () => {
      const orderData = await createTestOrder();
      const sessionId = orderData.sessionId;

      const payloadObj = createWebhookPayload({
        event: "payment.failed",
        razorpayOrderId: orderData.razorpayOrderId,
      });
      const rawBody = JSON.stringify(payloadObj);
      const signature = signPayload(rawBody);

      await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(rawBody);

      // Cart MUST still contain items for customer to retry checkout
      const cartCount = await prisma.cartItem.count({
        where: { cart: { sessionId } },
      });
      expect(cartCount).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Idempotency & Edge Cases
  // ──────────────────────────────────────────────────────────────────────────
  describe("4. Idempotency & Edge Cases", () => {
    it("7. should safely handle webhook for non-existent order without crashing", async () => {
      const payloadObj = createWebhookPayload({
        event: "payment.captured",
        razorpayOrderId: "order_nonexistent_99999",
      });
      const rawBody = JSON.stringify(payloadObj);
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("8. should process duplicate webhook event idempotently without duplicate side effects", async () => {
      const orderData = await createTestOrder();
      const eventId = `evt_idem_${crypto.randomBytes(8).toString("hex")}`;

      const payloadObj = {
        ...createWebhookPayload({
          event: "payment.captured",
          razorpayOrderId: orderData.razorpayOrderId,
        }),
        id: eventId,
      };

      const rawBody = JSON.stringify(payloadObj);
      const signature = signPayload(rawBody);

      // First delivery: processes event
      const res1 = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .set("X-Razorpay-Event-Id", eventId)
        .send(rawBody);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      // Second delivery (retry by Razorpay): idempotent no-op
      const res2 = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .set("X-Razorpay-Event-Id", eventId)
        .send(rawBody);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.message).toMatch(/already processed/i);

      // Verify only 1 WebhookEvent row was stored
      const eventCount = await prisma.webhookEvent.count({
        where: { razorpayEventId: eventId },
      });
      expect(eventCount).toBe(1);
    });

    it("9. should return safe success when already PAID order receives duplicate payment.captured", async () => {
      const orderData = await createTestOrder();

      // Mark order as PAID first
      await prisma.order.update({
        where: { id: orderData.orderId },
        data: { status: "PAID", paidAt: new Date() },
      });

      const payloadObj = createWebhookPayload({
        event: "payment.captured",
        razorpayOrderId: orderData.razorpayOrderId,
      });
      const rawBody = JSON.stringify(payloadObj);
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const orderAfter = await prisma.order.findUnique({
        where: { id: orderData.orderId },
      });
      expect(orderAfter?.status).toBe("PAID");
    });

    it("10. should NEVER downgrade an already PAID order to FAILED when payment.failed event arrives", async () => {
      const orderData = await createTestOrder();

      const originalPaidAt = new Date();
      const originalPaymentId = "pay_already_settled_123";

      // Order is already PAID
      await prisma.order.update({
        where: { id: orderData.orderId },
        data: {
          status: "PAID",
          razorpayPaymentId: originalPaymentId,
          paidAt: originalPaidAt,
        },
      });

      // Delayed or spurious payment.failed webhook arrives
      const payloadObj = createWebhookPayload({
        event: "payment.failed",
        razorpayOrderId: orderData.razorpayOrderId,
      });
      const rawBody = JSON.stringify(payloadObj);
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Order MUST REMAIN PAID with original payment details
      const order = await prisma.order.findUnique({
        where: { id: orderData.orderId },
      });
      expect(order?.status).toBe("PAID");
      expect(order?.razorpayPaymentId).toBe(originalPaymentId);
    });

    it("14. should NEVER expose RAZORPAY_WEBHOOK_SECRET or HMAC signatures in responses", async () => {
      const orderData = await createTestOrder();

      const payloadObj = createWebhookPayload({
        event: "payment.captured",
        razorpayOrderId: orderData.razorpayOrderId,
      });
      const rawBody = JSON.stringify(payloadObj);
      const signature = signPayload(rawBody);

      const res = await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(rawBody);

      const stringifiedResponse = JSON.stringify(res.body);
      expect(stringifiedResponse).not.toContain(testWebhookSecret);
      expect(stringifiedResponse).not.toContain(signature);
    });

    it("15. should enforce monotonic payment state transition invariants", async () => {
      // PENDING -> PAID (allowed)
      const order1 = await createTestOrder();
      const capPayload = createWebhookPayload({
        event: "payment.captured",
        razorpayOrderId: order1.razorpayOrderId,
      });
      await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signPayload(JSON.stringify(capPayload)))
        .send(JSON.stringify(capPayload));

      const updated1 = await prisma.order.findUnique({ where: { id: order1.orderId } });
      expect(updated1?.status).toBe("PAID");

      // PENDING -> FAILED (allowed)
      const order2 = await createTestOrder();
      const failPayload = createWebhookPayload({
        event: "payment.failed",
        razorpayOrderId: order2.razorpayOrderId,
      });
      await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signPayload(JSON.stringify(failPayload)))
        .send(JSON.stringify(failPayload));

      const updated2 = await prisma.order.findUnique({ where: { id: order2.orderId } });
      expect(updated2?.status).toBe("FAILED");

      // PAID -> FAILED (disallowed/protected)
      await request(app)
        .post("/api/payment/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signPayload(JSON.stringify(failPayload)))
        .send(JSON.stringify(failPayload));

      const order1AfterFailAttempt = await prisma.order.findUnique({ where: { id: order1.orderId } });
      expect(order1AfterFailAttempt?.status).toBe("PAID");
    });
  });
});
