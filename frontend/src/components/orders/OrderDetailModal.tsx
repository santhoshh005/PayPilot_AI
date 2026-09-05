import { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  CreditCard,
  Calendar,
  Hash,
  Copy,
  Check,
} from "lucide-react";
import { OrderDetail } from "../../types/order.js";
import { ordersApi } from "../../lib/api.js";

interface OrderDetailModalProps {
  orderId: string | null;
  onClose: () => void;
}

export default function OrderDetailModal({
  orderId,
  onClose,
}: OrderDetailModalProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    ordersApi
      .getById(orderId)
      .then((data) => {
        if (isMounted) {
          setOrder(data);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          console.error("Failed to load order details:", err);
          setError(
            err.response?.data?.error?.message ||
              "Unable to load order details. Please try again."
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // Keyboard Escape listener & body scroll lock
  useEffect(() => {
    if (!orderId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
  }, [orderId, onClose]);

  if (!orderId) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PAID
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            PENDING
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-detail-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] z-10">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="order-detail-modal-title" className="text-base font-bold text-slate-900">
                  Order Details
                </h3>
                {order && getStatusBadge(order.status)}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                ID: {orderId}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close order details modal"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-medium">
                Loading order information...
              </p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-rose-800">{error}</p>
              <button
                onClick={() => {
                  setIsLoading(true);
                  setError(null);
                  ordersApi
                    .getById(orderId)
                    .then(setOrder)
                    .catch((err) =>
                      setError(
                        err.response?.data?.error?.message ||
                          "Failed to load order"
                      )
                    )
                    .finally(() => setIsLoading(false));
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : order ? (
            <>
              {/* Order Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Order Placed
                  </span>
                  <p className="font-semibold text-slate-800 mt-1">
                    {new Date(order.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>

                {order.paidAt && (
                  <div>
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                      Paid At
                    </span>
                    <p className="font-semibold text-emerald-800 mt-1">
                      {new Date(order.paidAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                )}

                {order.razorpayOrderId && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      Razorpay Order ID
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="font-mono text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-[11px]">
                        {order.razorpayOrderId}
                      </code>
                      <button
                        onClick={() =>
                          handleCopy(order.razorpayOrderId!, "rzp_order")
                        }
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        title="Copy Order ID"
                      >
                        {copiedId === "rzp_order" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {order.razorpayPaymentId && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                      Razorpay Payment ID
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="font-mono text-emerald-700 bg-emerald-50/50 px-2.5 py-1 rounded-lg border border-emerald-200 text-[11px]">
                        {order.razorpayPaymentId}
                      </code>
                      <button
                        onClick={() =>
                          handleCopy(order.razorpayPaymentId!, "rzp_pay")
                        }
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        title="Copy Payment ID"
                      >
                        {copiedId === "rzp_pay" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Purchased Items ({order.items.length})
                  </h4>
                  <span className="text-xs text-slate-400">
                    Total Units: {order.itemCount}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'><rect width='18' height='18' x='3' y='3' rx='3'/></svg>";
                          }}
                          className="w-14 h-14 object-cover rounded-xl border border-slate-100 bg-slate-50 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                          {item.brand} • {item.category}
                        </div>
                        <h5 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                          {item.name || item.productName}
                        </h5>
                        <div className="text-xs text-slate-500 mt-1">
                          ₹{item.price.toLocaleString("en-IN")} × {item.quantity}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-slate-900">
                          ₹{item.subtotal.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Captured Snapshot
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    ₹{order.totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Standard Shipping</span>
                  <span className="font-semibold text-emerald-600">FREE</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Applicable Taxes (GST)</span>
                  <span className="font-semibold text-slate-500">Included</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
                  <span>Total Paid / Due</span>
                  <span className="text-base text-blue-600">
                    ₹{order.totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
