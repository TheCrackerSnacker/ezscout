import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { buildApp } from "../../src/app";
import { createDb, type Db } from "../../src/db/client";
import { responses } from "../../src/db/schema";
import { runMigrations } from "../../src/db/migrator";
import { PublicFormSchema } from "@ezscout/shared";

const QUESTION_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_PASSWORD = "test-admin-password";
const SESSION_KEY = "test-session-key-0123456789abcdef0123456789abcdef";

function sampleDefinition() {
  return {
    title: "Integration form",
    questions: [
      {
        id: QUESTION_ID,
        type: "radio",
        question: "Attending?",
        options: ["Yes", "No"],
        required: true
      }
    ]
  };
}

async function tryStartContainer(): Promise<StartedPostgreSqlContainer | undefined> {
  try {
    return await new PostgreSqlContainer("postgres:17-alpine").start();
  } catch {
    return undefined;
  }
}

const container = await tryStartContainer();
if (!container) {
  console.warn("Docker unavailable — skipping integration suite");
}

const suite = container ? describe : describe.skip;

suite("forms + responses integration", () => {
  let db: Db;
  let pool: Pool | undefined;
  let app: FastifyInstance;
  let adminCookie: string;
  let adminCsrf: string;

  const asAdmin = (headers: Record<string, string> = {}) => ({
    ...headers,
    cookie: adminCookie,
    "x-csrf-token": adminCsrf
  });

  const createForm = (payload: object) =>
    app.inject({
      method: "POST",
      url: "/api/forms",
      payload,
      headers: asAdmin()
    });

  const publishForm = (formId: string) =>
    app.inject({
      method: "POST",
      url: `/api/forms/${formId}/publish`,
      payload: {},
      headers: asAdmin()
    });

  async function login(password: string) {
    return app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password }
    });
  }

  beforeAll(async () => {
    if (!container) return;
    const handle = createDb(container.getConnectionUri());
    db = handle.db;
    pool = handle.pool;
    await runMigrations(db);
    app = buildApp({ db, adminPassword: ADMIN_PASSWORD, sessionKey: SESSION_KEY });

    const loginResult = await login(ADMIN_PASSWORD);
    expect(loginResult.statusCode).toBe(200);
    adminCsrf = loginResult.json().csrfToken as string;
    // Echo the raw Set-Cookie pair: the signed value contains encoded
    // separators, so reparsing via response.cookies corrupts it.
    const setCookie = loginResult.headers["set-cookie"];
    const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    adminCookie = String(rawCookie ?? "").split(";")[0] ?? "";
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it("locks anonymous users out of form management", async () => {
    const anon = await app.inject({
      method: "POST",
      url: "/api/forms",
      payload: sampleDefinition()
    });
    expect(anon.statusCode).toBe(401);

    const anonList = await app.inject({ method: "GET", url: "/api/admin/forms" });
    expect(anonList.statusCode).toBe(401);
  });

  it("rejects bad credentials but accepts the configured password", async () => {
    const wrong = await login("not-the-password");
    expect(wrong.statusCode).toBe(401);

    const right = await login(ADMIN_PASSWORD);
    expect(right.statusCode).toBe(200);
    expect(right.json().ok).toBe(true);
  });

  it("returns 503 when the admin password is not configured", async () => {
    const previousPassword = process.env.ADMIN_PASSWORD;
    const previousKey = process.env.SESSION_KEY;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.SESSION_KEY;
    try {
      const bare = buildApp({ db });
      const attempt = await bare.inject({
        method: "POST",
        url: "/api/admin/login",
        payload: { password: "anything" }
      });
      expect(attempt.statusCode).toBe(503);

      const locked = await bare.inject({
        method: "POST",
        url: "/api/forms",
        payload: sampleDefinition()
      });
      expect(locked.statusCode).toBe(503);
    } finally {
      if (previousPassword !== undefined) process.env.ADMIN_PASSWORD = previousPassword;
      if (previousKey !== undefined) process.env.SESSION_KEY = previousKey;
    }
  });

  it("creates, publishes and serves a frozen snapshot", async () => {
    const created = await createForm(sampleDefinition());
    expect(created.statusCode).toBe(201);
    const formId = created.json().id;

    const unpublished = await app.inject({
      method: "GET",
      url: `/api/forms/${formId}`
    });
    expect(unpublished.statusCode).toBe(404);

    const published = await publishForm(formId);
    expect(published.statusCode).toBe(200);
    expect(published.json()).toEqual({ id: formId, version: 1 });

    const fetched = await app.inject({
      method: "GET",
      url: `/api/forms/${formId}`
    });
    expect(fetched.statusCode).toBe(200);
    const body = fetched.json();
    expect(PublicFormSchema.parse(body)).toEqual({
      id: formId,
      title: "Integration form",
      description: undefined,
      version: 1,
      questions: [
        {
          id: QUESTION_ID,
          type: "radio",
          question: "Attending?",
          options: ["Yes", "No"],
          required: true
        }
      ]
    });
    expect(body.questions).toHaveLength(1);
  });

  it("serves cache headers and honours If-None-Match", async () => {
    const created = await createForm(sampleDefinition());
    const formId = created.json().id;
    await publishForm(formId);

    const first = await app.inject({
      method: "GET",
      url: `/api/forms/${formId}`
    });
    expect(first.statusCode).toBe(200);
    const etag = String(first.headers.etag);
    expect(etag).toMatch(/^W\/"/);
    expect(first.headers["cache-control"]).toBe("public, max-age=0");

    const revalidated = await app.inject({
      method: "GET",
      url: `/api/forms/${formId}`,
      headers: { "if-none-match": etag }
    });
    expect(revalidated.statusCode).toBe(304);
    expect(revalidated.headers.etag).toBe(etag);
    expect(revalidated.body).toBe("");

    const unmatched = await app.inject({
      method: "GET",
      url: `/api/forms/${formId}`,
      headers: { "if-none-match": '"garbage"' }
    });
    expect(unmatched.statusCode).toBe(200);

    const republished = await publishForm(formId);
    expect(republished.json().version).toBe(2);

    const afterRepublish = await app.inject({
      method: "GET",
      url: `/api/forms/${formId}`,
      headers: { "if-none-match": etag }
    });
    expect(afterRepublish.statusCode).toBe(200);
    expect(String(afterRepublish.headers.etag)).not.toBe(etag);
  });

  it("bumps the version on each publish", async () => {
    const created = await createForm(sampleDefinition());
    const formId = created.json().id;

    await publishForm(formId);
    const second = await publishForm(formId);
    expect(second.json().version).toBe(2);
  });

  it("serves the next version after re-uploading a definition", async () => {
    const created = await createForm(sampleDefinition());
    const formId = created.json().id;
    await publishForm(formId);

    const updatedDefinition = {
      title: "Integration form (revamped)",
      questions: [
        {
          id: QUESTION_ID,
          type: "radio",
          question: "Attending remotely?",
          options: ["Yes", "No", "Maybe"],
          required: true
        }
      ]
    };

    const uploaded = await app.inject({
      method: "PUT",
      url: `/api/forms/${formId}/definition`,
      payload: updatedDefinition,
      headers: asAdmin()
    });
    expect(uploaded.statusCode).toBe(200);

    const published = await publishForm(formId);
    expect(published.json()).toEqual({ id: formId, version: 2 });

    const fetched = await app.inject({
      method: "GET",
      url: `/api/forms/${formId}`
    });
    const body = fetched.json();
    expect(body.title).toBe("Integration form (revamped)");
    expect(body.version).toBe(2);
    expect(body.questions[0].options).toEqual(["Yes", "No", "Maybe"]);

    const rejectedUpload = await app.inject({
      method: "PUT",
      url: `/api/forms/${formId}/definition`,
      payload: { nonsense: true },
      headers: asAdmin()
    });
    expect(rejectedUpload.statusCode).toBe(400);

    const missingForm = await app.inject({
      method: "PUT",
      url: `/api/forms/${randomUUID()}/definition`,
      payload: updatedDefinition,
      headers: asAdmin()
    });
    expect(missingForm.statusCode).toBe(404);
  });

  it("lists existing forms for the admin", async () => {
    const created = await createForm(sampleDefinition());
    const formId = created.json().id;
    await publishForm(formId);

    const listed = await app.inject({
      method: "GET",
      url: "/api/admin/forms",
      headers: asAdmin()
    });
    expect(listed.statusCode).toBe(200);
    const entry = listed
      .json()
      .forms.find((row: { id: string }) => row.id === formId);
    expect(entry).toBeTruthy();
    expect(entry.title).toBe("Integration form");
    expect(entry.publishedVersion).toBeGreaterThanOrEqual(1);
  });

  it("returns a form draft definition for the admin", async () => {
    const created = await createForm(sampleDefinition());
    const formId = created.json().id;
    await publishForm(formId);

    const fetched = await app.inject({
      method: "GET",
      url: `/api/admin/forms/${formId}`,
      headers: asAdmin()
    });
    expect(fetched.statusCode).toBe(200);
    const body = fetched.json();
    expect(body.id).toBe(formId);
    expect(body.title).toBe("Integration form");
    expect(body.publishedVersion).toBeGreaterThanOrEqual(1);
    expect(body.definition).toBeDefined();
    expect(body.definition.questions).toHaveLength(1);

    const anon = await app.inject({
      method: "GET",
      url: `/api/admin/forms/${formId}`
    });
    expect(anon.statusCode).toBe(401);
  });

  it("rejects batch items pinned to an unknown form version", async () => {
    const created = await createForm(sampleDefinition());
    const formId = created.json().id;
    const submission = {
      id: randomUUID(),
      formId,
      formVersion: 42,
      answers: { [QUESTION_ID]: "Yes" }
    };

    const result = await app.inject({
      method: "POST",
      url: "/api/responses",
      payload: { responses: [submission] }
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({
      results: [
        {
          index: 0,
          id: submission.id,
          status: "rejected",
          reason: "unknown_form_version"
        }
      ]
    });
  });

  it("accepts each valid response in a batch exactly once", async () => {
    const created = await createForm(sampleDefinition());
    const formId = created.json().id;
    await publishForm(formId);

    const first = {
      id: randomUUID(),
      formId,
      formVersion: 1,
      answers: { [QUESTION_ID]: "Yes" }
    };
    const second = { ...first, id: randomUUID() };
    const envelope = { responses: [first, second] };

    const initial = await app.inject({
      method: "POST",
      url: "/api/responses",
      payload: envelope
    });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toEqual({
      results: [
        { index: 0, id: first.id, status: "accepted" },
        { index: 1, id: second.id, status: "accepted" }
      ]
    });

    const replay = await app.inject({
      method: "POST",
      url: "/api/responses",
      payload: envelope
    });
    expect(replay.json()).toEqual({
      results: [
        { index: 0, id: first.id, status: "duplicate" },
        { index: 1, id: second.id, status: "duplicate" }
      ]
    });

    const rows = await db.select().from(responses).where(eq(responses.formId, formId));
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.answers)).toEqual([
      first.answers,
      second.answers
    ]);
  });

  it("rejects off-menu answers with issue details", async () => {
    const created = await createForm(sampleDefinition());
    const formId = created.json().id;
    await publishForm(formId);

    const result = await app.inject({
      method: "POST",
      url: "/api/responses",
      payload: {
        responses: [
          {
            id: randomUUID(),
            formId,
            formVersion: 1,
            answers: { [QUESTION_ID]: "Maybe" }
          }
        ]
      }
    });
    expect(result.statusCode).toBe(200);
    const body = result.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].status).toBe("rejected");
    expect(body.results[0].reason).toBe("validation_failed");
    expect(body.results[0].issues[0].questionId).toBe(QUESTION_ID);
  });

  it("rejects malformed submission envelopes with 400", async () => {
    const result = await app.inject({
      method: "POST",
      url: "/api/responses",
      payload: { nonsense: true }
    });
    expect(result.statusCode).toBe(400);
    expect(result.json().error).toBe("Invalid submission batch");
  });

  it("keeps structurally-bad items from failing the whole batch", async () => {
    const created = await createForm(sampleDefinition());
    const formId = created.json().id;
    await publishForm(formId);

    const good = {
      id: randomUUID(),
      formId,
      formVersion: 1,
      answers: { [QUESTION_ID]: "Yes" }
    };
    const offMenu = { ...good, id: randomUUID(), answers: { [QUESTION_ID]: "Maybe" } };
    const unknownVersion = { ...good, id: randomUUID(), formVersion: 42 };
    const garbage = { nonsense: true };

    const result = await app.inject({
      method: "POST",
      url: "/api/responses",
      payload: { responses: [good, offMenu, unknownVersion, garbage] }
    });
    expect(result.statusCode).toBe(200);

    const results = result.json().results;
    expect(results.map((entry: { status: string }) => entry.status)).toEqual([
      "accepted",
      "rejected",
      "rejected",
      "rejected"
    ]);
    expect(results[1].reason).toBe("validation_failed");
    expect(results[2].reason).toBe("unknown_form_version");
    expect(results[3].reason).toBe("invalid_payload");
    expect(results[3].id).toBeUndefined();

    const rows = await db.select().from(responses).where(eq(responses.formId, formId));
    expect(rows).toHaveLength(1);
  });

  it("resolves duplicate ids inside one batch", async () => {
    const created = await createForm(sampleDefinition());
    const formId = created.json().id;
    await publishForm(formId);

    const submission = {
      id: randomUUID(),
      formId,
      formVersion: 1,
      answers: { [QUESTION_ID]: "No" }
    };

    const result = await app.inject({
      method: "POST",
      url: "/api/responses",
      payload: { responses: [submission, submission] }
    });
    expect(result.statusCode).toBe(200);
    expect(result.json().results.map((entry: { status: string }) => entry.status)).toEqual([
      "accepted",
      "duplicate"
    ]);

    const rows = await db.select().from(responses).where(eq(responses.formId, formId));
    expect(rows).toHaveLength(1);
  });

  it("enforces envelope limits with 400", async () => {
    const cases = [
      {},
      { responses: [] },
      { responses: Array.from({ length: 101 }, () => ({})) }
    ];

    for (const payload of cases) {
      const result = await app.inject({
        method: "POST",
        url: "/api/responses",
        payload
      });
      expect(result.statusCode).toBe(400);
      expect(result.json().error).toBe("Invalid submission batch");
    }
  });
});
