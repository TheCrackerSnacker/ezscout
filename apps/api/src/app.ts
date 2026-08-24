import Fastify, { type FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import {
  FormDefinitionSchema,
  validateAnswers
} from "@ezscout/shared";
import { createDb, type Db } from "./db/client";
import { forms, formVersions, responses } from "./db/schema";
import { SubmissionSchema } from "./submissions/schema";

export interface BuildAppOptions {
  db?: Db;
}

function defaultDb(): Db | null {
  const url = process.env.DATABASE_URL;
  return url ? createDb(url).db : null;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const db = options.db ?? defaultDb();

  const requireDb = (reply: { status: (code: number) => { send: (body: unknown) => unknown } }) => {
    if (db) return db;
    reply.status(503).send({ error: "Database not configured" });
    return null;
  };

  app.get("/api/health", async () => ({ status: "ok" }));

  app.post("/api/forms", async (request, reply) => {
    const handle = requireDb(reply);
    if (!handle) return;

    const parsed = FormDefinitionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid form definition",
        issues: parsed.error.issues
      });
    }

    const [row] = await handle
      .insert(forms)
      .values({ title: parsed.data.title, definition: parsed.data })
      .returning({ id: forms.id });

    return reply.status(201).send({ id: row!.id });
  });

  app.post("/api/forms/:id/publish", async (request, reply) => {
    const handle = requireDb(reply);
    if (!handle) return;

    const { id } = request.params as { id: string };
    const [form] = await handle.select().from(forms).where(eq(forms.id, id));

    if (!form) {
      return reply.status(404).send({ error: "Form not found" });
    }

    const existing = await handle
      .select({ version: formVersions.version })
      .from(formVersions)
      .where(eq(formVersions.formId, id));
    const nextVersion =
      existing.reduce((max, row) => Math.max(max, row.version), 0) + 1;

    await handle.transaction(async (tx) => {
      await tx.insert(formVersions).values({
        formId: form.id,
        version: nextVersion,
        definition: form.definition
      });
      await tx
        .update(forms)
        .set({ publishedVersion: nextVersion, updatedAt: new Date() })
        .where(eq(forms.id, form.id));
    });

    return { id: form.id, version: nextVersion };
  });

  app.get("/api/forms/:id", async (request, reply) => {
    const handle = requireDb(reply);
    if (!handle) return;

    const { id } = request.params as { id: string };
    const [row] = await handle
      .select({ snapshotVersion: formVersions.version, definition: formVersions.definition })
      .from(forms)
      .innerJoin(
        formVersions,
        and(
          eq(formVersions.formId, forms.id),
          eq(formVersions.version, forms.publishedVersion!)
        )
      )
      .where(eq(forms.id, id));

    if (!row) {
      return reply.status(404).send({ error: "Form not found or not published" });
    }

    const parsed = FormDefinitionSchema.safeParse(row.definition);
    if (!parsed.success) {
      return reply.status(500).send({ error: "Stored form definition is invalid" });
    }

    return {
      id,
      title: parsed.data.title,
      description: parsed.data.description,
      version: row.snapshotVersion,
      questions: parsed.data.questions
    };
  });

  app.post("/api/responses", async (request, reply) => {
    const handle = requireDb(reply);
    if (!handle) return;

    const parsedBody = SubmissionSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid submission",
        issues: parsedBody.error.issues
      });
    }
    const submission = parsedBody.data;

    const [snapshot] = await handle
      .select({ definition: formVersions.definition })
      .from(formVersions)
      .where(
        and(
          eq(formVersions.formId, submission.formId),
          eq(formVersions.version, submission.formVersion)
        )
      );

    if (!snapshot) {
      return { status: "rejected", reason: "unknown_form_version" };
    }

    const parsedDefinition = FormDefinitionSchema.safeParse(snapshot.definition);
    if (!parsedDefinition.success) {
      return { status: "rejected", reason: "invalid_form_definition" };
    }

    const result = validateAnswers(parsedDefinition.data, submission.answers);
    if (!result.ok) {
      return { status: "rejected", reason: "validation_failed", issues: result.issues };
    }

    let submittedAt = new Date();
    if (submission.submittedAt) {
      const clientTime = new Date(submission.submittedAt);
      if (!Number.isNaN(clientTime.getTime())) {
        submittedAt = clientTime;
      }
    }

    const inserted = await handle
      .insert(responses)
      .values({
        id: submission.id,
        formId: submission.formId,
        formVersion: submission.formVersion,
        answers: submission.answers,
        submittedAt
      })
      .onConflictDoNothing({ target: responses.id })
      .returning({ id: responses.id });

    if (inserted.length === 0) {
      return { status: "duplicate" };
    }

    return { status: "accepted" };
  });

  return app;
}
