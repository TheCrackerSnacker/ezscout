import { ApiError, getPublishedForm, submitResponses } from "../src/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Submission } from "@ezscout/shared";

const publishedForm = {
  id: "0198f7a2-7b3c-7000-8000-3b9ac95e4a01",
  title: "Published form",
  version: 2,
  questions: [
    {
      id: "0198f7a2-7b3c-7000-8000-3b9ac95e4a02",
      type: "text",
      question: "Name?",
      required: true
    }
  ]
};

describe("api client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  describe("getPublishedForm", () => {
    it("returns the parsed form on success", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(publishedForm), { status: 200 })
      );

      const form = await getPublishedForm(publishedForm.id);

      expect(form.title).toBe("Published form");
      expect(form.questions).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith(`/api/forms/${publishedForm.id}`);
    });

    it("throws an ApiError carrying the status on failure", async () => {
      fetchMock.mockResolvedValue(new Response("", { status: 404 }));

      const error = await getPublishedForm(publishedForm.id).catch(
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
    });
  });

  describe("submitResponses", () => {
    it("posts the envelope and returns per-item results", async () => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [{ index: 0, status: "accepted" }]
          }),
          { status: 200 }
        )
      );

      const submission: Submission = {
        id: "0198f7a2-7b3c-7000-8000-3b9ac95e4a03",
        formId: publishedForm.id,
        formVersion: 2,
        answers: {}
      };
      const result = await submitResponses([submission]);

      expect(result.results[0]?.status).toBe("accepted");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/responses");
      expect(init.method).toBe("POST");
      expect(JSON.parse(String(init.body))).toEqual({
        responses: [submission]
      });
    });

    it("throws an ApiError when the server responds with an error status", async () => {
      fetchMock.mockResolvedValue(new Response("", { status: 500 }));

      const error = await submitResponses([
        {
          id: "0198f7a2-7b3c-7000-8000-3b9ac95e4a03",
          formId: publishedForm.id,
          formVersion: 2,
          answers: {}
        }
      ]).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
    });
  });
});
