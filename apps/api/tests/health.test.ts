import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("GET /api/health", () => {
  it("reports ok without requiring a live socket", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns json content type", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.headers["content-type"]).toContain("application/json");
  });
});
