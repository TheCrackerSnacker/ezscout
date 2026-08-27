import { db, type DroppedEntry, type OutboxEntry } from "./db";

const MAX_RETRIES = 10;
const BASE_INTERVAL_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;
const TTL_MS = 6 * 60 * 60 * 1_000;

const TERMINAL_REJECTED = new Set([
  "invalid_payload",
  "unknown_form_version",
  "validation_failed"
]);

let draining = false;
let nextAttemptAt = 0;

function computeBackoff(retryCount: number): number {
  return Math.min(BASE_INTERVAL_MS * 2 ** retryCount, MAX_BACKOFF_MS);
}

export async function drainOutbox(): Promise<void> {
  if (draining || !navigator.onLine) return;
  if (Date.now() < nextAttemptAt) return;
  draining = true;

  try {
    const entries = await db.outbox.orderBy("createdAt").toArray();
    if (entries.length === 0) return;

    const now = Date.now();
    const stale = entries.filter((e) => now - e.createdAt > TTL_MS);
    if (stale.length > 0) {
      await archiveDropped(stale, "expired");
      await db.outbox.bulkDelete(stale.map((e) => e.id));
    }

    const fresh = entries.filter((e) => now - e.createdAt <= TTL_MS);
    if (fresh.length === 0) return;

    const payload = fresh.map((entry) => ({
      id: entry.id,
      formId: entry.formId,
      formVersion: entry.formVersion,
      answers: entry.answers,
      submittedAt: entry.submittedAt
    }));

    let response: Response;
    try {
      response = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: payload })
      });
    } catch {
      await incrementRetries(fresh);
      return;
    }

    if (!response.ok) {
      await incrementRetries(fresh);
      return;
    }

    const body = (await response.json()) as {
      results: { index: number; status: string; reason?: string }[];
    };

    const toRemove: string[] = [];
    const toRetry: string[] = [];

    for (const result of body.results) {
      const entry = fresh[result.index];
      if (!entry) continue;

      if (result.status === "accepted" || result.status === "duplicate") {
        toRemove.push(entry.id);
      } else if (
        result.status === "rejected" &&
        result.reason &&
        TERMINAL_REJECTED.has(result.reason)
      ) {
        toRemove.push(entry.id);
      } else {
        toRetry.push(entry.id);
      }
    }

    if (toRemove.length > 0) {
      await db.outbox.bulkDelete(toRemove);
    }

    if (toRetry.length > 0) {
      const retryEntries = fresh.filter((e) => toRetry.includes(e.id));
      await incrementRetries(retryEntries);
    } else {
      nextAttemptAt = 0;
    }
  } finally {
    draining = false;
  }
}

async function incrementRetries(entries: OutboxEntry[]) {
  const now = Date.now();
  const maxRetries: OutboxEntry[] = [];
  const updates: { id: string; retryCount: number; lastAttemptAt: number }[] =
    [];

  for (const entry of entries) {
    const next = entry.retryCount + 1;
    if (next > MAX_RETRIES) {
      maxRetries.push(entry);
    } else {
      updates.push({ id: entry.id, retryCount: next, lastAttemptAt: now });
    }
  }

  if (updates.length > 0) {
    await db.outbox.bulkPut(
      updates.map((u) => ({ ...u } as Parameters<typeof db.outbox.put>[0])),
      ["id"]
    );
  }

  if (maxRetries.length > 0) {
    console.warn(
      `[ezscout] Archiving ${maxRetries.length} outbox entries after ${MAX_RETRIES} failed retries`
    );
    await archiveDropped(maxRetries, "max_retries");
    await db.outbox.bulkDelete(maxRetries.map((e) => e.id));
  }

  const worstRetry = Math.max(0, ...updates.map((u) => u.retryCount));
  nextAttemptAt = now + computeBackoff(worstRetry);
}

async function archiveDropped(
  entries: OutboxEntry[],
  reason: DroppedEntry["reason"]
): Promise<void> {
  const droppedAt = Date.now();
  const archived: DroppedEntry[] = entries.map((entry) => ({
    id: entry.id,
    formId: entry.formId,
    formVersion: entry.formVersion,
    answers: entry.answers,
    submittedAt: entry.submittedAt,
    droppedAt,
    reason
  }));
  await db.dropped.bulkAdd(archived);
}

export function startSyncListener(): void {
  window.addEventListener("online", () => {
    nextAttemptAt = 0;
    void drainOutbox();
  });

  setInterval(() => {
    if (navigator.onLine) {
      void drainOutbox();
    }
  }, BASE_INTERVAL_MS);
}

export function getOutboxCount(): Promise<number> {
  return db.outbox.count();
}

export function getDroppedCount(): Promise<number> {
  return db.dropped.count();
}

export function clearDropped(): Promise<void> {
  return db.dropped.clear();
}
