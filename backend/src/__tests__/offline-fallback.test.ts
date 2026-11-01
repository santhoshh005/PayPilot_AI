import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../index.js";
import productService from "../services/productService.js";
import cartService from "../services/cartService.js";
import agentService from "../services/agentService.js";
import { FALLBACK_PRODUCTS } from "../data/fallbackProducts.js";
import crypto from "crypto";

describe("Offline / In-Memory Resilient Fallback Suite", () => {
  it("should return the 21 seeded products from fallback catalog via ProductService", async () => {
    const result = await productService.listProducts({
      limit: 25,
      page: 1,
      sort: "featured",
    });

    expect(result.items.length).toBeGreaterThanOrEqual(21);
    expect(result.pagination.total).toBeGreaterThanOrEqual(21);
    const macbook = result.items.find((p) => p.name.includes("MacBook"));
    expect(macbook).toBeDefined();
    expect(macbook?.price).toBe(89900);
  });

  it("should filter products by category in-memory", async () => {
    const result = await productService.listProducts({
      category: "Wireless Earbuds",
      limit: 10,
      page: 1,
      sort: "featured",
    });

    expect(result.items.length).toBeGreaterThanOrEqual(5);
    for (const item of result.items) {
      expect(item.category).toBe("Wireless Earbuds");
    }
  });

  it("should get a single product by ID from fallback catalog", async () => {
    const firstProduct = FALLBACK_PRODUCTS[0];
    const fetched = await productService.getProductById(firstProduct.id);

    expect(fetched).toBeDefined();
    expect(fetched.name).toBe(firstProduct.name);
    expect(fetched.price).toBe(firstProduct.price);
  });

  it("should manage cart in-memory when database is unreachable", async () => {
    const testSession = crypto.randomUUID();
    const product = FALLBACK_PRODUCTS[0];

    // Add item
    const cartAfterAdd = await cartService.addItem(testSession, product.id, 2);
    expect(cartAfterAdd.items.length).toBe(1);
    expect(cartAfterAdd.items[0].productId).toBe(product.id);
    expect(cartAfterAdd.items[0].quantity).toBe(2);
    expect(cartAfterAdd.subtotal).toBe(product.price * 2);

    // Get cart
    const cartFetched = await cartService.getCart(testSession);
    expect(cartFetched.items.length).toBe(1);
    expect(cartFetched.itemCount).toBe(2);

    // Clear cart
    const cartCleared = await cartService.clearCart(testSession);
    expect(cartCleared.items.length).toBe(0);
    expect(cartCleared.itemCount).toBe(0);
  });

  it("should handle AI chat without crashing and return fallback agent response", async () => {
    const testSession = crypto.randomUUID();
    const response = await agentService.processMessage(
      testSession,
      "recommend wireless earbuds under 2500"
    );

    expect(response).toBeDefined();
    expect(response.message).toBeDefined();
    expect(response.conversationId).toBeDefined();
    expect(response.message.length).toBeGreaterThan(10);
  });

  it("should return HTTP 200 on /api/health with degraded or ok database status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.service).toBe("paypilot-backend");
    expect(["connected", "disconnected"]).toContain(res.body.data.database);
  });

  it("should serve /api/products endpoint with HTTP 200 even if database is offline", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it("should handle POST /api/chat endpoint with HTTP 200", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "Hello! What products do you have?" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBeDefined();
  });
});
