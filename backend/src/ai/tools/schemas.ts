import { z } from "zod";

/**
 * Zod validation schema for search_products tool arguments
 */
export const searchProductsToolSchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(50).optional(),
  brand: z.string().trim().max(50).optional(),
  minPrice: z.number().min(0, "minPrice cannot be negative").optional(),
  maxPrice: z.number().min(0, "maxPrice cannot be negative").optional(),
  minRating: z.number().min(0).max(5, "Rating must be between 0 and 5").optional(),
  minBatteryHours: z.number().min(0, "minBatteryHours cannot be negative").optional(),
  inStock: z.boolean().optional(),
  sort: z
    .enum(["price_asc", "price_desc", "rating_desc", "name_asc"])
    .optional()
    .default("rating_desc"),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

export type SearchProductsToolArgs = z.infer<typeof searchProductsToolSchema>;

/**
 * Zod validation schema for get_product tool arguments
 */
export const getProductToolSchema = z.object({
  productId: z.string().uuid("productId must be a valid UUID"),
});

export type GetProductToolArgs = z.infer<typeof getProductToolSchema>;

/**
 * Zod validation schema for compare_products tool arguments
 */
export const compareProductsToolSchema = z.object({
  productIds: z
    .array(z.string().uuid("Each product ID must be a valid UUID"))
    .min(2, "At least 2 products are required for comparison")
    .max(4, "Cannot compare more than 4 products at once"),
});

export type CompareProductsToolArgs = z.infer<typeof compareProductsToolSchema>;

/**
 * Zod validation schema for get_categories tool arguments (empty)
 */
export const getCategoriesToolSchema = z.object({});

/**
 * Zod validation schema for add_to_cart tool arguments
 */
export const addToCartToolSchema = z.object({
  productId: z.string().uuid("productId must be a valid UUID"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10, "Quantity cannot exceed 10 units per item")
    .optional()
    .default(1),
});

export type AddToCartToolArgs = z.infer<typeof addToCartToolSchema>;

/**
 * Zod validation schema for remove_from_cart tool arguments
 */
export const removeFromCartToolSchema = z.object({
  productId: z.string().uuid("productId must be a valid UUID"),
});

export type RemoveFromCartToolArgs = z.infer<typeof removeFromCartToolSchema>;

/**
 * Zod validation schema for update_cart_quantity tool arguments
 */
export const updateCartQuantityToolSchema = z.object({
  productId: z.string().uuid("productId must be a valid UUID"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10, "Quantity cannot exceed 10 units per item"),
});

export type UpdateCartQuantityToolArgs = z.infer<typeof updateCartQuantityToolSchema>;

/**
 * Zod validation schema for get_cart tool arguments (empty)
 */
export const getCartToolSchema = z.object({});

/**
 * Zod validation schema for clear_cart tool arguments (empty)
 */
export const clearCartToolSchema = z.object({});

