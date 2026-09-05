import { z } from "zod";

/**
 * Zod validation schema for POST /api/checkout/order request body.
 * Intentionally minimal: client cannot supply amount, currency, or prices.
 * All financial data is strictly determined server-side from PostgreSQL.
 */
export const createCheckoutOrderBodySchema = z.object({
  // Optional client metadata or notes (non-financial)
  notes: z.record(z.string(), z.string()).optional(),
});

export type CreateCheckoutOrderBody = z.infer<typeof createCheckoutOrderBodySchema>;

/**
 * Authoritative checkout order response envelope data
 */
export interface CheckoutOrderResponse {
  orderId: string;
  razorpayOrderId: string;
  amount: number; // in paise (e.g. 129900 for ₹1,299)
  currency: string; // "INR"
  keyId: string; // Razorpay public Key ID (safe for frontend)
}
