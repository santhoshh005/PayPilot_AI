import axios from "axios";
import {
  Product,
  ProductListResponse,
  CategoryInfo,
  ProductFilterParams,
} from "../types/product.js";
import { ChatApiResponse } from "../types/chat.js";
import { CartResponse } from "../types/cart.js";
import { CheckoutOrderResponse } from "../types/checkout.js";
import {
  PaymentVerificationRequest,
  PaymentVerificationResponse,
} from "../types/payment.js";
import {
  OrderListResponse,
  OrderDetail,
  OrderFilterParams,
} from "../types/order.js";
import {
  DashboardSummary,
  DashboardRange,
} from "../types/dashboard.js";

const SESSION_STORAGE_KEY = "paypilot_session_id";

// Normalize Base URL: ensure /api prefix is present whether user configured base or /api URL
const rawUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
const baseURL = rawUrl
  ? (rawUrl.endsWith("/api") ? rawUrl : `${rawUrl}/api`)
  : "/api";

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach Session ID from localStorage
apiClient.interceptors.request.use((config) => {
  const existingSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (existingSessionId && config.headers) {
    config.headers["X-Session-Id"] = existingSessionId;
  }
  return config;
});

// Response Interceptor: Capture newly provisioned or renewed Session ID
apiClient.interceptors.response.use((response) => {
  const sessionHeader =
    response.headers["x-session-id"] || response.headers["X-Session-Id"];
  if (sessionHeader && typeof sessionHeader === "string") {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionHeader);
  }
  return response;
});

/**
 * Product API Client Services
 */
export const productsApi = {
  async list(params?: ProductFilterParams): Promise<ProductListResponse> {
    const res = await apiClient.get<{ success: boolean; data: ProductListResponse }>(
      "/products",
      { params }
    );
    return res.data.data;
  },

  async getById(id: string): Promise<Product> {
    const res = await apiClient.get<{ success: boolean; data: Product }>(
      `/products/${id}`
    );
    return res.data.data;
  },

  async getCategories(): Promise<CategoryInfo[]> {
    const res = await apiClient.get<{ success: boolean; data: CategoryInfo[] }>(
      "/products/categories"
    );
    return res.data.data;
  },
};

/**
 * AI Agent Chat API Services
 */
export const chatApi = {
  async sendMessage(params: {
    message: string;
    conversationId?: string;
  }): Promise<ChatApiResponse> {
    const res = await apiClient.post<{
      success: boolean;
      data: ChatApiResponse;
    }>("/chat", params);
    return res.data.data;
  },

  async getHistory(conversationId?: string): Promise<{
    conversationId: string | null;
    messages: Array<{
      id: string;
      role: "USER" | "ASSISTANT";
      content: string;
      createdAt: string;
    }>;
  }> {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        conversationId: string | null;
        messages: Array<{
          id: string;
          role: "USER" | "ASSISTANT";
          content: string;
          createdAt: string;
        }>;
      };
    }>("/chat/history", {
      params: conversationId ? { conversationId } : undefined,
    });
    return res.data.data;
  },
};

/**
 * Shopping Cart API Services
 */
export const cartApi = {
  async get(): Promise<CartResponse> {
    const res = await apiClient.get<{
      success: boolean;
      data: CartResponse;
    }>("/cart");
    return res.data.data;
  },

  async addItem(productId: string, quantity: number = 1): Promise<CartResponse> {
    const res = await apiClient.post<{
      success: boolean;
      data: CartResponse;
    }>("/cart/items", { productId, quantity });
    return res.data.data;
  },

  async updateItem(productId: string, quantity: number): Promise<CartResponse> {
    const res = await apiClient.patch<{
      success: boolean;
      data: CartResponse;
    }>(`/cart/items/${productId}`, { quantity });
    return res.data.data;
  },

  async removeItem(productId: string): Promise<CartResponse> {
    const res = await apiClient.delete<{
      success: boolean;
      data: CartResponse;
    }>(`/cart/items/${productId}`);
    return res.data.data;
  },

  async clear(): Promise<CartResponse> {
    const res = await apiClient.delete<{
      success: boolean;
      data: CartResponse;
    }>("/cart");
    return res.data.data;
  },
};

/**
 * Checkout & Razorpay Order API Services
 */
export const checkoutApi = {
  async createOrder(): Promise<CheckoutOrderResponse> {
    const res = await apiClient.post<{
      success: boolean;
      data: CheckoutOrderResponse;
    }>("/checkout/order", {});
    return res.data.data;
  },
};

/**
 * Payment Verification API Services (Phase 8)
 */
export const paymentApi = {
  async verify(params: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
    const res = await apiClient.post<{
      success: boolean;
      data: PaymentVerificationResponse;
    }>("/payment/verify", params);
    return res.data.data;
  },
};

/**
 * Orders & History API Services (Phase 10)
 */
export const ordersApi = {
  async list(params?: OrderFilterParams): Promise<OrderListResponse> {
    const res = await apiClient.get<{
      success: boolean;
      data: OrderListResponse;
    }>("/orders", { params });
    return res.data.data;
  },

  async getById(orderId: string): Promise<OrderDetail> {
    const res = await apiClient.get<{
      success: boolean;
      data: OrderDetail;
    }>(`/orders/${orderId}`);
    return res.data.data;
  },
};

/**
 * Phase 11: Growth Dashboard & Business Insights API Services
 */
export const dashboardApi = {
  async getSummary(range?: DashboardRange): Promise<DashboardSummary> {
    const res = await apiClient.get<{
      success: boolean;
      data: DashboardSummary;
    }>("/dashboard/summary", {
      params: range ? { range } : undefined,
    });
    return res.data.data;
  },
};

/**
 * System & Session API Services
 */
export const systemApi = {
  async getHealth() {
    const res = await apiClient.get<{
      success: boolean;
      data: { status: string; service: string; database: string };
    }>("/health");
    return res.data.data;
  },

  async getSession() {
    const res = await apiClient.get<{
      success: boolean;
      data: { sessionId: string };
    }>("/session");
    return res.data.data;
  },
};

export default apiClient;
