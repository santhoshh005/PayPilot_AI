import crypto from "crypto";
import prisma from "../lib/prisma.js";
import razorpayService from "./razorpayService.js";
import { ValidationError } from "../utils/errors.js";

export interface WebhookProcessingResult {
  success: boolean;
  message: string;
  orderId?: string;
  duplicate?: boolean;
  ignored?: boolean;
}

export class WebhookService {
  /**
   * Resolves a unique event identifier for idempotency tracking.
   */
  private resolveEventId(
    headerEventId: string | undefined,
    payload: any,
    rawBody: Buffer
  ): string {
    if (headerEventId && typeof headerEventId === "string" && headerEventId.trim()) {
      return headerEventId.trim();
    }
    if (payload?.id && typeof payload.id === "string" && payload.id.trim()) {
      return payload.id.trim();
    }
    if (payload?.event_id && typeof payload.event_id === "string" && payload.event_id.trim()) {
      return payload.event_id.trim();
    }

    const event = payload?.event || "unknown";
    const paymentId = payload?.payload?.payment?.entity?.id;
    const orderId = payload?.payload?.payment?.entity?.order_id || payload?.payload?.order?.entity?.id;

    if (paymentId && orderId) {
      return `${event}_${orderId}_${paymentId}`;
    }

    // Fallback: SHA-256 hash of the exact raw body
    return `hash_${crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 32)}`;
  }

  /**
   * Validates incoming webhook cryptographic signature, processes event,
   * enforces idempotency and monotonic state transitions, and records event history.
   */
  async processWebhook(params: {
    rawBody: Buffer | undefined;
    signatureHeader: string | undefined;
    headerEventId?: string;
    secretOverride?: string;
  }): Promise<WebhookProcessingResult> {
    const { rawBody, signatureHeader, headerEventId, secretOverride } = params;

    // 1. Validate signature header presence
    if (!signatureHeader || typeof signatureHeader !== "string" || signatureHeader.trim() === "") {
      throw new ValidationError("Missing X-Razorpay-Signature header.");
    }

    // 2. Validate raw body presence
    if (!rawBody || !Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      throw new ValidationError("Webhook request body is empty or unavailable.");
    }

    // 3. Cryptographic Signature Verification (HMAC-SHA256 timing-safe)
    const isSignatureValid = razorpayService.verifyWebhookSignature({
      rawBody,
      signature: signatureHeader,
      secret: secretOverride,
    });

    if (!isSignatureValid) {
      throw new ValidationError("Invalid webhook signature.");
    }

    // 4. Parse JSON payload from verified raw bytes
    let eventPayload: any;
    try {
      eventPayload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new ValidationError("Malformed JSON webhook payload.");
    }

    if (!eventPayload || typeof eventPayload !== "object" || !eventPayload.event) {
      throw new ValidationError("Invalid webhook payload: missing event property.");
    }

    const eventType: string = eventPayload.event;
    const eventId = this.resolveEventId(headerEventId, eventPayload, rawBody);

    // 5. Idempotency Check: Prevent duplicate processing if event was already recorded
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { razorpayEventId: eventId },
    });

    if (existingEvent) {
      return {
        success: true,
        message: "Webhook event already processed.",
        orderId: existingEvent.orderId || undefined,
        duplicate: true,
      };
    }

    // 6. Handle Supported Events
    switch (eventType) {
      case "payment.captured":
        return await this.handlePaymentCaptured(eventId, eventPayload);

      case "payment.failed":
        return await this.handlePaymentFailed(eventId, eventPayload);

      default:
        // Safely record and acknowledge other webhook events without error
        await prisma.webhookEvent.create({
          data: {
            razorpayEventId: eventId,
            eventType,
            payload: eventPayload,
          },
        });
        return {
          success: true,
          message: `Webhook event "${eventType}" received and recorded.`,
        };
    }
  }

  /**
   * Handles payment.captured event:
   * - Transitions order to PAID
   * - Sets razorpayPaymentId and paidAt
   * - Atomically clears the associated user cart
   * - Persists WebhookEvent record for idempotency
   */
  private async handlePaymentCaptured(
    eventId: string,
    payload: any
  ): Promise<WebhookProcessingResult> {
    const paymentEntity = payload.payload?.payment?.entity;
    const paymentId = paymentEntity?.id;
    const razorpayOrderId =
      paymentEntity?.order_id || payload.payload?.order?.entity?.id;

    if (!razorpayOrderId) {
      // Record event and acknowledge if order_id is missing from payload
      await prisma.webhookEvent.create({
        data: {
          razorpayEventId: eventId,
          eventType: "payment.captured",
          payload,
        },
      });
      return {
        success: true,
        message: "payment.captured payload missing order_id.",
        ignored: true,
      };
    }

    // Locate internal order
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
    });

    if (!order) {
      await prisma.webhookEvent.create({
        data: {
          razorpayEventId: eventId,
          eventType: "payment.captured",
          payload,
        },
      });
      return {
        success: true,
        message: `Order not found for razorpayOrderId "${razorpayOrderId}".`,
        ignored: true,
      };
    }

    // If order is already PAID: record event and return idempotent success without mutating order or cart
    if (order.status === "PAID") {
      await prisma.webhookEvent.create({
        data: {
          razorpayEventId: eventId,
          eventType: "payment.captured",
          orderId: order.id,
          payload,
        },
      });
      return {
        success: true,
        message: "Order is already marked as PAID. No duplicate operations performed.",
        orderId: order.id,
        duplicate: true,
      };
    }

    // If order was marked FAILED previously, do not corrupt state
    if (order.status === "FAILED") {
      await prisma.webhookEvent.create({
        data: {
          razorpayEventId: eventId,
          eventType: "payment.captured",
          orderId: order.id,
          payload,
        },
      });
      return {
        success: true,
        message: "Order was marked FAILED. payment.captured recorded without state overwrite.",
        orderId: order.id,
        ignored: true,
      };
    }

    // Monotonic transition: PENDING -> PAID inside an atomic transaction
    const paidAtDate = paymentEntity?.created_at
      ? new Date(paymentEntity.created_at * 1000)
      : new Date();

    const finalizedOrder = await prisma.$transaction(
      async (tx) => {
        // Step A: Mark order as PAID
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            razorpayPaymentId: paymentId || order.razorpayPaymentId,
            paidAt: paidAtDate,
          },
        });

        // Step B: Atomically clear the user's cart in the database
        const userCart = await tx.cart.findUnique({
          where: { sessionId: order.sessionId },
        });

        if (userCart) {
          await tx.cartItem.deleteMany({
            where: { cartId: userCart.id },
          });
        }

        // Step C: Record WebhookEvent for idempotency
        await tx.webhookEvent.create({
          data: {
            razorpayEventId: eventId,
            eventType: "payment.captured",
            orderId: order.id,
            payload,
          },
        });

        return updated;
      },
      { maxWait: 10000, timeout: 20000 }
    );

    return {
      success: true,
      message: "Order successfully marked PAID and cart cleared.",
      orderId: finalizedOrder.id,
    };
  }

  /**
   * Handles payment.failed event:
   * - Locates the order
   * - If PENDING, transitions to FAILED
   * - If already PAID, NEVER downgrades the order (protects paid state)
   * - NEVER clears the cart (items remain intact for customer retry)
   * - Persists WebhookEvent record for idempotency
   */
  private async handlePaymentFailed(
    eventId: string,
    payload: any
  ): Promise<WebhookProcessingResult> {
    const paymentEntity = payload.payload?.payment?.entity;
    const razorpayOrderId =
      paymentEntity?.order_id || payload.payload?.order?.entity?.id;

    if (!razorpayOrderId) {
      await prisma.webhookEvent.create({
        data: {
          razorpayEventId: eventId,
          eventType: "payment.failed",
          payload,
        },
      });
      return {
        success: true,
        message: "payment.failed payload missing order_id.",
        ignored: true,
      };
    }

    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
    });

    if (!order) {
      await prisma.webhookEvent.create({
        data: {
          razorpayEventId: eventId,
          eventType: "payment.failed",
          payload,
        },
      });
      return {
        success: true,
        message: `Order not found for razorpayOrderId "${razorpayOrderId}".`,
        ignored: true,
      };
    }

    // Critical State Safety Invariant: NEVER downgrade an already PAID order to FAILED
    if (order.status === "PAID") {
      await prisma.webhookEvent.create({
        data: {
          razorpayEventId: eventId,
          eventType: "payment.failed",
          orderId: order.id,
          payload,
        },
      });
      return {
        success: true,
        message: "Order is already PAID. Ignored failure event to protect paid state.",
        orderId: order.id,
        ignored: true,
      };
    }

    // Monotonic transition: PENDING -> FAILED. Cart remains intact!
    const failedOrder = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            status: "FAILED",
          },
        });

        await tx.webhookEvent.create({
          data: {
            razorpayEventId: eventId,
            eventType: "payment.failed",
            orderId: order.id,
            payload,
          },
        });

        return updated;
      },
      { maxWait: 10000, timeout: 20000 }
    );

    return {
      success: true,
      message: "Order marked as FAILED. Cart items preserved intact.",
      orderId: failedOrder.id,
    };
  }
}

export const webhookService = new WebhookService();
export default webhookService;
