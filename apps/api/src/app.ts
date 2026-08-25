import Fastify, { type FastifyInstance } from "fastify";
import { and, eq, or, type SQL } from "drizzle-orm";
import {
  FormDefinitionSchema,
  SubmissionBatchEnvelopeSchema,
  SubmissionSchema,
  validateAnswers,
  type BatchResultItem,
  type Submission
} from "@ezscout/shared";
import { createDb, type Db } from "./db/client";
import { forms, formVersions, responses } from "./db/schema";

interface QueuedItem {
  index: number;
  submission: Submission;
}

const resolveSubmittedAt = (submission: Submission): Date => {
  if (!submission.submittedAt) return new Date();
  const clientTime = new Date(submission.submittedAt);
  return Number.isNaN(clientTime.getTime()) ? new Date() : clientTime;
};

async function processSubmissions(
  handle: Db,
  queued: QueuedItem[]
): Promise<BatchResultItem[]> {
  const outcomes = new Map<number, BatchResultItem>();
  if (queued.length === 0) return [];

  const conds: SQL[] = [];
  const condByKey = new Map<string, SQL>();
  for (const { submission } of queued) {
    const key = `${submission.formId}|${submission.formVersion}`;
    if (!condByKey.has(key)) {
      const cond = and(
        eq(formVersions.formId, submission.formId),
        eq(formVersions.version, submission.formVersion)
      )!;
      condByKey.set(key, cond);
      conds.push(cond);
    }
  }

  const snapshots = await handle
    .select({
      formId: formVersions.formId,
      version: formVersions.version,
      definition: formVersions.definition
    })
    .from(formVersions)
    .where(or(...conds));

  const definitions = new Map(
    snapshots.map((row) => [`${row.formId}|${row.version}`, row.definition])
  );

  const insertable: { item: QueuedItem; submittedAt: Date }[] = [];
  for (const item of queued) {
    const { submission } = item;
    const rawDefinition = definitions.get(
      `${submission.formId}|${submission.formVersion}`
    );

    if (!rawDefinition) {
      outcomes.set(item.index, {
        index: item.index,
        id: submission.id,
        status: "rejected",
        reason: "unknown_form_version"
      });
      continue;
    }

    const parsedDefinition = FormDefinitionSchema.safeParse(rawDefinition);
    if (!parsedDefinition.success) {
      outcomes.set(item.index, {
        index: item.index,
        id: submission.id,
        status: "rejected",
        reason: "invalid_form_definition"
      });
      continue;
    }

    const check = validateAnswers(parsedDefinition.data, submission.answers);
    if (!check.ok) {
      outcomes.set(item.index, {
        index: item.index,
        id: submission.id,
        status: "rejected",
        reason: "validation_failed",
        issues: check.issues
      });
      continue;
    }

    insertable.push({ item, submittedAt: resolveSubmittedAt(submission) });
  }

  const candidates = new Map<string, { item: QueuedItem; submittedAt: Date }>();
  for (const entry of insertable) {
    if (candidates.has(entry.item.submission.id)) {
      outcomes.set(entry.item.index, {
        index: entry.item.index,
        id: entry.item.submission.id,
        status: "duplicate"
      });
      continue;
    }
    candidates.set(entry.item.submission.id, entry);
  }

  const unique = [...candidates.values()];
  if (unique.length > 0) {
    const insertedRows = await handle
      .insert(responses)
      .values(
        unique.map(({ item, submittedAt }) => ({
          id: item.submission.id,
          formId: item.submission.formId,
          formVersion: item.submission.formVersion,
          answers: item.submission.answers,
          submittedAt
        }))
      )
      .onConflictDoNothing({ target: responses.id })
      .returning({ id: responses.id });

    const insertedIds = new Set(insertedRows.map((row) => row.id));
    for (const { item } of unique) {
      outcomes.set(item.index, {
        index: item.index,
        id: item.submission.id,
        status: insertedIds.has(item.submission.id) ? "accepted" : "duplicate"
      });
    }
  }

  return [...outcomes.values()].sort((a, b) => a.index - b.index);
}

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

    const envelope = SubmissionBatchEnvelopeSchema.safeParse(request.body);
    if (!envelope.success) {
      return reply.status(400).send({
        error: "Invalid submission batch",
        issues: envelope.error.issues
      });
    }

    const queued: QueuedItem[] = [];
    const rejectedItems: BatchResultItem[] = [];
    envelope.data.responses.forEach((raw, index) => {
      const parsed = SubmissionSchema.safeParse(raw);
      if (parsed.success) {
        queued.push({ index, submission: parsed.data });
        return;
      }
      const rawId = (raw as { id?: unknown }).id;
      rejectedItems.push({
        index,
        ...(typeof rawId === "string" ? { id: rawId } : {}),
        status: "rejected",
        reason: "invalid_payload",
        issues: parsed.error.issues.map((issue) => ({
          questionId: issue.path.map(String).join(".") || "body",
          message: issue.message
        }))
      });
    });

    const processed = await processSubmissions(handle, queued);
    return {
      results: [...rejectedItems, ...processed].sort(
        (a, b) => a.index - b.index
      )
    };
  });

  return app;
}
