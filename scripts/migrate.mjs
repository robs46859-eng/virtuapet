import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const sql = await readFile(resolve("infra/migrations/001_phase2_foundation.sql"), "utf8");
  await client.query(sql);
  console.log("Applied VirtuaPet Phase 2 foundation migration");
} finally {
  await client.end();
}
