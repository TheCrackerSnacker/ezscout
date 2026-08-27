import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("Responses rate limiting", () => {
  afterAll(() => {
    delete process.env.RESPONSES_RATE_LIMIT;
  });

  it("limits anonymous submission batches per source IP", async () => {
    process.env.RESPONSES_RATE_LIMIT = "5";
    const app = buildApp();

    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/responses",
        payload: { responses: [] }
      });
      expect(res.statusCode).not.toBe(429);
    }

    const limited = await app.inject({
      method: "POST",
      url: "/api/responses",
      payload: { responses: [] }
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({
      error: expect.stringMatching(/^Rate limit exceeded/)
    });
  });
});