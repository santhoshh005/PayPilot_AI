import React, { useEffect } from "react";
import { X, ShoppingBag, Trash2, ArrowRight, CheckCircle2, Receipt } from "lucide-react";
import { CartResponse } from "../../types/cart.js";
import { CheckoutOrderResponse } from "../../types/checkout.js";
import { RazorpayCheckoutResponse } from "../../types/razorpay.js";
import { PaymentVerificationResponse } from "../../types/payment.js";
import CartItem from "./CartItem.js";
import CartSummary from "./CartSummary.js";

interface CartPanelProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartResponse;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onNavigateToCatalog: () => void;
  onNavigateToOrders?: () => void;
  onCheckout?: () => void;
  isCheckingOut?: boolean;
  checkoutOrder?: CheckoutOrderResponse | null;
  paymentResponse?: RazorpayCheckoutResponse | null;
  isPaymentCancelled?: boolean;
  checkoutError?: string | null;
  isLoading?: boolean;
  isVerifyingPayment?: boolean;
  verifiedPayment?: PaymentVerificationResponse | null;
  verificationError?: string | null;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onNavigateToCatalog,
  onNavigateToOrders,
  onCheckout,
  isCheckingOut = false,
  checkoutOrder = null,
  paymentResponse = null,
  isPaymentCancelled = false,
  checkoutError = null,
  isLoading = false,
  isVerifyingPayment = false,
  verifiedPayment = null,
  verificationError = null,
}) => {
  // Keyboard Escape listener & body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCheckingOut && !isVerifyingPayment) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isCheckingOut, isVerifyingPayment, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Cart Panel"
      className="fixed inset-0 z-50 overflow-hidden animate-fadeIn"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={() => {
          if (!isCheckingOut && !isVerifyingPayment) {
            onClose();
          }
        }}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Your Cart</h3>
                <span className="text-xs text-slate-500 font-medium">
                  {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"} selected
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {cart.items.length > 0 && (
                <button
                  onClick={onClearCart}
                  disabled={isLoading || isCheckingOut || isVerifyingPayment}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Clear all items from cart"
                  aria-label="Clear all items from cart"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}

              <button
                onClick={onClose}
                disabled={isCheckingOut || isVerifyingPayment}
                aria-label="Close shopping cart"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {verifiedPayment ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Order Confirmed!</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Your payment was cryptographically verified and recorded. Thank you for shopping with PayPilot AI!
                </p>
                <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
                  {onNavigateToOrders && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToOrders();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>View in My Orders</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToCatalog();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors border border-slate-200 cursor-pointer"
                  >
                    <span>Continue Shopping</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : cart.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Your cart is empty</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Discover products by asking our AI assistant or browsing through our catalog.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToCatalog();
                  }}
                  className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
                >
                  <span>Explore Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.items.map((item) => (
                  <CartItem
                    key={item.productId}
                    item={item}
                    onUpdateQuantity={onUpdateQuantity}
                    onRemove={onRemoveItem}
                    isLoading={isLoading || isCheckingOut || isVerifyingPayment}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Summary & Footer */}
          {(cart.items.length > 0 || isVerifyingPayment || Boolean(verifiedPayment)) && (
            <div className="p-6 border-t border-slate-200 bg-white">
              <CartSummary
                cart={cart}
                onCheckout={onCheckout}
                isCheckingOut={isCheckingOut}
                checkoutOrder={checkoutOrder}
                paymentResponse={paymentResponse}
                isPaymentCancelled={isPaymentCancelled}
                checkoutError={checkoutError}
                isVerifyingPayment={isVerifyingPayment}
                verifiedPayment={verifiedPayment}
                verificationError={verificationError}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartPanel;

