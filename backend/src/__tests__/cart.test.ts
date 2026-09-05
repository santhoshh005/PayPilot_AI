import { describe, it, expect, afterAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../index.js";
import prisma from "../lib/prisma.js";
import { executeToolCall } from "../ai/tools/handlers.js";

describe("Phase 5: Server-Authoritative Cart & Gemini Cart Tools", { timeout: 25000 }, () => {
  let sampleProduct1: { id: string; name: string; price: number };
  let sampleProduct2: { id: string; name: string; price: number };
  let outOfStockProduct: { id: string; name: string };

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Fetch in-stock products for testing
    const inStock = await prisma.product.findMany({
      where: { inStock: true },
      take: 2,
    });
    sampleProduct1 = {
      id: inStock[0].id,
      name: inStock[0].name,
      price: Number(inStock[0].price),
    };
    sampleProduct2 = {
      id: inStock[1].id,
      name: inStock[1].name,
      price: Number(inStock[1].price),
    };

    // Find or create an out-of-stock product for edge testing
    let oos = await prisma.product.findFirst({
      where: { inStock: false },
    });
    if (!oos) {
      oos = await prisma.product.create({
        data: {
          name: "Out of Stock Test Earbuds",
          brand: "TestBrand",
          category: "Wireless Earbuds",
          price: 999,
          description: "Test out of stock product",
          imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500",
          specs: {},
          features: [],
          rating: 4.0,
          inStock: false,
        },
      });
    }
    outOfStockProduct = { id: oos.id, name: oos.name };
  });

  describe("1. Cart REST API Core Operations", () => {
    it("1. GET /api/cart: should return empty cart for new session", async () => {
      const res = await request(app).get("/api/cart");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.itemCount).toBe(0);
      expect(res.body.data.subtotal).toBe(0);
    });

    it("2. POST /api/cart/items: should add a valid product to cart", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({
          productId: sampleProduct1.id,
          quantity: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].productId).toBe(sampleProduct1.id);
      expect(res.body.data.items[0].quantity).toBe(1);
      expect(res.body.data.items[0].price).toBe(sampleProduct1.price);
      expect(res.body.data.items[0].lineTotal).toBe(sampleProduct1.price);
      expect(res.body.data.subtotal).toBe(sampleProduct1.price);
      expect(res.body.data.itemCount).toBe(1);
    });

    it("3. POST /api/cart/items: adding same product twice increases quantity without duplicate rows", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      // Add quantity 1
      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 1 });

      // Add quantity 2
      const res = await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].quantity).toBe(3);
      expect(res.body.data.items[0].lineTotal).toBe(sampleProduct1.price * 3);
      expect(res.body.data.subtotal).toBe(sampleProduct1.price * 3);
    });

    it("4. PATCH /api/cart/items/:productId: should update quantity of existing item", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 1 });

      const res = await request(app)
        .patch(`/api/cart/items/${sampleProduct1.id}`)
        .set("x-session-id", sessionId)
        .send({ quantity: 4 });

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(4);
      expect(res.body.data.subtotal).toBe(sampleProduct1.price * 4);
    });

    it("5. DELETE /api/cart/items/:productId: should remove an item from the cart", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 1 });

      const res = await request(app)
        .delete(`/api/cart/items/${sampleProduct1.id}`)
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(0);
      expect(res.body.data.subtotal).toBe(0);
      expect(res.body.data.itemCount).toBe(0);
    });

    it("6. DELETE /api/cart: should clear entire cart", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 1 });

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct2.id, quantity: 1 });

      const res = await request(app)
        .delete("/api/cart")
        .set("x-session-id", sessionId);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.subtotal).toBe(0);
      expect(res.body.data.itemCount).toBe(0);
    });
  });

  describe("2. Server-Authoritative Pricing & Validation Guards", () => {
    it("7. should reject adding nonexistent product with 404 NOT_FOUND", async () => {
      const fakeUuid = "00000000-0000-4000-a000-000000000000";
      const res = await request(app)
        .post("/api/cart/items")
        .send({ productId: fakeUuid, quantity: 1 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("8. should reject invalid product UUID with 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .post("/api/cart/items")
        .send({ productId: "not-a-uuid", quantity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("9. should reject out-of-stock product with 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .post("/api/cart/items")
        .send({ productId: outOfStockProduct.id, quantity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("out of stock");
    });

    it("10. should reject quantity 0 with 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .post("/api/cart/items")
        .send({ productId: sampleProduct1.id, quantity: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("11. should reject negative quantity with 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .post("/api/cart/items")
        .send({ productId: sampleProduct1.id, quantity: -2 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("12. should reject quantity exceeding maximum (10) with 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .post("/api/cart/items")
        .send({ productId: sampleProduct1.id, quantity: 15 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("13 & 14. should calculate multiple products subtotal accurately without precision drift", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 2 });

      const res = await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct2.id, quantity: 3 });

      const expectedSubtotal =
        sampleProduct1.price * 2 + sampleProduct2.price * 3;

      expect(res.status).toBe(200);
      expect(res.body.data.subtotal).toBe(expectedSubtotal);
      expect(res.body.data.itemCount).toBe(5);
    });

    it("15. should ignore any client-supplied price or total in request body", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({
          productId: sampleProduct1.id,
          quantity: 1,
          price: 1, // Maliciously low client price
          subtotal: 1,
        });

      // Price MUST be authoritative database price
      expect(res.status).toBe(200);
      expect(res.body.data.items[0].price).toBe(sampleProduct1.price);
      expect(res.body.data.subtotal).toBe(sampleProduct1.price);
    });

    it("16. should enforce session isolation (Session A cannot access Session B's cart)", async () => {
      const user1Res = await request(app).get("/api/session");
      const user2Res = await request(app).get("/api/session");

      const session1 = user1Res.body.data.sessionId;
      const session2 = user2Res.body.data.sessionId;

      // User 1 adds product
      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", session1)
        .send({ productId: sampleProduct1.id, quantity: 2 });

      // User 2 queries cart -> must be empty
      const user2Cart = await request(app)
        .get("/api/cart")
        .set("x-session-id", session2);

      expect(user2Cart.body.data.items.length).toBe(0);
      expect(user2Cart.body.data.subtotal).toBe(0);
    });
  });

  describe("3. Controlled Gemini Cart Tools Direct Execution", () => {
    let toolSessionId: string;

    beforeEach(async () => {
      const sessionRes = await request(app).get("/api/session");
      toolSessionId = sessionRes.body.data.sessionId;
    });

    it("17. add_to_cart tool should add item to session's cart", async () => {
      const res = await executeToolCall(
        "add_to_cart",
        { productId: sampleProduct1.id, quantity: 1 },
        toolSessionId
      );

      expect(res.success).toBe(true);
      expect(res.rawCart).toBeDefined();
      expect(res.rawCart!.items.length).toBe(1);
      expect(res.rawCart!.items[0].productId).toBe(sampleProduct1.id);
    });

    it("18. remove_from_cart tool should remove item from session's cart", async () => {
      await executeToolCall(
        "add_to_cart",
        { productId: sampleProduct1.id, quantity: 1 },
        toolSessionId
      );

      const res = await executeToolCall(
        "remove_from_cart",
        { productId: sampleProduct1.id },
        toolSessionId
      );

      expect(res.success).toBe(true);
      expect(res.rawCart!.items.length).toBe(0);
    });

    it("19. update_cart_quantity tool should update quantity", async () => {
      await executeToolCall(
        "add_to_cart",
        { productId: sampleProduct1.id, quantity: 1 },
        toolSessionId
      );

      const res = await executeToolCall(
        "update_cart_quantity",
        { productId: sampleProduct1.id, quantity: 3 },
        toolSessionId
      );

      expect(res.success).toBe(true);
      expect(res.rawCart!.items[0].quantity).toBe(3);
    });

    it("20. get_cart tool should retrieve authoritative cart", async () => {
      await executeToolCall(
        "add_to_cart",
        { productId: sampleProduct1.id, quantity: 2 },
        toolSessionId
      );

      const res = await executeToolCall("get_cart", {}, toolSessionId);

      expect(res.success).toBe(true);
      expect(res.rawCart!.itemCount).toBe(2);
      expect(res.rawCart!.subtotal).toBe(sampleProduct1.price * 2);
    });

    it("21. clear_cart tool should reset the cart", async () => {
      await executeToolCall(
        "add_to_cart",
        { productId: sampleProduct1.id, quantity: 1 },
        toolSessionId
      );

      const res = await executeToolCall("clear_cart", {}, toolSessionId);

      expect(res.success).toBe(true);
      expect(res.rawCart!.items.length).toBe(0);
      expect(res.rawCart!.subtotal).toBe(0);
    });
  });

  describe("4. Conversational Cart Reference Resolution via AI Chat", () => {
    it("22. 'Add the first one' should resolve against active product context", async () => {
      // Step 1: Search products
      const searchRes = await request(app).post("/api/chat").send({
        message: "Find wireless earbuds under ₹2500 with at least 30 hours battery",
      });

      const sessionId = searchRes.headers["x-session-id"];
      const conversationId = searchRes.body.data.conversationId;
      const firstProduct = searchRes.body.data.products[0];

      // Step 2: Add the first one
      const addRes = await request(app)
        .post("/api/chat")
        .set("x-session-id", sessionId)
        .send({
          message: "Add the first one to my cart",
          conversationId,
        });

      expect(addRes.status).toBe(200);
      expect(addRes.body.data.cart).toBeDefined();
      expect(addRes.body.data.cart.items.length).toBe(1);
      expect(addRes.body.data.cart.items[0].productId).toBe(firstProduct.id);
      expect(addRes.body.data.cart.items[0].name).toBe(firstProduct.name);
      expect(addRes.body.data.message).toContain(firstProduct.name);
    });

    it("23. 'Add the cheaper one' should resolve to the lower priced product from context", async () => {
      // Step 1: Search
      const searchRes = await request(app).post("/api/chat").send({
        message: "Find wireless earbuds under ₹2500 with at least 30 hours battery",
      });

      const sessionId = searchRes.headers["x-session-id"];
      const conversationId = searchRes.body.data.conversationId;

      // Step 2: Compare first two
      const compRes = await request(app)
        .post("/api/chat")
        .set("x-session-id", sessionId)
        .send({
          message: "Compare the first two.",
          conversationId,
        });

      const compared = compRes.body.data.comparison;
      const cheapest = [...compared].sort((a: any, b: any) => a.price - b.price)[0];

      // Step 3: Add the cheaper one
      const addRes = await request(app)
        .post("/api/chat")
        .set("x-session-id", sessionId)
        .send({
          message: "Add the cheaper one to my cart.",
          conversationId,
        });

      expect(addRes.status).toBe(200);
      expect(addRes.body.data.cart).toBeDefined();
      expect(addRes.body.data.cart.items[0].productId).toBe(cheapest.id);
      expect(addRes.body.data.cart.items[0].name).toBe(cheapest.name);
      expect(addRes.body.data.message).toContain(cheapest.name);
    });

    it("24. Cart operations return authoritative product data", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const res = await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: sampleProduct1.id, quantity: 2 });

      const item = res.body.data.items[0];
      expect(item.name).toBe(sampleProduct1.name);
      expect(typeof item.imageUrl).toBe("string");
      expect(item.inStock).toBe(true);
      expect(item.lineTotal).toBe(sampleProduct1.price * 2);
    });
  });
});
