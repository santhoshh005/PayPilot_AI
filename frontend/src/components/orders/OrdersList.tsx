import { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Eye,
  RefreshCw,
} from "lucide-react";
import { OrderSummary, OrderStatus, OrderPaginationMeta } from "../../types/order.js";
import { ordersApi } from "../../lib/api.js";
import OrderDetailModal from "./OrderDetailModal.js";

interface OrdersListProps {
  onExploreCatalog: () => void;
  onOpenChat: () => void;
}

export default function OrdersList({
  onExploreCatalog,
  onOpenChat,
}: OrdersListProps) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [pagination, setPagination] = useState<OrderPaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      };
      const data = await ordersApi.list(params);
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (err: any) {
      console.error("Failed to load orders:", err);
      setError(
        err.response?.data?.error?.message ||
          "Unable to load orders. Please check your connection."
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusChange = (newStatus: OrderStatus | "ALL") => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            PAID
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            PENDING
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" />
            FAILED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2">
            <Package className="w-3.5 h-3.5" />
            <span>Session-Scoped Order History</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            My Orders
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Review past transactions, payment statuses, and historical purchase receipts.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors self-start sm:self-auto cursor-pointer"
          title="Refresh orders"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(["ALL", "PAID", "PENDING", "FAILED"] as const).map((status) => (
          <button
            key={status}
            onClick={() => handleStatusChange(status)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusFilter === status
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {status === "ALL" ? "All Orders" : status}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="w-32 h-5 bg-slate-200 rounded-lg" />
                <div className="w-20 h-5 bg-slate-200 rounded-full" />
              </div>
              <div className="w-48 h-4 bg-slate-100 rounded" />
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <div className="w-16 h-16 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-40 h-4 bg-slate-200 rounded" />
                  <div className="w-24 h-3 bg-slate-100 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-rose-900">Failed to Load Orders</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchOrders}
            className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
          >
            Retry Now
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {statusFilter === "ALL"
              ? "No orders placed yet"
              : `No ${statusFilter.toLowerCase()} orders found`}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {statusFilter === "ALL"
              ? "Your completed checkouts and active orders will appear here with snapshot pricing and payment receipts."
              : `You do not have any orders matching the status '${statusFilter}'.`}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={onOpenChat}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
            >
              Ask AI Assistant
            </button>
            <button
              onClick={onExploreCatalog}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors border border-slate-200 cursor-pointer"
            >
              Browse Catalog
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:border-blue-200 hover:shadow-md transition-all space-y-4"
            >
              {/* Order Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    <span>#{order.id.slice(0, 8)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard?.writeText(order.id);
                      }}
                      className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                      title="Copy full Order ID"
                      aria-label="Copy full Order ID"
                    >
                      <span className="text-[10px]">📋</span>
                    </button>
                  </span>
                  {getStatusBadge(order.status)}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    at{" "}
                    {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Order Items Preview */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 truncate">
                      {order.items.map((i) => i.name || i.productName).join(", ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {order.items.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className="w-12 h-12 rounded-xl border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0"
                        title={`${item.name || item.productName} (Qty: ${item.quantity})`}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'><rect width='18' height='18' x='3' y='3' rx='3'/></svg>";
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    ))}
                    {order.items.length > 4 && (
                      <span className="text-xs font-semibold text-slate-400 pl-1">
                        +{order.items.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount & Details CTA */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Total Amount
                    </span>
                    <span className="text-lg font-black text-slate-900">
                      ₹{order.totalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedOrderId(order.id)}
                    aria-label={`View receipt for order ${order.id.slice(0, 8)}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Receipt</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-6">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isLoading}
                aria-label="Previous page of orders"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <span className="text-xs font-semibold text-slate-600 px-3 py-1">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={currentPage >= pagination.totalPages || isLoading}
                aria-label="Next page of orders"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      <OrderDetailModal
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </div>
  );
}
