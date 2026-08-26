import { buildApp } from "./app";
import { createDb } from "./db/client";
import { runMigrations } from "./db/migrator";

const port = Number(process.env.PORT ?? 3000);

async function start(): Promise<void> {
  const url = process.env.DATABASE_URL;
  const dbHandle = url ? createDb(url) : undefined;

  if (dbHandle) {
    await runMigrations(dbHandle.db);
  }

  const app = buildApp({ db: dbHandle?.db });
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

start();
