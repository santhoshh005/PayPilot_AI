export type OrderStatus = "PENDING" | "PAID" | "FAILED";

export interface ConciseOrderItem {
  id: string;
  productId: string;
  name: string;
  productName?: string;
  brand: string;
  category: string;
  imageUrl: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface OrderSummary {
  id: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  status: OrderStatus;
  totalAmount: number;
  currency: "INR";
  itemCount: number;
  createdAt: string;
  paidAt: string | null;
  items: ConciseOrderItem[];
}

export interface OrderDetail {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  currency: "INR";
  itemCount: number;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: ConciseOrderItem[];
}

export interface OrderPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OrderListResponse {
  orders: OrderSummary[];
  pagination: OrderPaginationMeta;
}

export interface OrderFilterParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}
