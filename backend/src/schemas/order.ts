import { z } from "zod";

/**
 * Valid order status values matching Prisma OrderStatus enum
 */
export const orderStatusSchema = z.enum(["PENDING", "PAID", "FAILED"]);
export type OrderStatusEnum = z.infer<typeof orderStatusSchema>;

/**
 * Zod schema for GET /api/orders query parameters
 */
export const listOrdersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, "Page must be 1 or greater").default(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : 10))
    .pipe(z.number().int().min(1).max(50, "Maximum limit is 50").default(10)),
  status: orderStatusSchema.optional(),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

/**
 * Zod schema for GET /api/orders/:orderId route parameters
 */
export const orderIdParamSchema = z.object({
  orderId: z.string().uuid("Order ID must be a valid UUID"),
});

export type OrderIdParam = z.infer<typeof orderIdParamSchema>;

/**
 * Data Transfer Objects for Order responses
 */
export interface ConciseOrderItemDto {
  id: string;
  productId: string;
  name: string;
  productName: string;
  brand: string;
  category: string;
  imageUrl: string;
  quantity: number;
  price: number; // captured snapshot price in INR
  subtotal: number;
}

export interface OrderSummaryDto {
  id: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  status: OrderStatusEnum;
  totalAmount: number; // in INR
  currency: "INR";
  itemCount: number;
  createdAt: string; // ISO 8601
  paidAt: string | null; // ISO 8601
  items: ConciseOrderItemDto[];
}

export interface OrderDetailDto {
  id: string;
  status: OrderStatusEnum;
  totalAmount: number; // in INR
  currency: "INR";
  itemCount: number;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  items: ConciseOrderItemDto[];
}

export interface OrderListResult {
  orders: OrderSummaryDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
