import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import app from "../index.js";
import prisma from "../lib/prisma.js";
import { env } from "../config/env.js";

describe("Phase 7: Razorpay Checkout Integration & Security Invariants", { timeout: 25000 }, () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("1. Frontend Bundle Security & Secret Isolation", () => {
    it("12. should verify RAZORPAY_KEY_SECRET does NOT exist anywhere in frontend source or compiled bundle", () => {
      const secret = env.RAZORPAY_KEY_SECRET;

      // 1. Scan frontend/src
      const srcDir = path.resolve(process.cwd(), "frontend", "src");
      function scanDir(dir: string): boolean {
        if (!fs.existsSync(dir)) return false;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (scanDir(fullPath)) return true;
          } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
            const content = fs.readFileSync(fullPath, "utf-8");
            if (content.includes("RAZORPAY_KEY_SECRET")) {
              return true;
            }
            if (secret && secret.length > 5 && content.includes(secret)) {
              return true;
            }
          }
        }
        return false;
      }

      const foundInSrc = scanDir(srcDir);
      expect(foundInSrc).toBe(false);

      // 2. Scan frontend/dist if built
      const distDir = path.resolve(process.cwd(), "frontend", "dist");
      if (fs.existsSync(distDir)) {
        const assetsDir = path.join(distDir, "assets");
        if (fs.existsSync(assetsDir)) {
          for (const file of fs.readdirSync(assetsDir)) {
            const content = fs.readFileSync(path.join(assetsDir, file), "utf-8");
            if (secret && secret.length > 5) {
              expect(content).not.toContain(secret);
            }
            expect(content).not.toContain("RAZORPAY_KEY_SECRET");
          }
        }
      }
    });
  });

  describe("2. Checkout Order Response Contract for Razorpay Standard Checkout", () => {
    it("1, 2, 3, 4, 5, 6. should return authoritative checkout details required to launch Razorpay Checkout", async () => {
      // Create session and add a product to cart
      const sessionRes = await request(app).get("/api/session");
      const sessionId = sessionRes.body.data.sessionId;

      const product = await prisma.product.findFirst({
        where: { inStock: true },
      });
      expect(product).toBeDefined();

      await request(app)
        .post("/api/cart/items")
        .set("x-session-id", sessionId)
        .send({ productId: product!.id, quantity: 1 });

      // Call checkout order
      const checkoutRes = await request(app)
        .post("/api/checkout/order")
        .set("x-session-id", sessionId)
        .send({});

      expect(checkoutRes.status).toBe(200);
      expect(checkoutRes.body.success).toBe(true);

      const data = checkoutRes.body.data;

      // 3. Amount is in paise (product price * 100)
      const expectedAmountPaise = Math.round(Number(product!.price) * 100);
      expect(data.amount).toBe(expectedAmountPaise);

      // 4. Currency is fixed to INR
      expect(data.currency).toBe("INR");

      // 5. Backend returns razorpayOrderId
      expect(data.razorpayOrderId).toMatch(/^order_/);

      // 6. Backend returns public keyId (never secret)
      expect(data.keyId).toBeDefined();
      expect(data.keyId).not.toContain(env.RAZORPAY_KEY_SECRET);

      // 10 & 11. Verify Database Invariants (Order remains PENDING, not PAID)
      const dbOrder = await prisma.order.findUnique({
        where: { id: data.orderId },
      });

      expect(dbOrder).toBeDefined();
      expect(dbOrder?.status).toBe("PENDING");
      expect(dbOrder?.razorpayPaymentId).toBeNull();
      expect(dbOrder?.paidAt).toBeNull();

      // 9. Cart remains intact (not cleared upon checkout order creation or cancellation)
      const cartRes = await request(app)
        .get("/api/cart")
        .set("x-session-id", sessionId);

      expect(cartRes.body.data.items.length).toBe(1);
    });
  });
});
