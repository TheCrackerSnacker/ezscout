import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DroppedEntry, OutboxEntry } from "../src/offline/db";

type SyncModule = typeof import("../src/offline/sync");
type DbModule = typeof import("../src/offline/db");

const MAX_RETRIES = 10;
const TTL_MS = 6 * 60 * 60 * 1_000;

interface FakeOutbox {
  entries: OutboxEntry[];
  orderBy(key: string): { toArray(): Promise<OutboxEntry[]> };
  bulkAdd(entries: OutboxEntry[]): Promise<void>;
  bulkDelete(ids: string[]): Promise<void>;
  bulkPut(entries: OutboxEntry[]): Promise<void>;
  count(): Promise<number>;
}

interface FakeDropped {
  entries: DroppedEntry[];
  bulkAdd(entries: DroppedEntry[]): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

function makeEntry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id: "entry-" + Math.random().toString(36).slice(2),
    formId: "0198f7a2-7b3c-7000-8000-000000000001",
    formVersion: 1,
    answers: { q1: "yes" },
    submittedAt: new Date().toISOString(),
    createdAt: Date.now(),
    retryCount: 0,
    lastAttemptAt: 0,
    ...overrides
  };
}

function createFakeDb(): DbModule["db"] {
  const entries: OutboxEntry[] = [];
  const droppedStore: DroppedEntry[] = [];
  const outbox: FakeOutbox = {
    entries,
    orderBy(key: string) {
      const rows = [...entries].sort((a, b) => {
        const av = (a as unknown as Record<string, number>)[key] ?? 0;
        const bv = (b as unknown as Record<string, number>)[key] ?? 0;
        return av - bv;
      });
      return { toArray: async () => rows };
    },
    async bulkAdd(items: OutboxEntry[]) {
      entries.push(...items);
    },
    async bulkDelete(ids: string[]) {
      for (let i = entries.length - 1; i >= 0; i--) {
        if (ids.includes(entries[i]!.id)) entries.splice(i, 1);
      }
    },
    async bulkPut(items: OutboxEntry[]) {
      for (const item of items) {
        const index = entries.findIndex((e) => e.id === item.id);
        if (index >= 0) entries[index] = item;
        else entries.push(item);
      }
    },
    async count() {
      return entries.length;
    }
  };
  const dropped: FakeDropped = {
    entries: droppedStore,
    async bulkAdd(items: DroppedEntry[]) {
      droppedStore.push(...items);
    },
    async count() {
      return droppedStore.length;
    },
    async clear() {
      droppedStore.length = 0;
    }
  };
  return {
    outbox: outbox as unknown as DbModule["db"]["outbox"],
    dropped: dropped as unknown as DbModule["db"]["dropped"],
    forms: {
      put: vi.fn(),
      get: vi.fn()
    } as unknown as DbModule["db"]["forms"]
  } as unknown as DbModule["db"];
}

let sync: SyncModule;
let db: DbModule["db"];
let outbox: FakeOutbox;
let dropped: FakeDropped;
let fetchMock: ReturnType<typeof vi.fn>;
let online: boolean;

function setOnline(value: boolean): void {
  online = value;
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online
  });
}

describe("offline sync", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("../src/offline/db", () => ({ db: createFakeDb() }));
    db = (await import("../src/offline/db")).db;
    outbox = (db.outbox as unknown as FakeOutbox);
    dropped = (db.dropped as unknown as FakeDropped);
    sync = await import("../src/offline/sync");
    setOnline(true);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("is a no-op while offline", async () => {
    setOnline(false);
    await outbox.bulkAdd([makeEntry()]);

    await sync.drainOutbox();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await outbox.count()).toBe(1);
  });

  it("skips a drain that is already in flight", async () => {
    await outbox.bulkAdd([makeEntry()]);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 })
    );

    await Promise.all([sync.drainOutbox(), sync.drainOutbox()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("respects the backoff window after a failed attempt", async () => {
    await outbox.bulkAdd([makeEntry()]);
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));

    await sync.drainOutbox();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await sync.drainOutbox();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("archives entries older than the six-hour TTL as expired", async () => {
    const entry = makeEntry({ createdAt: Date.now() - TTL_MS - 1_000 });
    await outbox.bulkAdd([entry]);

    await sync.drainOutbox();

    expect(await outbox.count()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dropped.entries).toHaveLength(1);
    expect(dropped.entries[0]).toMatchObject({
      id: entry.id,
      formId: entry.formId,
      formVersion: entry.formVersion,
      answers: entry.answers,
      submittedAt: entry.submittedAt,
      reason: "expired"
    });
  });

  it("posts fresh entries and removes accepted ones", async () => {
    const entry = makeEntry();
    await outbox.bulkAdd([entry]);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ results: [{ index: 0, status: "accepted" }] }),
        { status: 200 }
      )
    );

    await sync.drainOutbox();

    expect(await outbox.count()).toBe(0);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/responses");
    const body = JSON.parse(String(init.body)) as {
      responses: Array<{ id: string }>;
    };
    expect(body.responses).toHaveLength(1);
    expect(body.responses[0]!.id).toBe(entry.id);
  });

  it("treats duplicate results as handled", async () => {
    await outbox.bulkAdd([makeEntry()]);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ index: 0, status: "duplicate" }]
        }),
        { status: 200 }
      )
    );

    await sync.drainOutbox();

    expect(await outbox.count()).toBe(0);
  });

  it("removes entries rejected with terminal reasons", async () => {
    for (const reason of [
      "invalid_payload",
      "unknown_form_version",
      "validation_failed"
    ] as const) {
      const entry = makeEntry();
      await outbox.bulkAdd([entry]);
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [{ index: 0, status: "rejected", reason }]
          }),
          { status: 200 }
        )
      );

      await sync.drainOutbox();

      expect(await outbox.count()).toBe(0);
    }
  });

  it("retries non-terminal rejections and records a backoff", async () => {
    const entry = makeEntry();
    await outbox.bulkAdd([entry]);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ index: 0, status: "rejected", reason: "server_error" }]
        }),
        { status: 200 }
      )
    );

    await sync.drainOutbox();

    const [kept] = outbox.entries;
    expect(kept).toBeDefined();
    expect(kept?.retryCount).toBe(1);
    expect(kept?.lastAttemptAt).toBeGreaterThan(0);

    await sync.drainOutbox();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("archives an entry once it exceeds the max retry count", async () => {
    const entry = makeEntry({ retryCount: MAX_RETRIES });
    await outbox.bulkAdd([entry]);
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));

    await sync.drainOutbox();

    expect(await outbox.count()).toBe(0);
    expect(dropped.entries).toHaveLength(1);
    expect(dropped.entries[0]).toMatchObject({
      id: entry.id,
      reason: "max_retries"
    });
    expect(dropped.entries[0]!.droppedAt).toBeGreaterThan(0);
  });

  it("increments the retry counter on network failures", async () => {
    const entry = makeEntry();
    await outbox.bulkAdd([entry]);
    fetchMock.mockRejectedValue(new TypeError("network down"));

    await sync.drainOutbox();

    const [kept] = outbox.entries;
    expect(kept?.retryCount).toBe(1);
    expect(await outbox.count()).toBe(1);
  });

  it("reports the number of queued entries", async () => {
    await outbox.bulkAdd([makeEntry(), makeEntry()]);

    expect(await sync.getOutboxCount()).toBe(2);
  });

  it("reports and clears the number of archived entries", async () => {
    await outbox.bulkAdd([makeEntry({ retryCount: MAX_RETRIES })]);
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));

    await sync.drainOutbox();

    expect(await sync.getDroppedCount()).toBe(1);

    await sync.clearDropped();

    expect(await sync.getDroppedCount()).toBe(0);
    expect(await outbox.count()).toBe(0);
  });
});