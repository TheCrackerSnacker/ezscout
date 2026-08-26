import { describe, expect, it } from "vitest";
import { parseDraft } from "../src/admin/parseDraft";

const validDraft = {
  title: "Valid form",
  questions: [
    {
      id: "0198f7a2-7b3c-7000-8000-3b9ac95e4a01",
      type: "text",
      question: "Name?",
      required: true
    }
  ]
};

describe("parseDraft", () => {
  it("accepts a valid definition", () => {
    const result = parseDraft(JSON.stringify(validDraft));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition.title).toBe("Valid form");
    }
  });

  it("reports broken JSON with the parser message", () => {
    const result = parseDraft("{not json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Not valid JSON");
      expect(result.issues).toEqual([]);
    }
  });

  it("surfaces schema issues with paths", () => {
    const result = parseDraft(
      JSON.stringify({ title: "No questions", questions: [] })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("schema");
      const paths = result.issues.map((issue) => issue.path);
      expect(paths).toContain("questions");
    }
  });
});
