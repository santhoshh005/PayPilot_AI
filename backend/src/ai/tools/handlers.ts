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
          let productId = parsed.data.productId;
          const resolved = await productService.resolveProduct(productId);
          if (resolved) {
            productId = resolved.id;
          }
          const product = await productService.getProductById(productId);
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

        const resolvedIds: string[] = [];
        for (const pid of parsed.data.productIds) {
          const resolved = await productService.resolveProduct(pid);
          resolvedIds.push(resolved ? resolved.id : pid);
        }

        const formatted = await productService.getProductsByIds(resolvedIds);

        if (formatted.length < 2) {
          return {
            toolName: name,
            success: false,
            result: {
              error: `Could only find ${formatted.length} matching products for comparison. At least 2 are required.`,
            },
          };
        }

        // Preserve exact requested productIds order (e.g. product 1 first, product 2 second)
        const idOrderMap = new Map(
          resolvedIds.map((id, index) => [id, index])
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
          let targetProductId = parsed.data.productId;
          const resolved = await productService.resolveProduct(targetProductId);
          if (resolved) {
            targetProductId = resolved.id;
          }

          const cart = await cartService.addItem(
            sessionId,
            targetProductId,
            parsed.data.quantity
          );
          return {
            toolName: name,
            success: true,
            result: {
              message: `Item "${resolved?.name || targetProductId}" successfully added to cart`,
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
          let targetProductId = parsed.data.productId;
          const resolved = await productService.resolveProduct(targetProductId);
          if (resolved) {
            targetProductId = resolved.id;
          }

          const cart = await cartService.removeItem(sessionId, targetProductId);
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
          let targetProductId = parsed.data.productId;
          const resolved = await productService.resolveProduct(targetProductId);
          if (resolved) {
            targetProductId = resolved.id;
          }

          const cart = await cartService.updateItem(
            sessionId,
            targetProductId,
            parsed.data.quantity
          );
          return {
            toolName: name,
            success: true,
            result: {
              message: "Cart quantity updated successfully",
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
