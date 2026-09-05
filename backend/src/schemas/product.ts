import { z } from "zod";

/**
 * Zod schema for GET /api/products query parameters
 */
export const listProductsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(50).optional(),
  brand: z.string().trim().max(50).optional(),
  minPrice: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseFloat(val) : undefined))
    .pipe(z.number().min(0, "minPrice cannot be negative").optional()),
  maxPrice: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseFloat(val) : undefined))
    .pipe(z.number().min(0, "maxPrice cannot be negative").optional()),
  minRating: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseFloat(val) : undefined))
    .pipe(z.number().min(0).max(5, "Rating must be between 0 and 5").optional()),
  minBatteryHours: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseFloat(val) : undefined))
    .pipe(z.number().min(0, "minBatteryHours cannot be negative").optional()),
  inStock: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    })
    .pipe(z.boolean().optional()),
  sort: z
    .enum(["price_asc", "price_desc", "rating_desc", "name_asc"])
    .default("rating_desc"),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, "Page must be 1 or greater").default(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 12))
    .pipe(z.number().int().min(1).max(50, "Maximum limit is 50").default(12)),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

/**
 * Zod schema for GET /api/products/:id route parameters
 */
export const productIdParamSchema = z.object({
  id: z.string().uuid("Product ID must be a valid UUID"),
});

export type ProductIdParam = z.infer<typeof productIdParamSchema>;
