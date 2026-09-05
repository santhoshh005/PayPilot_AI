import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../index.js";
import prisma from "../lib/prisma.js";
import { executeToolCall } from "../ai/tools/handlers.js";

describe("Phase 4: AI Agent Chat & Tool Calling", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("1. POST /api/chat API Validation & Session", () => {
    it("should accept a valid message and return a structured response envelope", async () => {
      const res = await request(app)
        .post("/api/chat")
        .send({ message: "Hello PayPilot!" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.message).toBe("string");
      expect(res.body.data.conversationId).toBeDefined();
    });

    it("should reject an empty message with 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .post("/api/chat")
        .send({ message: "   " });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toBeDefined();
    });

    it("should reject missing message field with 400 VALIDATION_ERROR", async () => {
      const res = await request(app).post("/api/chat").send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should preserve X-Session-Id and attach conversation to the session", async () => {
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const chatRes = await request(app)
        .post("/api/chat")
        .set("x-session-id", sessionId)
        .send({ message: "What can you help me with?" });

      expect(chatRes.status).toBe(200);
      expect(chatRes.headers["x-session-id"]).toBe(sessionId);

      const conversationId = chatRes.body.data.conversationId;

      const dbConv = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      expect(dbConv).toBeDefined();
      expect(dbConv?.sessionId).toBe(sessionId);
    });

    it("should isolate conversations between two different sessions", async () => {
      const user1SessionRes = await request(app).get("/api/session");
      const session1 = user1SessionRes.body.data.sessionId;

      const user2SessionRes = await request(app).get("/api/session");
      const session2 = user2SessionRes.body.data.sessionId;

      // User 1 creates a conversation
      const user1Chat = await request(app)
        .post("/api/chat")
        .set("x-session-id", session1)
        .send({ message: "Find earbuds under ₹2500" });

      const conv1Id = user1Chat.body.data.conversationId;

      // User 2 attempts to query User 1's conversation
      const user2History = await request(app)
        .get(`/api/chat/history?conversationId=${conv1Id}`)
        .set("x-session-id", session2);

      // Must not leak User 1's conversation
      expect(user2History.body.data.conversationId).not.toBe(conv1Id);
    });
  });

  describe("2. Tool Handler Direct Execution (search_products, get_product, compare_products)", () => {
    it("should execute search_products tool with maxPrice, category, and minBatteryHours", async () => {
      const toolRes = await executeToolCall("search_products", {
        category: "Wireless Earbuds",
        maxPrice: 2500,
        minBatteryHours: 30,
        sort: "rating_desc",
      });

      expect(toolRes.success).toBe(true);
      expect(toolRes.rawProducts).toBeDefined();
      expect(toolRes.rawProducts!.length).toBeGreaterThanOrEqual(3);

      toolRes.rawProducts!.forEach((p) => {
        expect(p.category).toBe("Wireless Earbuds");
        expect(p.price).toBeLessThanOrEqual(2500);
        expect(p.batteryHours).toBeGreaterThanOrEqual(30);
      });
    });

    it("should execute get_product tool and return full details for existing product", async () => {
      const all = await prisma.product.findMany({ take: 1 });
      const targetId = all[0].id;

      const toolRes = await executeToolCall("get_product", {
        productId: targetId,
      });

      expect(toolRes.success).toBe(true);
      expect(toolRes.rawProducts).toBeDefined();
      expect(toolRes.rawProducts![0].id).toBe(targetId);
      expect(toolRes.rawProducts![0].name).toBe(all[0].name);
    });

    it("should handle get_product tool safely when product does not exist", async () => {
      const fakeUuid = "00000000-0000-4000-a000-000000000000";
      const toolRes = await executeToolCall("get_product", {
        productId: fakeUuid,
      });

      expect(toolRes.success).toBe(false);
      expect((toolRes.result as { error: string }).error).toContain("was not found");
    });

    it("should execute compare_products tool for 2 existing products in requested order", async () => {
      const twoProducts = await prisma.product.findMany({ take: 2 });
      const ids = [twoProducts[0].id, twoProducts[1].id];

      const toolRes = await executeToolCall("compare_products", {
        productIds: ids,
      });

      expect(toolRes.success).toBe(true);
      expect(toolRes.comparisonProducts).toBeDefined();
      expect(toolRes.comparisonProducts!.length).toBe(2);
      expect(toolRes.comparisonProducts![0].id).toBe(ids[0]);
      expect(toolRes.comparisonProducts![1].id).toBe(ids[1]);
    });

    it("should reject compare_products tool when fewer than 2 valid IDs are provided", async () => {
      const toolRes = await executeToolCall("compare_products", {
        productIds: ["00000000-0000-4000-a000-000000000000"],
      });

      expect(toolRes.success).toBe(false);
      expect((toolRes.result as { error: string }).error).toBeDefined();
    });

    it("should safely reject malformed tool arguments without crashing", async () => {
      const toolRes = await executeToolCall("search_products", {
        minPrice: -500, // Invalid negative price
      });

      expect(toolRes.success).toBe(false);
      expect((toolRes.result as { error: string }).error).toContain("Invalid search arguments");
    });
  });

  describe("3. Multi-Turn Conversational Reference Resolution (4-Turn Sequence)", () => {
    let testSessionId: string;
    let testConversationId: string;
    let turn1FirstProduct: { id: string; name: string; price: number; batteryHours?: number };
    let turn1SecondProduct: { id: string; name: string; price: number; batteryHours?: number };

    it("Turn 1: 'I need wireless earbuds under ₹2500 with at least 30 hours of battery life.'", async () => {
      const res = await request(app).post("/api/chat").send({
        message:
          "I need wireless earbuds under ₹2500 with at least 30 hours of battery life.",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toBeDefined();
      expect(res.body.data.products.length).toBeGreaterThanOrEqual(2);

      testSessionId = res.headers["x-session-id"];
      testConversationId = res.body.data.conversationId;

      turn1FirstProduct = res.body.data.products[0];
      turn1SecondProduct = res.body.data.products[1];

      expect(turn1FirstProduct.name).toBe("OnePlus Nord Buds 2");
      expect(turn1SecondProduct.name).toBe("Noise Buds VS102");
    });

    it("Turn 2: 'Compare the first two.' -> must resolve to the first two products from Turn 1", async () => {
      const res = await request(app)
        .post("/api/chat")
        .set("x-session-id", testSessionId)
        .send({
          message: "Compare the first two.",
          conversationId: testConversationId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.comparison).toBeDefined();
      expect(res.body.data.comparison.length).toBe(2);

      // Verify exact reference resolution: must match Turn 1's products, NOT random headphones
      expect(res.body.data.comparison[0].id).toBe(turn1FirstProduct.id);
      expect(res.body.data.comparison[0].name).toBe(turn1FirstProduct.name);

      expect(res.body.data.comparison[1].id).toBe(turn1SecondProduct.id);
      expect(res.body.data.comparison[1].name).toBe(turn1SecondProduct.name);

      expect(res.body.data.message).toContain(turn1FirstProduct.name);
      expect(res.body.data.message).toContain(turn1SecondProduct.name);
    });

    it("Turn 3: 'Which one has better battery life?' -> must accurately cite the winning product's hours", async () => {
      const res = await request(app)
        .post("/api/chat")
        .set("x-session-id", testSessionId)
        .send({
          message: "Which one has better battery life?",
          conversationId: testConversationId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Noise Buds VS102 (50h) > OnePlus Nord Buds 2 (36h)
      expect(res.body.data.message).toContain("Noise Buds VS102");
      expect(res.body.data.message).toContain("50 hours");
      expect(res.body.data.message).toContain("36 hours");
    });

    it("Turn 4: 'Tell me more about the first one.' -> must retrieve details for the first product", async () => {
      const res = await request(app)
        .post("/api/chat")
        .set("x-session-id", testSessionId)
        .send({
          message: "Tell me more about the first one.",
          conversationId: testConversationId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      expect(res.body.data.message).toContain("OnePlus Nord Buds 2");
      expect(res.body.data.message).toContain("OnePlus");
      expect(res.body.data.message).toContain("2,499");
    });

    it("Turn 5: 'Which is cheaper?' -> must correctly identify the cheaper product", async () => {
      const res = await request(app)
        .post("/api/chat")
        .set("x-session-id", testSessionId)
        .send({
          message: "Which is cheaper?",
          conversationId: testConversationId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Noise Buds VS102 (₹1,299) is cheaper than OnePlus (₹2,499)
      expect(res.body.data.message).toContain("Noise Buds VS102");
      expect(res.body.data.message).toContain("1,299");
    });
  });
});
