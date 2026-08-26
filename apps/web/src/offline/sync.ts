import { db } from "./db";

let draining = false;

export async function drainOutbox(): Promise<void> {
  if (draining || !navigator.onLine) return;
  draining = true;

  try {
    const entries = await db.outbox.orderBy("createdAt").toArray();
    if (entries.length === 0) return;

    const payload = entries.map((entry) => ({
      id: entry.id,
      formId: entry.formId,
      formVersion: entry.formVersion,
      answers: entry.answers,
      submittedAt: entry.submittedAt
    }));

    const response = await fetch("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses: payload })
    });

    if (!response.ok) return;

    const body = (await response.json()) as {
      results: { index: number; status: string }[];
    };

    const syncedIds = new Set<string>();
    for (const result of body.results) {
      if (result.status === "accepted" || result.status === "duplicate") {
        syncedIds.add(entries[result.index].id);
      }
    }

    if (syncedIds.size > 0) {
      await db.outbox.bulkDelete([...syncedIds]);
    }
  } finally {
    draining = false;
  }
}

export function startSyncListener(): void {
  window.addEventListener("online", () => {
    void drainOutbox();
  });

  setInterval(() => {
    if (navigator.onLine) {
      void drainOutbox();
    }
  }, 5_000);
}

export function getOutboxCount(): Promise<number> {
  return db.outbox.count();
}
