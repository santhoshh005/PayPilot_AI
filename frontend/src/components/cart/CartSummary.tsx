import React from "react";
import {
  ShieldCheck,
  Truck,
  ArrowRight,
  Loader2,
  AlertCircle,
  Info,
  CheckCircle2,
} from "lucide-react";
import { CartResponse } from "../../types/cart.js";
import { CheckoutOrderResponse } from "../../types/checkout.js";
import { RazorpayCheckoutResponse } from "../../types/razorpay.js";
import { PaymentVerificationResponse } from "../../types/payment.js";

interface CartSummaryProps {
  cart: CartResponse;
  onCheckout?: () => void;
  isCheckingOut?: boolean;
  checkoutOrder?: CheckoutOrderResponse | null;
  paymentResponse?: RazorpayCheckoutResponse | null;
  isPaymentCancelled?: boolean;
  checkoutError?: string | null;
  isVerifyingPayment?: boolean;
  verifiedPayment?: PaymentVerificationResponse | null;
  verificationError?: string | null;
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  cart,
  onCheckout,
  isCheckingOut = false,
  checkoutOrder = null,
  paymentResponse = null,
  isPaymentCancelled = false,
  checkoutError = null,
  isVerifyingPayment = false,
  verifiedPayment = null,
  verificationError = null,
}) => {
  const isCartEmpty = cart.itemCount === 0;
  const isActionDisabled =
    isCartEmpty || isCheckingOut || isVerifyingPayment || Boolean(verifiedPayment);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
        Order Summary
      </h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Items ({cart.itemCount})</span>
          <span className="font-semibold text-slate-900">
            ₹{cart.subtotal.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex justify-between text-slate-600">
          <span className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-blue-600" />
            Express Delivery
          </span>
          <span className="font-semibold text-emerald-600">FREE</span>
        </div>

        <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
          <span className="text-base font-bold text-slate-900">Subtotal</span>
          <div className="text-right">
            <span className="text-2xl font-black text-slate-900">
              ₹{cart.subtotal.toLocaleString("en-IN")}
            </span>
            <span className="block text-[10px] text-slate-500 font-medium">
              Authoritative PostgreSQL calculation
            </span>
          </div>
        </div>
      </div>

      {/* Checkout Action Button */}
      <div className="pt-2 space-y-3">
        <button
          onClick={onCheckout}
          disabled={isActionDisabled}
          className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
          title={
            verifiedPayment
              ? "Payment completed"
              : isCartEmpty
              ? "Add items to cart to checkout"
              : "Proceed with Razorpay Checkout"
          }
        >
          {isCheckingOut ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Opening Razorpay Checkout...</span>
            </>
          ) : isVerifyingPayment ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying Payment...</span>
            </>
          ) : verifiedPayment ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-slate-700">Order Completed</span>
            </>
          ) : (
            <>
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Order Created Indicator */}
        {checkoutOrder &&
          !paymentResponse &&
          !isPaymentCancelled &&
          !verifiedPayment && (
            <div className="px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between animate-fadeIn">
              <span className="text-[11px] text-blue-700 font-medium">
                Razorpay Order:
              </span>
              <code className="font-mono text-[11px] font-bold text-blue-800">
                {checkoutOrder.razorpayOrderId}
              </code>
            </div>
          )}

        {/* Phase 8 Status: Verifying Payment Securely */}
        {isVerifyingPayment && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-2 animate-fadeIn">
            <div className="font-bold flex items-center gap-2 text-blue-800">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span>Payment submitted — verifying securely...</span>
            </div>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Verifying cryptographic HMAC-SHA256 signature with backend server and finalizing order status.
            </p>
          </div>
        )}

        {/* Phase 8 Status: Payment Successfully Verified */}
        {verifiedPayment && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="font-bold flex items-center gap-1.5 text-emerald-800 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Payment Successful!</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {verifiedPayment.status}
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 leading-relaxed">
              Your payment has been cryptographically verified and recorded in the database. Cart items have been fulfilled.
            </p>
            <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200 font-mono text-[11px] space-y-1 text-slate-800">
              <div className="truncate">
                <span className="text-slate-500 font-sans font-medium">Payment ID:</span>{" "}
                <span className="font-semibold text-emerald-900">
                  {verifiedPayment.razorpayPaymentId}
                </span>
              </div>
              <div className="truncate">
                <span className="text-slate-500 font-sans font-medium">Order ID:</span>{" "}
                <span className="font-semibold">{verifiedPayment.razorpayOrderId}</span>
              </div>
              <div className="truncate text-[10px] text-slate-500 font-sans">
                Verified at: {new Date(verifiedPayment.paidAt).toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        )}

        {/* Phase 8 Status: Verification Failure */}
        {verificationError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2 animate-fadeIn">
            <div className="font-bold flex items-center gap-1.5 text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Payment Verification Failed</span>
            </div>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              {verificationError}
            </p>
            <div className="text-[10px] text-rose-800 font-medium">
              🔒 Order remains PENDING. Your cart items are preserved.
            </div>
          </div>
        )}

        {/* Phase 7 Status: User Cancelled Checkout Modal */}
        {isPaymentCancelled && !paymentResponse && (
          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5 animate-fadeIn">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Payment cancelled</span>
              <span className="text-blue-700 text-[11px]">
                You closed the payment modal. Your cart items are still safe and intact.
              </span>
            </div>
          </div>
        )}

        {/* Phase 7 Status: Checkout Error */}
        {checkoutError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{checkoutError}</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Secured with Razorpay Standard Checkout (Test Mode)</span>
        </div>
      </div>
    </div>
  );
};

export default CartSummary;
