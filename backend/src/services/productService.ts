import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { ListProductsQuery } from "../schemas/product.js";
import { NotFoundError } from "../utils/errors.js";

export interface FormattedProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  description: string;
  imageUrl: string;
  specs: Record<string, unknown>;
  features: string[];
  rating: number;
  inStock: boolean;
  batteryHours?: number;
  createdAt: Date;
}

export interface ProductListResult {
  items: FormattedProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Maps a raw Prisma Product entity into a clean, typed API representation.
 */
function formatProduct(p: {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: Prisma.Decimal;
  description: string;
  imageUrl: string;
  specs: Prisma.JsonValue;
  features: string[];
  rating: Prisma.Decimal;
  inStock: boolean;
  createdAt: Date;
}): FormattedProduct {
  const specsObj =
    typeof p.specs === "object" && p.specs !== null && !Array.isArray(p.specs)
      ? (p.specs as Record<string, unknown>)
      : {};

  const batteryHours =
    typeof specsObj.batteryLifeHours === "number"
      ? specsObj.batteryLifeHours
      : undefined;

  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    price: Number(p.price),
    description: p.description,
    imageUrl: p.imageUrl,
    specs: specsObj,
    features: p.features || [],
    rating: Number(p.rating),
    inStock: p.inStock,
    batteryHours,
    createdAt: p.createdAt,
  };
}

export class ProductService {
  /**
   * Retrieves a paginated and filtered list of products.
   * All filtering and sorting operations are executed at the PostgreSQL database level.
   */
  async listProducts(query: ListProductsQuery): Promise<ProductListResult> {
    const {
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      minRating,
      minBatteryHours,
      inStock,
      sort,
      page,
      limit,
    } = query;

    const where: Prisma.ProductWhereInput = {};

    // 1. Text Search across name, brand, category, description
    if (search && search.trim() !== "") {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { brand: { contains: term, mode: "insensitive" } },
        { category: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }

    // 2. Category Filter
    if (category && category.trim() !== "") {
      where.category = { equals: category.trim(), mode: "insensitive" };
    }

    // 3. Brand Filter
    if (brand && brand.trim() !== "") {
      where.brand = { equals: brand.trim(), mode: "insensitive" };
    }

    // 4. Price Range Filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    // 5. Minimum Rating Filter
    if (minRating !== undefined) {
      where.rating = { gte: minRating };
    }

    // 6. In-Stock Filter
    if (inStock !== undefined) {
      where.inStock = inStock;
    }

    // 7. Battery Life Filter (Database JSONB path query)
    if (minBatteryHours !== undefined) {
      where.specs = {
        path: ["batteryLifeHours"],
        gte: minBatteryHours,
      };
    }

    // 8. Safe OrderBy Mapping from Allowlist
    const sortAllowlist: Record<
      string,
      Prisma.ProductOrderByWithRelationInput
    > = {
      price_asc: { price: "asc" },
      price_desc: { price: "desc" },
      rating_desc: { rating: "desc" },
      name_asc: { name: "asc" },
    };

    const orderBy = sortAllowlist[sort] || { rating: "desc" };

    const skip = (page - 1) * limit;
    const take = limit;

    // Execute count and item queries atomically
    const [total, rawProducts] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: rawProducts.map(formatProduct),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves single product details by unique UUID.
   * Throws NotFoundError if product does not exist.
   */
  async getProductById(id: string): Promise<FormattedProduct> {
    const rawProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!rawProduct) {
      throw new NotFoundError(`Product with ID "${id}" was not found`);
    }

    return formatProduct(rawProduct);
  }

  /**
   * Retrieves available product categories with product counts for filter controls.
   */
  async getCategories(): Promise<Array<{ category: string; count: number }>> {
    const grouped = await prisma.product.groupBy({
      by: ["category"],
      _count: { id: true },
      orderBy: { category: "asc" },
    });

    return grouped.map((g) => ({
      category: g.category,
      count: g._count.id,
    }));
  }
}

export const productService = new ProductService();
export default productService;
