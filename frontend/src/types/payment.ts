export interface PaymentVerificationRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentVerificationResponse {
  orderId: string;
  status: "PAID";
  razorpayOrderId: string;
  razorpayPaymentId: string;
  paidAt: string;
}
