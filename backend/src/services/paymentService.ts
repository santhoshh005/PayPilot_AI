import prisma from "../lib/prisma.js";
import razorpayService from "./razorpayService.js";
import {
  VerifyPaymentBody,
  PaymentVerificationResponse,
} from "../schemas/payment.js";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../utils/errors.js";

export class PaymentService {
  /**
   * Verifies Razorpay payment signature and updates order to PAID atomically.
   * Clears the user's cart only upon successful cryptographic verification.
   */
  async verifyPayment(
    sessionId: string,
    data: VerifyPaymentBody
  ): Promise<PaymentVerificationResponse> {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = data;

    // 1. Find the internal Order matching both the Razorpay order ID and current session
    const order = await prisma.order.findFirst({
      where: {
        razorpayOrderId: razorpay_order_id,
        sessionId: sessionId,
      },
    });

    if (!order) {
      throw new NotFoundError(
        "Order not found or does not belong to the current session."
      );
    }

    // 2. Handle Idempotency / Order Status Validation
    if (order.status === "PAID") {
      // If already paid with the exact same payment ID, return idempotent success
      if (order.razorpayPaymentId === razorpay_payment_id) {
        return {
          orderId: order.id,
          status: "PAID",
          razorpayOrderId: order.razorpayOrderId!,
          razorpayPaymentId: order.razorpayPaymentId!,
          paidAt: (order.paidAt || new Date()).toISOString(),
        };
      }
      // If already paid with a different payment ID, reject conflict
      throw new ConflictError(
        "Order has already been finalized with a different payment record."
      );
    }

    if (order.status === "FAILED") {
      throw new ValidationError(
        "Order has failed and cannot be verified as paid."
      );
    }

    if (order.status !== "PENDING") {
      throw new ValidationError(
        `Order status "${order.status}" cannot be transitioned to PAID.`
      );
    }

    // 3. Perform Cryptographic HMAC-SHA256 Signature Verification
    const isSignatureValid = razorpayService.verifyPaymentSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    if (!isSignatureValid) {
      throw new ValidationError(
        "Payment signature verification failed. The payment response is invalid or untrusted."
      );
    }

    // 4. Atomic Database Update: Mark Order as PAID, record payment details, and clear cart
    const paidAtTimestamp = new Date();

    const finalizedOrder = await prisma.$transaction(
      async (tx) => {
        // Step A: Update Order status to PAID
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            razorpayPaymentId: razorpay_payment_id,
            paidAt: paidAtTimestamp,
          },
        });

        // Step B: Clear cart belonging to the current session
        const userCart = await tx.cart.findUnique({
          where: { sessionId },
        });

        if (userCart) {
          await tx.cartItem.deleteMany({
            where: { cartId: userCart.id },
          });
        }

        return updated;
      },
      { maxWait: 10000, timeout: 20000 }
    );

    return {
      orderId: finalizedOrder.id,
      status: "PAID",
      razorpayOrderId: finalizedOrder.razorpayOrderId!,
      razorpayPaymentId: finalizedOrder.razorpayPaymentId!,
      paidAt: finalizedOrder.paidAt!.toISOString(),
    };
  }
}

export const paymentService = new PaymentService();
export default paymentService;
