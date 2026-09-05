import { z } from "zod";

/**
 * Zod validation schema for POST /api/payment/verify request body.
 * Strictly requires Razorpay's checkout response properties and forbids client-controlled financial fields.
 */
export const verifyPaymentBodySchema = z
  .object({
    razorpay_order_id: z
      .string({ required_error: "razorpay_order_id is required" })
      .min(1, "razorpay_order_id cannot be empty"),
    razorpay_payment_id: z
      .string({ required_error: "razorpay_payment_id is required" })
      .min(1, "razorpay_payment_id cannot be empty"),
    razorpay_signature: z
      .string({ required_error: "razorpay_signature is required" })
      .min(1, "razorpay_signature cannot be empty"),
  })
  .strict();

export type VerifyPaymentBody = z.infer<typeof verifyPaymentBodySchema>;

/**
 * Typed response data returned after successful payment verification
 */
export interface PaymentVerificationResponse {
  orderId: string;
  status: "PAID";
  razorpayOrderId: string;
  razorpayPaymentId: string;
  paidAt: string; // ISO 8601 string
}
