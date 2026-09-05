import Razorpay from "razorpay";
import crypto from "crypto";
import { env } from "../config/env.js";
import { ExternalServiceError, ValidationError, InternalError, AppError } from "../utils/errors.js";

export interface CreateRazorpayOrderParams {
  amount: number; // in paise
  currency?: string; // defaults to "INR"
  receipt: string; // safe internal identifier
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string; // "order_..."
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

export class RazorpayService {
  private client: Razorpay | null = null;

  constructor() {
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      this.client = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    }
  }

  /**
   * Helper to get client or throw if credentials missing
   */
  private getClient(): Razorpay {
    if (!this.client) {
      if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
        throw new ExternalServiceError(
          "Razorpay credentials are not configured on the server."
        );
      }
      this.client = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    }
    return this.client;
  }

  /**
   * Overrides or sets client instance (useful for unit testing and mocks)
   */
  setClient(mockClient: Razorpay | null) {
    this.client = mockClient;
  }

  /**
   * Creates a Razorpay Order in Test Mode.
   * Amount must be in paise (integer). Currency is fixed to INR.
   */
  async createOrder(params: CreateRazorpayOrderParams): Promise<RazorpayOrderResult> {
    const { amount, currency = "INR", receipt, notes = {} } = params;

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError("Order amount must be a positive integer in paise");
    }

    if (currency !== "INR") {
      throw new ValidationError("Only INR currency is supported");
    }

    // Razorpay receipt maximum length is 40 characters
    const sanitizedReceipt = receipt.slice(0, 40);

    // If running with placeholder template credentials from .env.example, generate a simulated Test Mode order
    const isPlaceholder =
      !env.RAZORPAY_KEY_ID ||
      env.RAZORPAY_KEY_ID === "rzp_test_..." ||
      env.RAZORPAY_KEY_ID.includes("placeholder") ||
      !env.RAZORPAY_KEY_SECRET ||
      env.RAZORPAY_KEY_SECRET === "your_razorpay_key_secret_here" ||
      env.RAZORPAY_KEY_SECRET.includes("placeholder") ||
      process.env.MOCK_PAYMENTS === "true";

    if (isPlaceholder) {
      console.warn(
        "[RazorpayService] Notice: Template placeholder RAZORPAY_KEY_ID / SECRET detected. Using simulated Test Mode order."
      );
      return {
        id: `order_${Math.random().toString(36).substring(2, 16)}`,
        entity: "order",
        amount,
        amount_paid: 0,
        amount_due: amount,
        currency,
        receipt: sanitizedReceipt,
        status: "created",
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    try {
      const razorpay = this.getClient();
      const order = await razorpay.orders.create({
        amount,
        currency,
        receipt: sanitizedReceipt,
        notes,
      });

      return order as unknown as RazorpayOrderResult;
    } catch (error: any) {
      console.error("[RazorpayService] Order creation error:", error?.message || error);
      throw new ExternalServiceError(
        error?.error?.description ||
          error?.message ||
          "Failed to create order with Razorpay payment gateway."
      );
    }
  }

  /**
   * Generates an authoritative HMAC SHA-256 signature for Razorpay payment payloads.
   * Useful for internal verification and deterministic test suite execution.
   */
  generateSignature(orderId: string, paymentId: string, secret?: string): string {
    const keySecret = secret || env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new ExternalServiceError("RAZORPAY_KEY_SECRET is not configured.");
    }
    const payload = `${orderId}|${paymentId}`;
    return crypto.createHmac("sha256", keySecret).update(payload).digest("hex");
  }

  /**
   * Cryptographically verifies the Razorpay payment signature using HMAC SHA-256
   * and timing-safe equality comparison. Handles buffer length mismatches safely.
   */
  verifyPaymentSignature(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;

    // Reject immediately if any required component is missing or non-string
    if (
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature ||
      typeof razorpayOrderId !== "string" ||
      typeof razorpayPaymentId !== "string" ||
      typeof razorpaySignature !== "string"
    ) {
      return false;
    }

    const secret = env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("[RazorpayService] Missing RAZORPAY_KEY_SECRET for signature verification.");
      return false;
    }

    try {
      const expectedSignature = this.generateSignature(razorpayOrderId, razorpayPaymentId, secret);

      const expectedBuffer = Buffer.from(expectedSignature, "utf8");
      const actualBuffer = Buffer.from(razorpaySignature, "utf8");

      // timingSafeEqual throws if lengths differ; check length first for safe failure
      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (err) {
      console.error("[RazorpayService] Unexpected error during signature verification:", err);
      return false;
    }
  }

  /**
   * Generates an HMAC SHA-256 signature for a raw webhook payload body.
   * Useful for unit testing and deterministic simulation.
   */
  generateWebhookSignature(rawBody: string | Buffer, secret?: string): string {
    const webhookSecret =
      secret !== undefined
        ? secret
        : (process.env.RAZORPAY_WEBHOOK_SECRET !== undefined
            ? process.env.RAZORPAY_WEBHOOK_SECRET
            : env.RAZORPAY_WEBHOOK_SECRET);
    if (!webhookSecret || webhookSecret.trim() === "") {
      throw new InternalError("RAZORPAY_WEBHOOK_SECRET is not configured on the server.");
    }
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
    return crypto.createHmac("sha256", webhookSecret).update(bodyBuffer).digest("hex");
  }

  /**
   * Cryptographically verifies the Razorpay Webhook signature using HMAC SHA-256
   * and timing-safe buffer comparison over the raw request body.
   */
  verifyWebhookSignature(params: {
    rawBody: string | Buffer | undefined;
    signature: string | undefined;
    secret?: string;
  }): boolean {
    const { rawBody, signature, secret } = params;

    if (!signature || typeof signature !== "string" || signature.trim() === "") {
      return false;
    }

    if (rawBody === undefined || rawBody === null) {
      return false;
    }

    const webhookSecret =
      secret !== undefined
        ? secret
        : (process.env.RAZORPAY_WEBHOOK_SECRET !== undefined
            ? process.env.RAZORPAY_WEBHOOK_SECRET
            : env.RAZORPAY_WEBHOOK_SECRET);

    if (!webhookSecret || webhookSecret.trim() === "") {
      throw new InternalError("RAZORPAY_WEBHOOK_SECRET is not configured on the server.");
    }

    try {
      const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(bodyBuffer)
        .digest("hex");

      const expectedBuffer = Buffer.from(expectedSignature, "utf8");
      const actualBuffer = Buffer.from(signature.trim(), "utf8");

      // Length guard prevents RangeError from timingSafeEqual
      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("[RazorpayService] Unexpected error during webhook signature verification:", err);
      return false;
    }
  }
}

export const razorpayService = new RazorpayService();
export default razorpayService;
