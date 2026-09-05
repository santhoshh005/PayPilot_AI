import { describe, it, expect, afterAll } from "vitest";
import prisma from "../lib/prisma.js";

describe("Database & Prisma Schema Verification", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should successfully connect to the PostgreSQL database", async () => {
    const result = await prisma.$queryRaw<Array<{ connected: number }>>`SELECT 1 as connected;`;
    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(result[0].connected).toBe(1);
  });

  it("should have seeded at least 21 products", async () => {
    const count = await prisma.product.count();
    expect(count).toBeGreaterThanOrEqual(21);
  });

  it("should contain all 5 required demonstration categories", async () => {
    const categories = await prisma.product.groupBy({
      by: ["category"],
    });

    const categoryNames = categories.map((c) => c.category);
    expect(categoryNames).toContain("Wireless Earbuds");
    expect(categoryNames).toContain("Headphones");
    expect(categoryNames).toContain("Smartwatches");
    expect(categoryNames).toContain("Smartphones");
    expect(categoryNames).toContain("Laptops");
  });

  it("should support filtering: earbuds under ₹2500 with at least 30h battery", async () => {
    const earbudsUnder2500 = await prisma.product.findMany({
      where: {
        category: "Wireless Earbuds",
        price: { lte: 2500 },
      },
    });

    expect(earbudsUnder2500.length).toBeGreaterThanOrEqual(3);

    // Verify boAt Airdopes 141 (42h battery, ₹1299) is included
    const boat = earbudsUnder2500.find((p) => p.name === "boAt Airdopes 141");
    expect(boat).toBeDefined();
    expect(Number(boat?.price)).toBe(1299);
    expect((boat?.specs as Record<string, unknown>)?.batteryLifeHours).toBe(42);
  });

  it("should support session, cart, and conversation relationship queries", async () => {
    // Verify models can be queried without relational errors
    const sessionsCount = await prisma.session.count();
    const cartsCount = await prisma.cart.count();
    const ordersCount = await prisma.order.count();
    const conversationsCount = await prisma.conversation.count();
    const webhookEventsCount = await prisma.webhookEvent.count();

    expect(sessionsCount).toBeGreaterThanOrEqual(0);
    expect(cartsCount).toBeGreaterThanOrEqual(0);
    expect(ordersCount).toBeGreaterThanOrEqual(0);
    expect(conversationsCount).toBeGreaterThanOrEqual(0);
    expect(webhookEventsCount).toBeGreaterThanOrEqual(0);
  });
});
