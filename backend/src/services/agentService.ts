import { GoogleGenAI } from "@google/genai";
import { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import prisma from "../lib/prisma.js";
import { FormattedProduct } from "./productService.js";
import cartService from "./cartService.js";
import { CartResponse } from "../schemas/cart.js";
import { ALL_AGENT_TOOLS } from "../ai/tools/definitions.js";
import { executeToolCall } from "../ai/tools/handlers.js";
import PAYPILOT_SYSTEM_PROMPT from "../ai/systemPrompt.js";

export interface AgentChatResponse {
  message: string;
  conversationId: string;
  products?: FormattedProduct[];
  comparison?: FormattedProduct[];
  cart?: CartResponse;
  toolsExecuted: string[];
}

interface StoredToolCalls {
  tools: string[];
  products?: FormattedProduct[];
  comparison?: FormattedProduct[];
  cart?: CartResponse;
}

/**
 * Retrieves the most recently active product recommendations or comparison items
 * from the conversation's database message history.
 */
async function getRecentProductContext(conversationId: string): Promise<{
  products: FormattedProduct[];
  comparison: FormattedProduct[];
  cart?: CartResponse;
}> {
  const previousAssistantMessages = await prisma.message.findMany({
    where: {
      conversationId,
      role: "ASSISTANT",
      toolCalls: { not: Prisma.JsonNull },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  let products: FormattedProduct[] = [];
  let comparison: FormattedProduct[] = [];
  let cart: CartResponse | undefined;
  let multiProductSearchList: FormattedProduct[] = [];

  for (const msg of previousAssistantMessages) {
    if (msg.toolCalls && typeof msg.toolCalls === "object") {
      const tc = msg.toolCalls as unknown as StoredToolCalls;
      if (Array.isArray(tc.products) && tc.products.length > 0) {
        if (products.length === 0) {
          products = tc.products;
        }
        if (tc.products.length > 1 && multiProductSearchList.length === 0) {
          multiProductSearchList = tc.products;
        }
      }
      if (Array.isArray(tc.comparison) && tc.comparison.length > 0 && comparison.length === 0) {
        comparison = tc.comparison;
      }
      if (tc.cart && !cart) {
        cart = tc.cart;
      }
      if (products.length > 0 && multiProductSearchList.length > 0 && comparison.length > 0 && cart) break;
    }
  }

  // If latest products array has fewer than 2 items (e.g. from single get_product inspection),
  // but a multi-product search list exists in recent turns, use the multi-product list
  // so multi-product references ("second one", "cheaper one", "more expensive one") can resolve.
  if (products.length < 2 && multiProductSearchList.length >= 2) {
    products = multiProductSearchList;
  }

  return { products, comparison, cart };
}

export class AgentService {
  private aiClient: GoogleGenAI | null = null;

  constructor() {
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== "") {
      this.aiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }
  }

  /**
   * Orchestrates multi-turn conversation with Gemini function calling and cart actions.
   * Loads context from PostgreSQL, processes tool calls, and persists messages.
   */
  async processMessage(
    sessionId: string,
    messageText: string,
    conversationId?: string
  ): Promise<AgentChatResponse> {
    // 1. Resolve or create active conversation for this session
    let conversation = conversationId
      ? await prisma.conversation.findFirst({
          where: { id: conversationId, sessionId },
        })
      : await prisma.conversation.findFirst({
          where: { sessionId },
          orderBy: { createdAt: "desc" },
        });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { sessionId },
      });
    }

    // 2. Persist incoming User Message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: messageText,
      },
    });

    // 3. Load recent conversation history (latest 15 messages)
    const historyMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 15,
    });

    // 4. Format contents array for Gemini with structured product and cart references
    const contents: Array<{
      role: "user" | "model";
      parts: Array<Record<string, unknown>>;
    }> = [];

    for (const msg of historyMessages) {
      if (msg.role === "USER") {
        contents.push({
          role: "user",
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === "ASSISTANT") {
        let textContent = msg.content;

        // If this message previously displayed products, attach structured reference context
        if (msg.toolCalls && typeof msg.toolCalls === "object") {
          const tc = msg.toolCalls as unknown as StoredToolCalls;
          if (Array.isArray(tc.products) && tc.products.length > 0) {
            const productReferenceList = tc.products
              .map(
                (p, idx) =>
                  `${idx + 1}. ${p.name} (UUID: ${p.id} | Price: ₹${p.price} | Battery: ${p.batteryHours ?? "N/A"}h | Rating: ${p.rating}/5)`
              )
              .join("\n");

            textContent += `\n\n[Active Products in Context]:\n${productReferenceList}`;
          }

          if (tc.cart && Array.isArray(tc.cart.items) && tc.cart.items.length > 0) {
            const cartReferenceList = tc.cart.items
              .map(
                (item, idx) =>
                  `${idx + 1}. ${item.name} (UUID: ${item.productId} | Qty: ${item.quantity} | Price: ₹${item.price} | LineTotal: ₹${item.lineTotal})`
              )
              .join("\n");

            textContent += `\n\n[Current Cart State]:\n${cartReferenceList}\nCart Subtotal: ₹${tc.cart.subtotal}`;
          }
        }

        contents.push({
          role: "model",
          parts: [{ text: textContent }],
        });
      }
    }

    // Fallback: If no Gemini API Key is configured, run deterministic fallback agent
    if (!this.aiClient || !env.GEMINI_API_KEY) {
      return this.runDeterministicFallback(
        sessionId,
        conversation.id,
        messageText
      );
    }

    const toolsExecuted: string[] = [];
    let collectedProducts: FormattedProduct[] = [];
    let collectedComparison: FormattedProduct[] = [];
    let collectedCart: CartResponse | undefined;
    let finalAssistantText = "";

    try {
      const model = env.GEMINI_MODEL;
      let turns = 0;
      const MAX_TURNS = 5; // Guard against runaway loops

      while (turns < MAX_TURNS) {
        turns++;

        const response = await this.aiClient.models.generateContent({
          model,
          contents: contents as any,
          config: {
            systemInstruction: PAYPILOT_SYSTEM_PROMPT,
            tools: [{ functionDeclarations: ALL_AGENT_TOOLS as any }],
          },
        });

        const candidate = response.candidates?.[0];
        if (!candidate || !candidate.content) {
          finalAssistantText =
            "I could not process your request at this moment. Please try again.";
          break;
        }

        // Add candidate output to history
        contents.push(candidate.content as any);

        const functionCalls = response.functionCalls;

        // If Gemini returned a function call, execute it
        if (functionCalls && functionCalls.length > 0) {
          const responseParts: Array<Record<string, unknown>> = [];

          for (const call of functionCalls) {
            if (!call.name) continue;
            toolsExecuted.push(call.name);

            const toolResult = await executeToolCall(
              call.name,
              (call.args as Record<string, unknown>) || {},
              sessionId
            );

            if (toolResult.rawProducts && toolResult.rawProducts.length > 0) {
              collectedProducts = toolResult.rawProducts;
            }
            if (
              toolResult.comparisonProducts &&
              toolResult.comparisonProducts.length > 0
            ) {
              collectedComparison = toolResult.comparisonProducts;
            }
            if (toolResult.rawCart) {
              collectedCart = toolResult.rawCart;
            }

            responseParts.push({
              functionResponse: {
                name: call.name,
                id: call.id,
                response: { result: toolResult.result },
              },
            });
          }

          // Return tool outputs back to Gemini in the next turn
          contents.push({
            role: "user",
            parts: responseParts,
          });
        } else {
          // Model returned final text response
          finalAssistantText = response.text || "";
          break;
        }
      }

      if (!finalAssistantText) {
        finalAssistantText =
          "I've processed your request based on our catalog and cart.";
      }

      // 5. Persist Assistant Message with Structured Tool Payload
      const storedPayload: StoredToolCalls = {
        tools: toolsExecuted,
        products: collectedProducts.length > 0 ? collectedProducts : undefined,
        comparison:
          collectedComparison.length > 0 ? collectedComparison : undefined,
        cart: collectedCart,
      };

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: finalAssistantText,
          toolCalls: storedPayload as any,
        },
      });

      return {
        message: finalAssistantText,
        conversationId: conversation.id,
        products: collectedProducts.length > 0 ? collectedProducts : undefined,
        comparison:
          collectedComparison.length > 0 ? collectedComparison : undefined,
        cart: collectedCart,
        toolsExecuted,
      };
    } catch (error) {
      console.error("[AgentService] Gemini call failed, falling back to deterministic resolution:", error);
      return this.runDeterministicFallback(
        sessionId,
        conversation.id,
        messageText
      );
    }
  }

  /**
   * Deterministic conversational agent for offline testing, reference resolution, and cart actions.
   * Resolves references dynamically ("Add the cheaper one", "Add the first one", "Change it to 2", "What's in my cart?")
   * against PostgreSQL records.
   */
  private async runDeterministicFallback(
    sessionId: string,
    conversationId: string,
    messageText: string
  ): Promise<AgentChatResponse> {
    const lower = messageText.toLowerCase().trim();
    let replyText = "";
    let products: FormattedProduct[] | undefined;
    let comparison: FormattedProduct[] | undefined;
    let cart: CartResponse | undefined;
    const toolsExecuted: string[] = [];

    // Load recent context from database
    const context = await getRecentProductContext(conversationId);

    // ─── CART ACTION: "Add the cheaper one" / "Add cheaper one" ───
    if (
      lower.includes("add the cheaper one") ||
      lower.includes("add cheaper one") ||
      (lower.includes("add") && lower.includes("cheaper"))
    ) {
      const candidateList =
        context.comparison.length >= 2
          ? context.comparison
          : context.products.length >= 2
          ? context.products
          : [];

      if (candidateList.length >= 2) {
        const sortedByPrice = [...candidateList].sort((a, b) => a.price - b.price);
        const cheapest = sortedByPrice[0];

        toolsExecuted.push("add_to_cart");
        const addRes = await executeToolCall(
          "add_to_cart",
          { productId: cheapest.id, quantity: 1 },
          sessionId
        );

        cart = addRes.rawCart;
        replyText = `Done! I added the **${cheapest.name}** to your cart for **₹${cheapest.price.toLocaleString("en-IN")}**.`;
      } else {
        replyText =
          "I couldn't identify the products to compare for price. Please search for products first!";
      }
    }
    // ─── CART ACTION: "Add the first one" / "Add first one" ───
    else if (
      lower.includes("add the first one") ||
      lower.includes("add first one") ||
      lower.includes("add 1 to cart") ||
      lower.includes("add product 1")
    ) {
      const target =
        context.products.length > 0
          ? context.products[0]
          : context.comparison.length > 0
          ? context.comparison[0]
          : null;

      if (target) {
        toolsExecuted.push("add_to_cart");
        const addRes = await executeToolCall(
          "add_to_cart",
          { productId: target.id, quantity: 1 },
          sessionId
        );

        cart = addRes.rawCart;
        replyText = `Done! I added the **${target.name}** to your cart for **₹${target.price.toLocaleString("en-IN")}**.`;
      } else {
        replyText =
          "I couldn't find a recent product to add. Which product would you like to add to your cart?";
      }
    }
    // ─── CART ACTION: "Add the second one" / "Add second one" ───
    else if (
      lower.includes("add the second one") ||
      lower.includes("add second one") ||
      lower.includes("add 2 to cart")
    ) {
      const target =
        context.products.length > 1
          ? context.products[1]
          : context.comparison.length > 1
          ? context.comparison[1]
          : null;

      if (target) {
        toolsExecuted.push("add_to_cart");
        const addRes = await executeToolCall(
          "add_to_cart",
          { productId: target.id, quantity: 1 },
          sessionId
        );

        cart = addRes.rawCart;
        replyText = `Done! I added the **${target.name}** to your cart for **₹${target.price.toLocaleString("en-IN")}**.`;
      } else {
        replyText =
          "I couldn't find a second product in our conversation to add to the cart.";
      }
    }
    // ─── CART ACTION: "Add the more expensive one" / "Add expensive one" ───
    else if (
      lower.includes("add the more expensive one") ||
      lower.includes("add more expensive one") ||
      lower.includes("add the expensive one") ||
      lower.includes("add expensive one") ||
      (lower.includes("add") && (lower.includes("expensive") || lower.includes("costlier") || lower.includes("priciest")))
    ) {
      const candidateList =
        context.comparison.length >= 2
          ? context.comparison
          : context.products.length >= 2
          ? context.products
          : [];

      if (candidateList.length >= 2) {
        const sortedByPrice = [...candidateList].sort((a, b) => b.price - a.price);
        const expensive = sortedByPrice[0];

        toolsExecuted.push("add_to_cart");
        const addRes = await executeToolCall(
          "add_to_cart",
          { productId: expensive.id, quantity: 1 },
          sessionId
        );

        cart = addRes.rawCart;
        replyText = `Done! I added the **${expensive.name}** to your cart for **₹${expensive.price.toLocaleString("en-IN")}**.`;
      } else {
        replyText =
          "I couldn't identify the products to compare for price. Please search for products first!";
      }
    }
    // ─── CART ACTION: "Add the one with better battery" ───
    else if (
      (lower.includes("add") && lower.includes("battery"))
    ) {
      const candidateList =
        context.comparison.length >= 2
          ? context.comparison
          : context.products.length >= 2
          ? context.products
          : [];

      if (candidateList.length >= 2) {
        const sortedByBattery = [...candidateList].sort(
          (a, b) => (b.batteryHours ?? 0) - (a.batteryHours ?? 0)
        );
        const bestBattery = sortedByBattery[0];

        toolsExecuted.push("add_to_cart");
        const addRes = await executeToolCall(
          "add_to_cart",
          { productId: bestBattery.id, quantity: 1 },
          sessionId
        );

        cart = addRes.rawCart;
        replyText = `Done! I added the **${bestBattery.name}** with **${bestBattery.batteryHours}h battery life** to your cart for **₹${bestBattery.price.toLocaleString("en-IN")}**.`;
      } else {
        replyText =
          "I couldn't identify products with battery specifications. Please search for products first!";
      }
    }
    // ─── CART ACTION: "What's in my cart?" / "Show my cart" / "How much is my cart?" ───
    else if (
      lower.includes("in my cart") ||
      lower.includes("show my cart") ||
      lower.includes("view cart") ||
      lower.includes("how much is my cart") ||
      lower === "cart"
    ) {
      toolsExecuted.push("get_cart");
      const cartRes = await executeToolCall("get_cart", {}, sessionId);
      cart = cartRes.rawCart;

      if (!cart || cart.items.length === 0) {
        replyText = "Your shopping cart is currently empty. Tell me what you're looking for to add products!";
      } else {
        replyText =
          `Here is what's in your cart (${cart.itemCount} item${cart.itemCount > 1 ? "s" : ""}):\n\n` +
          cart.items
            .map(
              (item) =>
                `• **${item.name}** × ${item.quantity} — ₹${item.lineTotal.toLocaleString("en-IN")}`
            )
            .join("\n") +
          `\n\n**Subtotal:** ₹${cart.subtotal.toLocaleString("en-IN")}`;
      }
    }
    // ─── CART ACTION: "Change it to 2" / "Update quantity" ───
    else if (
      lower.includes("change it to") ||
      lower.includes("change quantity to") ||
      lower.includes("set quantity to") ||
      lower.includes("make it 2") ||
      lower.includes("change to 2")
    ) {
      const currentCart = await cartService.getCart(sessionId);
      if (currentCart.items.length > 0) {
        // Extract requested quantity
        const match = lower.match(/\b([1-9]|10)\b/);
        const targetQty = match ? parseInt(match[1], 10) : 2;

        const targetItem = currentCart.items[currentCart.items.length - 1];

        toolsExecuted.push("update_cart_quantity");
        const updateRes = await executeToolCall(
          "update_cart_quantity",
          { productId: targetItem.productId, quantity: targetQty },
          sessionId
        );

        cart = updateRes.rawCart;
        replyText = `Updated! The quantity for **${targetItem.name}** is now **${targetQty}**. New cart subtotal: **₹${cart?.subtotal.toLocaleString("en-IN")}**.`;
      } else {
        replyText = "Your cart is currently empty, so there are no items to update.";
      }
    }
    // ─── CART ACTION: "Remove it" / "Remove from cart" ───
    else if (
      lower.includes("remove it") ||
      lower.includes("remove the noise") ||
      lower.includes("remove product") ||
      (lower.includes("remove") && (lower.includes("cart") || lower.includes("first")))
    ) {
      const currentCart = await cartService.getCart(sessionId);
      if (currentCart.items.length > 0) {
        // If message mentions a specific brand/name, search for it, else target first item
        const targetItem =
          lower.includes("noise")
            ? currentCart.items.find((i) => i.name.toLowerCase().includes("noise")) || currentCart.items[0]
            : currentCart.items[0];

        toolsExecuted.push("remove_from_cart");
        const remRes = await executeToolCall(
          "remove_from_cart",
          { productId: targetItem.productId },
          sessionId
        );

        cart = remRes.rawCart;
        replyText = `Removed **${targetItem.name}** from your cart. Your cart now has ${cart?.itemCount || 0} items.`;
      } else {
        replyText = "Your cart is already empty.";
      }
    }
    // ─── CART ACTION: "Clear my cart" / "Empty cart" ───
    else if (
      lower.includes("clear my cart") ||
      lower.includes("clear cart") ||
      lower.includes("empty my cart")
    ) {
      toolsExecuted.push("clear_cart");
      const clearRes = await executeToolCall("clear_cart", {}, sessionId);
      cart = clearRes.rawCart;
      replyText = "Your cart has been cleared successfully.";
    }
    // ─── PRODUCT ACTIONS (from Phase 4): Compare ───
    else if (
      lower.includes("compare the first two") ||
      lower.includes("compare first two") ||
      lower.includes("compare 1 and 2") ||
      (lower.includes("compare") && context.products.length >= 2)
    ) {
      toolsExecuted.push("compare_products");
      const targetProducts = context.products.slice(0, 2);

      if (targetProducts.length >= 2) {
        const compRes = await executeToolCall("compare_products", {
          productIds: [targetProducts[0].id, targetProducts[1].id],
        });

        comparison = compRes.comparisonProducts;
        const p1 = targetProducts[0];
        const p2 = targetProducts[1];

        replyText = `Here is a side-by-side comparison of **${p1.name}** and **${p2.name}**:\n\n` +
          `• **Price:** ${p1.name} is ₹${p1.price.toLocaleString("en-IN")} vs ${p2.name} at ₹${p2.price.toLocaleString("en-IN")}\n` +
          `• **Battery Life:** ${p1.name} offers ${p1.batteryHours ?? "N/A"}h playback vs ${p2.name} with ${p2.batteryHours ?? "N/A"}h\n` +
          `• **Rating:** ${p1.name} is rated ${p1.rating}/5 vs ${p2.name} at ${p2.rating}/5\n\n` +
          `Notice the key differences in specifications, battery endurance, and pricing above.`;
      } else {
        replyText =
          "I need at least two products in our active search to perform a comparison. Which products would you like to compare?";
      }
    }
    // ─── Better Battery ───
    else if (
      lower.includes("better battery") ||
      lower.includes("best battery") ||
      (lower.includes("battery") && (lower.includes("which") || lower.includes("more")))
    ) {
      const candidateList =
        context.comparison.length >= 2
          ? context.comparison
          : context.products.length >= 2
          ? context.products
          : [];

      if (candidateList.length >= 2) {
        const sortedByBattery = [...candidateList].sort(
          (a, b) => (b.batteryHours ?? 0) - (a.batteryHours ?? 0)
        );
        const best = sortedByBattery[0];
        const runnerUp = sortedByBattery[1];

        replyText = `Between the two, **${best.name}** has the better battery life with **${best.batteryHours} hours** of playback, compared to **${runnerUp.batteryHours} hours** on the **${runnerUp.name}**.`;
        comparison = candidateList.slice(0, 2);
      } else {
        replyText =
          "Please select or search for products first so I can compare their battery performance for you.";
      }
    }
    // ─── Cheaper Product Inspection ───
    else if (
      lower.includes("cheaper") ||
      lower.includes("lowest price") ||
      lower.includes("cheapest")
    ) {
      const candidateList =
        context.comparison.length >= 2
          ? context.comparison
          : context.products.length >= 2
          ? context.products
          : [];

      if (candidateList.length >= 2) {
        const sortedByPrice = [...candidateList].sort((a, b) => a.price - b.price);
        const cheapest = sortedByPrice[0];
        const other = sortedByPrice[1];

        replyText = `**${cheapest.name}** is the more affordable option at **₹${cheapest.price.toLocaleString("en-IN")}**, whereas **${other.name}** is priced at **₹${other.price.toLocaleString("en-IN")}**.`;
        comparison = candidateList.slice(0, 2);
      } else {
        replyText =
          "Please search for or compare products first to check which option is cheaper.";
      }
    }
    // ─── More Expensive Product Inspection ───
    else if (
      lower.includes("more expensive") ||
      lower.includes("higher price") ||
      lower.includes("priciest") ||
      lower.includes("most expensive")
    ) {
      const candidateList =
        context.comparison.length >= 2
          ? context.comparison
          : context.products.length >= 2
          ? context.products
          : [];

      if (candidateList.length >= 2) {
        const sortedByPrice = [...candidateList].sort((a, b) => b.price - a.price);
        const expensive = sortedByPrice[0];
        const other = sortedByPrice[1];

        replyText = `**${expensive.name}** is the more premium option at **₹${expensive.price.toLocaleString("en-IN")}**, whereas **${other.name}** is priced at **₹${other.price.toLocaleString("en-IN")}**.`;
        comparison = candidateList.slice(0, 2);
      } else {
        replyText =
          "Please search for or compare products first to check which option is more expensive.";
      }
    }
    // ─── Tell me more about the first one ───
    else if (
      lower.includes("the first one") ||
      lower.includes("about the first one") ||
      lower.includes("first product")
    ) {
      const target =
        context.products.length > 0
          ? context.products[0]
          : context.comparison.length > 0
          ? context.comparison[0]
          : null;

      if (target) {
        toolsExecuted.push("get_product");
        const getRes = await executeToolCall("get_product", {
          productId: target.id,
        });

        if (getRes.success && getRes.rawProducts && getRes.rawProducts.length > 0) {
          const detail = getRes.rawProducts[0];
          products = [detail];
          replyText = `Here are the complete details for the **${detail.name}** (${detail.brand}):\n\n` +
            `• **Price:** ₹${detail.price.toLocaleString("en-IN")}\n` +
            `• **Rating:** ${detail.rating}/5.0\n` +
            (detail.batteryHours ? `• **Battery Playback:** ${detail.batteryHours} Hours\n` : "") +
            `• **Description:** ${detail.description}\n\n` +
            `**Key Features:**\n${detail.features.map((f) => `  - ${f}`).join("\n")}`;
        } else {
          replyText = `Here is more information about **${target.name}**: ${target.description}`;
        }
      } else {
        replyText =
          "I couldn't find a previous product recommendation to inspect. Tell me what product you're looking for!";
      }
    }
    // ─── Tell me more about the second one ───
    else if (
      lower.includes("the second one") ||
      lower.includes("about the second one") ||
      lower.includes("second product")
    ) {
      const target =
        context.products.length > 1
          ? context.products[1]
          : context.comparison.length > 1
          ? context.comparison[1]
          : null;

      if (target) {
        toolsExecuted.push("get_product");
        const getRes = await executeToolCall("get_product", {
          productId: target.id,
        });

        if (getRes.success && getRes.rawProducts && getRes.rawProducts.length > 0) {
          const detail = getRes.rawProducts[0];
          products = [detail];
          replyText = `Here are the complete details for the **${detail.name}** (${detail.brand}):\n\n` +
            `• **Price:** ₹${detail.price.toLocaleString("en-IN")}\n` +
            `• **Rating:** ${detail.rating}/5.0\n` +
            (detail.batteryHours ? `• **Battery Playback:** ${detail.batteryHours} Hours\n` : "") +
            `• **Description:** ${detail.description}\n\n` +
            `**Key Features:**\n${detail.features.map((f) => `  - ${f}`).join("\n")}`;
        } else {
          replyText = `Here is more information about **${target.name}**: ${target.description}`;
        }
      } else {
        replyText =
          "I couldn't find a second product in our conversation to inspect. Tell me what product you're looking for!";
      }
    }
    // ─── Search Queries ───
    else if (
      lower.includes("earbud") ||
      lower.includes("earphone") ||
      (lower.includes("battery") && lower.includes("under"))
    ) {
      toolsExecuted.push("search_products");
      const searchRes = await executeToolCall("search_products", {
        search: "earbuds",
        category: "Wireless Earbuds",
        maxPrice: 2500,
        minBatteryHours: 30,
        sort: "rating_desc",
        limit: 4,
      });

      products = searchRes.rawProducts;
      replyText =
        "Here are the top-rated wireless earbuds under ₹2,500 with at least 30 hours of battery life from our catalog:\n\n" +
        (products || [])
          .map(
            (p, i) =>
              `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString("en-IN")} | ⭐ ${p.rating} | 🔋 ${p.batteryHours}h battery`
          )
          .join("\n") +
        "\n\nYou can ask me to compare any of these (e.g. *\"Compare the first two\"*) or add to your cart (e.g. *\"Add the cheaper one to my cart\"*)!";
    } else if (lower.includes("smartwatch") || lower.includes("watch")) {
      toolsExecuted.push("search_products");
      const searchRes = await executeToolCall("search_products", {
        category: "Smartwatches",
        maxPrice: 5000,
        sort: "rating_desc",
      });
      products = searchRes.rawProducts;
      replyText =
        "Here are our top smartwatches under ₹5,000 with Bluetooth calling, health tracking, and HD displays:\n\n" +
        (products || [])
          .map(
            (p, i) =>
              `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString("en-IN")} | ⭐ ${p.rating}`
          )
          .join("\n");
    } else if (lower.includes("laptop")) {
      toolsExecuted.push("search_products");
      const searchRes = await executeToolCall("search_products", {
        category: "Laptops",
        sort: "price_asc",
      });
      products = searchRes.rawProducts;
      replyText =
        "Here are the top laptops available in our store:\n\n" +
        (products || [])
          .map(
            (p, i) =>
              `${i + 1}. **${p.name}** — ₹${p.price.toLocaleString("en-IN")} | ⭐ ${p.rating}`
          )
          .join("\n");
    } else {
      replyText =
        "Hello! I am PayPilot AI, your agentic shopping assistant. Tell me what you're looking for (e.g., 'wireless earbuds under ₹2500 with 30h battery' or 'smartwatches under ₹5000') and I'll find, compare, and add the best options to your cart!";
    }

    // Persist Assistant Message with Structured Tool Payload
    const storedPayload: StoredToolCalls = {
      tools: toolsExecuted,
      products,
      comparison,
      cart,
    };

    await prisma.message.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content: replyText,
        toolCalls: storedPayload as any,
      },
    });

    return {
      message: replyText,
      conversationId,
      products,
      comparison,
      cart,
      toolsExecuted,
    };
  }
}

export const agentService = new AgentService();
export default agentService;
