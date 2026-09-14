import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const dir = resolve("infra/migrations");
  const files = (await readdir(dir)).filter(f => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(resolve(dir, file), "utf8");
    await client.query(sql);
    console.log(`Applied ${file}`);
  }
} finally {
  await client.end();
}
