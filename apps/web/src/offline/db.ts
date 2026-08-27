import Dexie, { type Table } from "dexie";
import type { PublicForm } from "@ezscout/shared";

export interface CachedForm {
  id: string;
  definition: PublicForm;
  fetchedAt: number;
}

export interface OutboxEntry {
  id: string;
  formId: string;
  formVersion: number;
  answers: Record<string, unknown>;
  submittedAt: string;
  createdAt: number;
  retryCount: number;
  lastAttemptAt: number;
}

export type DroppedReason = "max_retries" | "expired";

export interface DroppedEntry {
  id: string;
  formId: string;
  formVersion: number;
  answers: Record<string, unknown>;
  submittedAt: string;
  droppedAt: number;
  reason: DroppedReason;
}

class EzScoutDB extends Dexie {
  forms!: Table<CachedForm>;
  outbox!: Table<OutboxEntry>;
  dropped!: Table<DroppedEntry>;

  constructor() {
    super("ezscout");
    this.version(1).stores({
      forms: "id",
      outbox: "id, createdAt"
    });
    this.version(2).stores({
      forms: "id",
      outbox: "id, createdAt",
      dropped: "id, droppedAt"
    });
  }
}

export const db = new EzScoutDB();
