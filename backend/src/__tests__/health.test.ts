import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../index.js";

describe("Health Check API", () => {
  it("GET /api/health should return status 200 with structured health details", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.service).toBe("paypilot-backend");
    expect(res.body.data.database).toBe("connected");
    expect(res.body.data.timestamp).toBeDefined();
    expect(typeof res.body.data.uptime).toBe("number");
  });

  it("GET / should return informational endpoint metadata", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("PayPilot AI API");
    expect(res.body.status).toBe("online");
  });
});
