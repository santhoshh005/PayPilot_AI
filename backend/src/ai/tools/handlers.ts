import productService, { FormattedProduct } from "../../services/productService.js";
import cartService from "../../services/cartService.js";
import { CartResponse } from "../../schemas/cart.js";
import prisma from "../../lib/prisma.js";
import {
  searchProductsToolSchema,
  getProductToolSchema,
  compareProductsToolSchema,
  addToCartToolSchema,
  removeFromCartToolSchema,
  updateCartQuantityToolSchema,
} from "./schemas.js";

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result: unknown;
  rawProducts?: FormattedProduct[];
  comparisonProducts?: FormattedProduct[];
  rawCart?: CartResponse;
}

/**
 * Controlled Tool Handler Dispatcher.
 * Validates model-provided arguments with Zod before executing backend database queries.
 * Catches all errors safely to prevent server crashes.
 */
export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  sessionId?: string
): Promise<ToolExecutionResult> {
  try {
    switch (name) {
      case "search_products": {
        const parsed = searchProductsToolSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolName: name,
            success: false,
            result: {
              error: "Invalid search arguments provided",
              details: parsed.error.issues.map((i) => i.message),
            },
          };
        }

        const data = await productService.listProducts(parsed.data);
        return {
          toolName: name,
          success: true,
          result: {
            totalMatches: data.pagination.total,
            products: data.items.map((p) => ({
              id: p.id,
              name: p.name,
              brand: p.brand,
              category: p.category,
              price: p.price,
              rating: p.rating,
              batteryHours: p.batteryHours,
              inStock: p.inStock,
              keyFeatures: p.features.slice(0, 3),
              description: p.description,
            })),
          },
          rawProducts: data.items,
        };
      }

      case "get_product": {
        const parsed = getProductToolSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolName: name,
            success: false,
            result: {
              error: "Invalid product ID",
              details: parsed.error.issues.map((i) => i.message),
            },
          };
        }

        try {
          const product = await productService.getProductById(parsed.data.productId);
          return {
            toolName: name,
            success: true,
            result: {
              id: product.id,
              name: product.name,
              brand: product.brand,
              category: product.category,
              price: product.price,
              rating: product.rating,
              batteryHours: product.batteryHours,
              inStock: product.inStock,
              description: product.description,
              features: product.features,
              specs: product.specs,
            },
            rawProducts: [product],
          };
        } catch (err) {
          return {
            toolName: name,
            success: false,
            result: {
              error: (err as Error).message || "Product not found",
            },
          };
        }
      }

      case "compare_products": {
        const parsed = compareProductsToolSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolName: name,
            success: false,
            result: {
              error: "Invalid comparison arguments",
              details: parsed.error.issues.map((i) => i.message),
            },
          };
        }

        const rawProducts = await prisma.product.findMany({
          where: {
            id: { in: parsed.data.productIds },
          },
        });

        if (rawProducts.length < 2) {
          return {
            toolName: name,
            success: false,
            result: {
              error: `Could only find ${rawProducts.length} matching products for comparison. At least 2 are required.`,
            },
          };
        }

        const formatted = rawProducts.map((p) => {
          const specsObj =
            typeof p.specs === "object" && p.specs !== null && !Array.isArray(p.specs)
              ? (p.specs as Record<string, unknown>)
              : {};
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
            batteryHours:
              typeof specsObj.batteryLifeHours === "number"
                ? specsObj.batteryLifeHours
                : undefined,
            createdAt: p.createdAt,
          };
        });

        // Preserve exact requested productIds order (e.g. product 1 first, product 2 second)
        const idOrderMap = new Map(
          parsed.data.productIds.map((id, index) => [id, index])
        );
        formatted.sort(
          (a, b) => (idOrderMap.get(a.id) ?? 0) - (idOrderMap.get(b.id) ?? 0)
        );

        return {
          toolName: name,
          success: true,
          result: {
            comparisonCount: formatted.length,
            products: formatted.map((p) => ({
              id: p.id,
              name: p.name,
              brand: p.brand,
              price: p.price,
              rating: p.rating,
              batteryHours: p.batteryHours,
              keyFeatures: p.features.slice(0, 3),
              specs: p.specs,
            })),
          },
          comparisonProducts: formatted,
        };
      }

      case "get_categories": {
        const categories = await productService.getCategories();
        return {
          toolName: name,
          success: true,
          result: { categories },
        };
      }

      case "add_to_cart": {
        if (!sessionId) {
          return {
            toolName: name,
            success: false,
            result: { error: "Session required to add items to cart" },
          };
        }

        const parsed = addToCartToolSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolName: name,
            success: false,
            result: {
              error: "Invalid add_to_cart arguments",
              details: parsed.error.issues.map((i) => i.message),
            },
          };
        }

        try {
          const cart = await cartService.addItem(
            sessionId,
            parsed.data.productId,
            parsed.data.quantity
          );
          return {
            toolName: name,
            success: true,
            result: {
              message: "Item successfully added to cart",
              cart: {
                itemCount: cart.itemCount,
                subtotal: cart.subtotal,
                items: cart.items,
              },
            },
            rawCart: cart,
          };
        } catch (err) {
          return {
            toolName: name,
            success: false,
            result: { error: (err as Error).message },
          };
        }
      }

      case "remove_from_cart": {
        if (!sessionId) {
          return {
            toolName: name,
            success: false,
            result: { error: "Session required to remove items from cart" },
          };
        }

        const parsed = removeFromCartToolSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolName: name,
            success: false,
            result: {
              error: "Invalid remove_from_cart arguments",
              details: parsed.error.issues.map((i) => i.message),
            },
          };
        }

        try {
          const cart = await cartService.removeItem(sessionId, parsed.data.productId);
          return {
            toolName: name,
            success: true,
            result: {
              message: "Item removed from cart",
              cart: {
                itemCount: cart.itemCount,
                subtotal: cart.subtotal,
                items: cart.items,
              },
            },
            rawCart: cart,
          };
        } catch (err) {
          return {
            toolName: name,
            success: false,
            result: { error: (err as Error).message },
          };
        }
      }

      case "update_cart_quantity": {
        if (!sessionId) {
          return {
            toolName: name,
            success: false,
            result: { error: "Session required to update cart" },
          };
        }

        const parsed = updateCartQuantityToolSchema.safeParse(args);
        if (!parsed.success) {
          return {
            toolName: name,
            success: false,
            result: {
              error: "Invalid update_cart_quantity arguments",
              details: parsed.error.issues.map((i) => i.message),
            },
          };
        }

        try {
          const cart = await cartService.updateItem(
            sessionId,
            parsed.data.productId,
            parsed.data.quantity
          );
          return {
            toolName: name,
            success: true,
            result: {
              message: "Cart item quantity updated",
              cart: {
                itemCount: cart.itemCount,
                subtotal: cart.subtotal,
                items: cart.items,
              },
            },
            rawCart: cart,
          };
        } catch (err) {
          return {
            toolName: name,
            success: false,
            result: { error: (err as Error).message },
          };
        }
      }

      case "get_cart": {
        if (!sessionId) {
          return {
            toolName: name,
            success: false,
            result: { error: "Session required to retrieve cart" },
          };
        }

        try {
          const cart = await cartService.getCart(sessionId);
          return {
            toolName: name,
            success: true,
            result: {
              itemCount: cart.itemCount,
              subtotal: cart.subtotal,
              items: cart.items,
            },
            rawCart: cart,
          };
        } catch (err) {
          return {
            toolName: name,
            success: false,
            result: { error: (err as Error).message },
          };
        }
      }

      case "clear_cart": {
        if (!sessionId) {
          return {
            toolName: name,
            success: false,
            result: { error: "Session required to clear cart" },
          };
        }

        try {
          const cart = await cartService.clearCart(sessionId);
          return {
            toolName: name,
            success: true,
            result: {
              message: "Cart cleared successfully",
              cart: {
                itemCount: 0,
                subtotal: 0,
                items: [],
              },
            },
            rawCart: cart,
          };
        } catch (err) {
          return {
            toolName: name,
            success: false,
            result: { error: (err as Error).message },
          };
        }
      }

      default: {
        return {
          toolName: name,
          success: false,
          result: {
            error: `Unknown tool "${name}". Available tools: search_products, get_product, compare_products, get_categories, add_to_cart, remove_from_cart, update_cart_quantity, get_cart, clear_cart.`,
          },
        };
      }
    }
  } catch (error) {
    return {
      toolName: name,
      success: false,
      result: {
        error: (error as Error).message || "Internal tool execution failure",
      },
    };
  }
}
