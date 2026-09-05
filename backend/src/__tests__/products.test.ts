import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../index.js";
import prisma from "../lib/prisma.js";

describe("Phase 3: Product Catalog API", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("GET /api/products", () => {
    it("1. should list products with default pagination (limit 12, page 1)", async () => {
      const res = await request(app).get("/api/products");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBeLessThanOrEqual(12);
      expect(res.body.data.pagination).toEqual({
        page: 1,
        limit: 12,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(21);
    });

    it("2. should return an empty result list when no products match the search query", async () => {
      const res = await request(app).get(
        "/api/products?search=xyznonexistentgadget9999"
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.pagination.total).toBe(0);
    });

    it("3. should search products by keyword across name, brand, or description", async () => {
      const res = await request(app).get("/api/products?search=Sony");
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);

      const sonyProduct = res.body.data.items.find(
        (p: { brand: string }) => p.brand === "Sony"
      );
      expect(sonyProduct).toBeDefined();
      expect(sonyProduct.name).toContain("WH-1000XM5");
    });

    it("4. should filter products by category", async () => {
      const res = await request(app).get(
        "/api/products?category=Smartwatches"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(4);
      res.body.data.items.forEach((p: { category: string }) => {
        expect(p.category).toBe("Smartwatches");
      });
    });

    it("5. should filter products by maximum price", async () => {
      const res = await request(app).get("/api/products?maxPrice=2000");
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((p: { price: number }) => {
        expect(p.price).toBeLessThanOrEqual(2000);
      });
    });

    it("6. should filter products by minimum battery hours", async () => {
      const res = await request(app).get("/api/products?minBatteryHours=30");
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((p: { batteryHours?: number }) => {
        expect(p.batteryHours).toBeGreaterThanOrEqual(30);
      });
    });

    it("7. should filter products by minimum rating", async () => {
      const res = await request(app).get("/api/products?minRating=4.5");
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((p: { rating: number }) => {
        expect(p.rating).toBeGreaterThanOrEqual(4.5);
      });
    });

    it("8. should filter products by stock status", async () => {
      const res = await request(app).get("/api/products?inStock=true");
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      res.body.data.items.forEach((p: { inStock: boolean }) => {
        expect(p.inStock).toBe(true);
      });
    });

    it("9. should sort products correctly", async () => {
      // Ascending price
      const resAsc = await request(app).get("/api/products?sort=price_asc");
      expect(resAsc.status).toBe(200);
      const itemsAsc = resAsc.body.data.items;
      for (let i = 0; i < itemsAsc.length - 1; i++) {
        expect(itemsAsc[i].price).toBeLessThanOrEqual(itemsAsc[i + 1].price);
      }

      // Descending price
      const resDesc = await request(app).get("/api/products?sort=price_desc");
      expect(resDesc.status).toBe(200);
      const itemsDesc = resDesc.body.data.items;
      for (let i = 0; i < itemsDesc.length - 1; i++) {
        expect(itemsDesc[i].price).toBeGreaterThanOrEqual(itemsDesc[i + 1].price);
      }
    });

    it("10. should paginate products with custom page and limit", async () => {
      const res = await request(app).get("/api/products?page=2&limit=5");
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeLessThanOrEqual(5);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.limit).toBe(5);
    });

    it("11. should reject invalid query parameters with 400 VALIDATION_ERROR", async () => {
      // Invalid sort option
      const resBadSort = await request(app).get(
        "/api/products?sort=invalid_sort_param"
      );
      expect(resBadSort.status).toBe(400);
      expect(resBadSort.body.success).toBe(false);
      expect(resBadSort.body.error.code).toBe("VALIDATION_ERROR");

      // Negative minPrice
      const resNegativePrice = await request(app).get(
        "/api/products?minPrice=-100"
      );
      expect(resNegativePrice.status).toBe(400);
      expect(resNegativePrice.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("12. should handle target demo query: 'wireless earbuds under ₹2500 with at least 30h battery'", async () => {
      const res = await request(app).get(
        "/api/products?category=Wireless%20Earbuds&maxPrice=2500&minBatteryHours=30"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(3);

      const names = res.body.data.items.map((p: { name: string }) => p.name);
      expect(names).toContain("boAt Airdopes 141");
      expect(names).toContain("Noise Buds VS102");
      expect(names).toContain("OnePlus Nord Buds 2");

      res.body.data.items.forEach(
        (p: { category: string; price: number; batteryHours: number }) => {
          expect(p.category).toBe("Wireless Earbuds");
          expect(p.price).toBeLessThanOrEqual(2500);
          expect(p.batteryHours).toBeGreaterThanOrEqual(30);
        }
      );
    });
  });

  describe("GET /api/products/categories", () => {
    it("should return all 5 categories with product counts", async () => {
      const res = await request(app).get("/api/products/categories");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(5);

      const categoryNames = res.body.data.map(
        (c: { category: string }) => c.category
      );
      expect(categoryNames).toContain("Wireless Earbuds");
      expect(categoryNames).toContain("Headphones");
      expect(categoryNames).toContain("Smartwatches");
      expect(categoryNames).toContain("Smartphones");
      expect(categoryNames).toContain("Laptops");
    });
  });

  describe("GET /api/products/:id", () => {
    it("13. should return complete product specifications for a valid product ID", async () => {
      // First get any product
      const listRes = await request(app).get("/api/products?limit=1");
      const targetProduct = listRes.body.data.items[0];

      const res = await request(app).get(`/api/products/${targetProduct.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(targetProduct.id);
      expect(res.body.data.name).toBe(targetProduct.name);
      expect(res.body.data.brand).toBe(targetProduct.brand);
      expect(typeof res.body.data.price).toBe("number");
      expect(res.body.data.description).toBeDefined();
      expect(res.body.data.specs).toBeDefined();
      expect(Array.isArray(res.body.data.features)).toBe(true);
      expect(typeof res.body.data.rating).toBe("number");
      expect(typeof res.body.data.inStock).toBe("boolean");
    });

    it("14. should return 404 NOT_FOUND for a valid UUID that does not exist", async () => {
      const nonExistentUuid = "00000000-0000-4000-a000-000000000000";
      const res = await request(app).get(`/api/products/${nonExistentUuid}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("15. should return 400 VALIDATION_ERROR for an invalid non-UUID product ID", async () => {
      const res = await request(app).get("/api/products/not-a-valid-uuid");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toBeDefined();
    });
  });
});
