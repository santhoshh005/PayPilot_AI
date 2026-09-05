export interface CheckoutOrderResponse {
  orderId: string;
  razorpayOrderId: string;
  amount: number; // In paise
  currency: string;
  keyId: string;
}
