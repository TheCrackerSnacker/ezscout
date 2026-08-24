import { createDb } from "../src/db/client";
import { runMigrations } from "../src/db/migrator";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const { db, pool } = createDb(url);

try {
  await runMigrations(db);
  console.log("Migrations complete");
} catch (error) {
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
