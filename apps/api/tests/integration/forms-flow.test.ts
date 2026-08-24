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

const QUESTION_ID = "22222222-2222-4222-8222-222222222222";

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

  beforeAll(async () => {
    if (!container) return;
    const handle = createDb(container.getConnectionUri());
    db = handle.db;
    pool = handle.pool;
    await runMigrations(db);
    app = buildApp({ db });
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it("creates, publishes and serves a frozen snapshot", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/forms",
      payload: sampleDefinition()
    });
    expect(created.statusCode).toBe(201);
    const formId = created.json().id;

    const unpublished = await app.inject({
      method: "GET",
      url: `/api/forms/${formId}`
    });
    expect(unpublished.statusCode).toBe(404);

    const published = await app.inject({
      method: "POST",
      url: `/api/forms/${formId}/publish`,
      payload: {}
    });
    expect(published.statusCode).toBe(200);
    expect(published.json()).toEqual({ id: formId, version: 1 });

    const fetched = await app.inject({
      method: "GET",
      url: `/api/forms/${formId}`
    });
    expect(fetched.statusCode).toBe(200);
    const body = fetched.json();
    expect(body.title).toBe("Integration form");
    expect(body.version).toBe(1);
    expect(body.questions).toHaveLength(1);
    expect(body.questions[0].options).toEqual(["Yes", "No"]);
  });

  it("bumps the version on each publish", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/forms",
      payload: sampleDefinition()
    });
    const formId = created.json().id;

    await app.inject({ method: "POST", url: `/api/forms/${formId}/publish`, payload: {} });
    const second = await app.inject({
      method: "POST",
      url: `/api/forms/${formId}/publish`,
      payload: {}
    });
    expect(second.json().version).toBe(2);
  });

  it("rejects submissions pinned to an unknown form version", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/forms",
      payload: sampleDefinition()
    });
    const formId = created.json().id;

    const result = await app.inject({
      method: "POST",
      url: "/api/responses",
      payload: {
        id: randomUUID(),
        formId,
        formVersion: 42,
        answers: { [QUESTION_ID]: "Yes" }
      }
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ status: "rejected", reason: "unknown_form_version" });
  });

  it("accepts a valid response exactly once", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/forms",
      payload: sampleDefinition()
    });
    const formId = created.json().id;
    await app.inject({ method: "POST", url: `/api/forms/${formId}/publish`, payload: {} });

    const submission = {
      id: randomUUID(),
      formId,
      formVersion: 1,
      answers: { [QUESTION_ID]: "Yes" }
    };

    const first = await app.inject({ method: "POST", url: "/api/responses", payload: submission });
    expect(first.json()).toEqual({ status: "accepted" });

    const retry = await app.inject({ method: "POST", url: "/api/responses", payload: submission });
    expect(retry.json()).toEqual({ status: "duplicate" });

    const rows = await db.select().from(responses).where(eq(responses.formId, formId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.answers).toEqual(submission.answers);
  });

  it("rejects off-menu answers with issue details", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/forms",
      payload: sampleDefinition()
    });
    const formId = created.json().id;
    await app.inject({ method: "POST", url: `/api/forms/${formId}/publish`, payload: {} });

    const result = await app.inject({
      method: "POST",
      url: "/api/responses",
      payload: {
        id: randomUUID(),
        formId,
        formVersion: 1,
        answers: { [QUESTION_ID]: "Maybe" }
      }
    });
    const body = result.json();
    expect(body.status).toBe("rejected");
    expect(body.reason).toBe("validation_failed");
    expect(body.issues[0].questionId).toBe(QUESTION_ID);
  });

  it("rejects malformed submission payloads with 400", async () => {
    const result = await app.inject({
      method: "POST",
      url: "/api/responses",
      payload: { nonsense: true }
    });
    expect(result.statusCode).toBe(400);
    expect(result.json().error).toBe("Invalid submission");
  });
});
