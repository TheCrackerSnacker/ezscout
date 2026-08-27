import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "../src/uuid";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomUUID", () => {
  const original = globalThis.crypto.randomUUID;

  afterEach(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: original,
      configurable: true
    });
  });

  it("returns a valid v4 UUID when crypto.randomUUID is available", () => {
    expect(randomUUID()).toMatch(UUID_RE);
  });

  it("falls back to getRandomValues outside secure contexts", () => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true
    });

    for (let i = 0; i < 20; i++) {
      expect(randomUUID()).toMatch(UUID_RE);
    }
  });
});