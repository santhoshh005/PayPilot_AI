import { z } from "zod";

/**
 * Zod validation schema for POST /api/cart/items
 */
export const addItemSchema = z.object({
  productId: z.string().uuid("productId must be a valid UUID"),
  quantity: z
    .number({
      invalid_type_error: "Quantity must be an integer",
    })
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10, "Quantity cannot exceed 10 units per item")
    .optional()
    .default(1),
});

export type AddItemBody = z.infer<typeof addItemSchema>;

/**
 * Zod validation schema for PATCH /api/cart/items/:productId
 */
export const updateItemSchema = z.object({
  quantity: z
    .number({
      required_error: "Quantity is required",
      invalid_type_error: "Quantity must be an integer",
    })
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10, "Quantity cannot exceed 10 units per item"),
});

export type UpdateItemBody = z.infer<typeof updateItemSchema>;

/**
 * Zod validation schema for :productId URL route parameter
 */
export const productIdParamSchema = z.object({
  productId: z.string().uuid("productId must be a valid UUID"),
});

export type ProductIdParam = z.infer<typeof productIdParamSchema>;

/**
 * Cart Item output structure
 */
export interface CartItemResponse {
  productId: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string;
  inStock: boolean;
}

/**
 * Cart output envelope
 */
export interface CartResponse {
  items: CartItemResponse[];
  itemCount: number;
  subtotal: number;
}
