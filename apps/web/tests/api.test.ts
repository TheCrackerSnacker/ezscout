import {
  ApiError,
  fetchSession,
  getPublishedForm,
  login,
  logout,
  publishForm,
  submitResponses,
  uploadDefinition
} from "../src/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Submission } from "@ezscout/shared";

const dbMocks = vi.hoisted(() => ({
  db: {
    forms: { put: vi.fn(), get: vi.fn() },
    outbox: { bulkAdd: vi.fn(), count: vi.fn().mockResolvedValue(0) }
  }
}));

vi.mock("../src/offline/db", () => dbMocks);

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
  let online = true;

  const setOnline = (value: boolean) => {
    online = value;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => online
    });
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setOnline(true);
    dbMocks.db.forms.get.mockReset();
    dbMocks.db.forms.put.mockReset();
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
      expect(dbMocks.db.forms.put).toHaveBeenCalledWith({
        id: publishedForm.id,
        definition: publishedForm,
        fetchedAt: expect.any(Number) as number
      });
      expect(fetchMock).toHaveBeenCalledWith(`/api/forms/${publishedForm.id}`);
    });

    it("serves the cached snapshot from Dexie when offline", async () => {
      setOnline(false);
      fetchMock.mockRejectedValue(new TypeError("network down"));
      dbMocks.db.forms.get.mockResolvedValue({
        id: publishedForm.id,
        definition: publishedForm,
        fetchedAt: 1
      });

      const form = await getPublishedForm(publishedForm.id);

      expect(form).toEqual(publishedForm);
      expect(dbMocks.db.forms.put).not.toHaveBeenCalled();
    });

    it("re-throws when offline and nothing is cached", async () => {
      setOnline(false);
      fetchMock.mockRejectedValue(new TypeError("network down"));
      dbMocks.db.forms.get.mockResolvedValue(undefined);

      const error = await getPublishedForm(publishedForm.id).catch(
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(TypeError);
    });

    it("throws an ApiError carrying the status on failure", async () => {
      fetchMock.mockResolvedValue(new Response("", { status: 404 }));

      const error = await getPublishedForm(publishedForm.id).catch(
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
    });

    it("rejects a payload that violates the public form schema", async () => {
      const malformed = (await JSON.parse(
        JSON.stringify(publishedForm)
      )) as Record<string, unknown>;
      delete malformed.version;
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(malformed), { status: 200 })
      );

      const error = await getPublishedForm(publishedForm.id).catch(
        (caught: unknown) => caught
      );

      expect(error).toBeInstanceOf(Error);
      expect((error as { status?: number }).status).toBeUndefined();
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

  describe("admin csrf handling", () => {
    it("stores the csrf token from login and attaches it to logout", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, csrfToken: "tok-123" }),
          { status: 200 }
        )
      );
      await login("secret");

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
      await logout();

      const [logoutUrl, logoutInit] = fetchMock.mock.calls[1] as [
        string,
        RequestInit
      ];
      expect(logoutUrl).toBe("/api/admin/logout");
      expect((logoutInit.headers as Record<string, string>)["X-CSRF-Token"]).toBe(
        "tok-123"
      );
    });

    it("captures the csrf token from the session endpoint when authenticated", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ authenticated: true, csrfToken: "tok-456" }),
          { status: 200 }
        )
      );
      const session = await fetchSession();
      expect(session).toEqual({ authenticated: true });

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
      await logout();

      const [, logoutInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(
        (logoutInit.headers as Record<string, string>)["X-CSRF-Token"]
      ).toBe("tok-456");
    });

    it("attaches the token to uploadDefinition and publishForm", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, csrfToken: "tok-789" }),
          { status: 200 }
        )
      );
      await login("secret");

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "form-1" }), { status: 201 })
      );
      await uploadDefinition(publishedForm as unknown as never);

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "form-1", version: 1 }),
          { status: 200 }
        )
      );
      await publishForm("form-1");

      const [, createInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      const [, publishInit] = fetchMock.mock.calls[2] as [string, RequestInit];
      expect(
        (createInit.headers as Record<string, string>)["X-CSRF-Token"]
      ).toBe("tok-789");
      expect((publishInit.headers as Record<string, string>)["X-CSRF-Token"]).toBe(
        "tok-789"
      );
    });
  });
});
