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
}

class EzScoutDB extends Dexie {
  forms!: Table<CachedForm>;
  outbox!: Table<OutboxEntry>;

  constructor() {
    super("ezscout");
    this.version(1).stores({
      forms: "id",
      outbox: "id, createdAt"
    });
  }
}

export const db = new EzScoutDB();
