import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Package,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  MessageSquare,
  Compass,
  ShoppingBag,
  Receipt,
  BarChart3,
} from "lucide-react";
import {
  productsApi,
  systemApi,
  cartApi,
  checkoutApi,
  paymentApi,
} from "./lib/api.js";
import {
  Product,
  CategoryInfo,
  ProductFilterParams,
  PaginationMeta,
} from "./types/product.js";
import { CartResponse } from "./types/cart.js";
import { CheckoutOrderResponse } from "./types/checkout.js";
import {
  RazorpayCheckoutOptions,
  RazorpayCheckoutResponse,
} from "./types/razorpay.js";
import { PaymentVerificationResponse } from "./types/payment.js";
import { openRazorpayCheckout } from "./lib/razorpay.js";
import ProductFilters from "./components/products/ProductFilters.js";
import ProductGrid from "./components/products/ProductGrid.js";
import ProductDetailModal from "./components/products/ProductDetailModal.js";
import ChatInterface from "./components/chat/ChatInterface.js";
import CartPanel from "./components/cart/CartPanel.js";
import OrdersList from "./components/orders/OrdersList.js";
import Dashboard from "./components/dashboard/Dashboard.js";

export default function App() {
  // Navigation State: AI Chat, Catalog, Orders, or Growth Dashboard
  const [activeTab, setActiveTab] = useState<"chat" | "catalog" | "orders" | "dashboard">("chat");

  // System Health & Session State
  const [backendStatus, setBackendStatus] = useState<string>("Checking connection...");
  const [isLive, setIsLive] = useState<boolean | null>(null);

  // Cart State (Synchronized with current session)
  const [cart, setCart] = useState<CartResponse>({
    items: [],
    itemCount: 0,
    subtotal: 0,
  });
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCartLoading, setIsCartLoading] = useState<boolean>(false);

  // Phase 6, 7 & 8: Checkout & Razorpay Payment State
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutOrder, setCheckoutOrder] = useState<CheckoutOrderResponse | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentResponse, setPaymentResponse] = useState<RazorpayCheckoutResponse | null>(null);
  const [isPaymentCancelled, setIsPaymentCancelled] = useState<boolean>(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [verifiedPayment, setVerifiedPayment] = useState<PaymentVerificationResponse | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Product Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [filters, setFilters] = useState<ProductFilterParams>({
    page: 1,
    limit: 12,
    sort: "rating_desc",
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Product for Detail Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // 1. Initial System, Categories, and Cart Check
  useEffect(() => {
    systemApi
      .getHealth()
      .then((data) => {
        if (data.status === "ok") {
          setBackendStatus("Backend connected & operational");
          setIsLive(true);
        } else {
          setBackendStatus("Service degraded");
          setIsLive(false);
        }
      })
      .catch(() => {
        setBackendStatus("Backend offline");
        setIsLive(false);
      });

    productsApi
      .getCategories()
      .then((cats) => setCategories(cats))
      .catch((err) => console.warn("Could not load categories:", err.message));

    // Load initial cart state
    cartApi
      .get()
      .then((cartData) => setCart(cartData))
      .catch((err) => console.warn("Could not load cart:", err.message));
  }, []);

  // 2. Fetch Products on Filter / Pagination Change
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await productsApi.list(filters);
      setProducts(data.items);
      setPagination(data.pagination);
    } catch (err: any) {
      console.error("Failed to load products:", err);
      setError(
        err.response?.data?.error?.message ||
          "Unable to load product catalog. Please verify backend connectivity."
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (activeTab === "catalog") {
      fetchProducts();
    }
  }, [activeTab, fetchProducts]);

  const handleFilterChange = (newFilters: ProductFilterParams) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({
      page: 1,
      limit: 12,
      sort: "rating_desc",
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setFilters((prev) => ({ ...prev, page: newPage }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Cart Operations
  const handleAddToCart = async (product: Product, quantity = 1) => {
    setIsCartLoading(true);
    try {
      const updatedCart = await cartApi.addItem(product.id, quantity);
      setCart(updatedCart);
      setIsCartOpen(true);
    } catch (err: any) {
      console.error("Failed to add to cart:", err);
      alert(err.response?.data?.error?.message || "Failed to add item to cart");
    } finally {
      setIsCartLoading(false);
    }
  };

  const handleUpdateCartQuantity = async (productId: string, quantity: number) => {
    setIsCartLoading(true);
    try {
      const updatedCart = await cartApi.updateItem(productId, quantity);
      setCart(updatedCart);
    } catch (err: any) {
      console.error("Failed to update cart:", err);
    } finally {
      setIsCartLoading(false);
    }
  };

  const handleRemoveCartItem = async (productId: string) => {
    setIsCartLoading(true);
    try {
      const updatedCart = await cartApi.removeItem(productId);
      setCart(updatedCart);
    } catch (err: any) {
      console.error("Failed to remove item:", err);
    } finally {
      setIsCartLoading(false);
    }
  };

  const handleClearCart = async () => {
    setIsCartLoading(true);
    try {
      const emptyCart = await cartApi.clear();
      setCart(emptyCart);
      setCheckoutOrder(null);
      setCheckoutError(null);
      setPaymentResponse(null);
      setIsPaymentCancelled(false);
      setVerifiedPayment(null);
      setVerificationError(null);
      setIsVerifyingPayment(false);
    } catch (err: any) {
      console.error("Failed to clear cart:", err);
    } finally {
      setIsCartLoading(false);
    }
  };

  // Phase 6, 7 & 8: Authoritative Razorpay Checkout & Verification Handler
  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setCheckoutError(null);
    setIsPaymentCancelled(false);
    setPaymentResponse(null);
    setVerifiedPayment(null);
    setVerificationError(null);

    try {
      // 1. Backend creates authoritative Razorpay Order and internal Order
      const order = await checkoutApi.createOrder();
      setCheckoutOrder(order);

      // 2. Open Razorpay Standard Checkout modal with authoritative backend details
      const options: RazorpayCheckoutOptions = {
        key: order.keyId,
        amount: order.amount, // in paise
        currency: order.currency, // "INR"
        name: "PayPilot AI",
        description: `Order Checkout (#${order.orderId.slice(0, 8)})`,
        order_id: order.razorpayOrderId,
        handler: async (response: RazorpayCheckoutResponse) => {
          // Phase 8: Secure Server-side Payment Verification
          setPaymentResponse(response);
          setIsCheckingOut(false);
          setIsVerifyingPayment(true);
          setVerificationError(null);

          try {
            const verified = await paymentApi.verify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            setVerifiedPayment(verified);
            // On verified success, clear frontend cart because backend transaction cleared database cart
            setCart({ items: [], itemCount: 0, subtotal: 0 });
          } catch (err: any) {
            console.error("Payment verification failed:", err);
            setVerificationError(
              err.response?.data?.error?.message ||
                "Payment verification failed. Please contact support."
            );
            // On verification failure, cart remains intact in DB and UI
          } finally {
            setIsVerifyingPayment(false);
          }
        },
        modal: {
          ondismiss: () => {
            // Non-destructive cancellation: cart remains intact
            setIsCheckingOut(false);
            setIsPaymentCancelled(true);
          },
        },
        theme: {
          color: "#2563eb",
        },
      };

      await openRazorpayCheckout(options);
    } catch (err: any) {
      console.error("Checkout failed:", err);
      setCheckoutError(
        err.response?.data?.error?.message ||
          err.message ||
          "Unable to load payment checkout. Please try again."
      );
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">
                PayPilot AI
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Track 1
              </span>
            </div>
          </div>

          {/* Center Tabs: AI Assistant, Catalog, Orders & Dashboard */}
          <nav aria-label="Main Navigation" className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveTab("chat")}
              aria-label="Switch to AI Shopping Agent"
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "chat"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Shopping Agent</span>
              <span className="sm:hidden">Chat</span>
            </button>

            <button
              onClick={() => setActiveTab("catalog")}
              aria-label="Switch to Catalog Explorer"
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "catalog"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Browse Catalog</span>
              <span className="sm:hidden">Catalog</span>
            </button>

            <button
              onClick={() => setActiveTab("orders")}
              aria-label="Switch to Order History"
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "orders"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Orders</span>
            </button>

            <button
              onClick={() => setActiveTab("dashboard")}
              aria-label="Switch to Growth Dashboard"
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
          </nav>

          {/* Right Header: Cart Button & Health Indicator */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsCartOpen(true)}
              aria-label={`View shopping cart with ${cart.itemCount} items`}
              title={`View shopping cart (${cart.itemCount} items)`}
              className="relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors shadow-sm cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900 hidden sm:inline">Cart</span>
              {cart.itemCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-[1.25rem] text-center">
                  {cart.itemCount}
                </span>
              )}
            </button>

            <div
              title={`System Status: ${backendStatus}`}
              className="hidden md:flex items-center space-x-2 text-xs bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLive
                    ? "bg-emerald-500"
                    : isLive === false
                    ? "bg-amber-500"
                    : "bg-slate-400 animate-pulse"
                }`}
              />
              <span className="text-slate-600 font-medium">{backendStatus}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "chat" ? (
          /* TAB 1: AI Assistant Conversational Interface */
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-3xl border border-blue-100">
              <div>
                <div className="inline-flex items-center gap-1.5 text-blue-700 text-xs font-bold uppercase tracking-wider mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Agentic Commerce Ready</span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Shop & Manage Cart by Natural Language
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Describe what you need — PayPilot finds products, compares specifications, and mutates your cart with server-authoritative totals.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-white/80 px-3.5 py-2 rounded-xl border border-emerald-200 shrink-0 self-start sm:self-auto">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero Hallucination Guarantee</span>
              </div>
            </div>

            <ChatInterface
              onSelectProduct={(p) => setSelectedProduct(p)}
              onCartUpdated={(newCart) => setCart(newCart)}
              onAddToCart={(p, qty) => handleAddToCart(p, qty || 1)}
            />
          </div>
        ) : activeTab === "catalog" ? (
          /* TAB 2: Direct Product Catalog Explorer */
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
                  <Package className="w-3.5 h-3.5" />
                  <span>Authoritative PostgreSQL Catalog</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Browse All Products
                </h1>
                <p className="text-sm text-slate-500 mt-1 max-w-xl">
                  Inspect the underlying product database powering the AI agent.
                </p>
              </div>
            </div>

            <ProductFilters
              categories={categories}
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleResetFilters}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600 font-semibold">
                <Package className="w-4 h-4 text-blue-600" />
                <span>
                  {isLoading
                    ? "Searching..."
                    : `Showing ${products.length} of ${pagination.total} products`}
                </span>
              </div>
            </div>

            <ProductGrid
              products={products}
              isLoading={isLoading}
              error={error}
              onSelectProduct={(p) => setSelectedProduct(p)}
              onRetry={fetchProducts}
            />

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-6">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isLoading}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <span className="text-xs font-semibold text-slate-600 px-3 py-1">
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : activeTab === "orders" ? (
          /* TAB 3: Session Orders & History */
          <div className="max-w-4xl mx-auto">
            <OrdersList
              onExploreCatalog={() => setActiveTab("catalog")}
              onOpenChat={() => setActiveTab("chat")}
            />
          </div>
        ) : (
          /* TAB 4: Growth Dashboard & Business Insights */
          <div className="max-w-5xl mx-auto">
            <Dashboard />
          </div>
        )}
      </main>

      {/* Slide-over Cart Panel */}
      <CartPanel
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onNavigateToCatalog={() => setActiveTab("catalog")}
        onNavigateToOrders={() => setActiveTab("orders")}
        onCheckout={handleCheckout}
        isCheckingOut={isCheckingOut}
        checkoutOrder={checkoutOrder}
        paymentResponse={paymentResponse}
        isPaymentCancelled={isPaymentCancelled}
        checkoutError={checkoutError}
        isLoading={isCartLoading}
        isVerifyingPayment={isVerifyingPayment}
        verifiedPayment={verifiedPayment}
        verificationError={verificationError}
      />

      {/* Global Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(p, qty) => handleAddToCart(p, qty || 1)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        PayPilot AI — Razorpay AI Builder Track 1: AI Growth & Agentic Commerce
      </footer>
    </div>
  );
}
