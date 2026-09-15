import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(hashtext('virtuapet_schema_migrations'))");
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name text PRIMARY KEY,
      sha256 text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const dir = resolve("infra/migrations");
  const files = (await readdir(dir)).filter(f => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(resolve(dir, file), "utf8");
    const sha256 = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "SELECT sha256 FROM schema_migrations WHERE migration_name = $1",
      [file]
    );
    if (existing.rowCount) {
      if (existing.rows[0].sha256 !== sha256) {
        throw new Error(`Applied migration checksum mismatch: ${file}`);
      }
      console.log(`Already applied ${file}`);
      continue;
    }
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (migration_name, sha256) VALUES ($1, $2)",
      [file, sha256]
    );
    console.log(`Applied ${file}`);
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(hashtext('virtuapet_schema_migrations'))").catch(() => {});
  await client.end();
}
