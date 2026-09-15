import pg from "pg";

const required = [
  "DATABASE_ADMIN_URL",
  "VIRTUAPET_MIGRATOR_PASSWORD",
  "VIRTUAPET_APP_PASSWORD"
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const database = process.env.VIRTUAPET_DATABASE ?? "virtuapet";
const migratorRole = process.env.VIRTUAPET_MIGRATOR_ROLE ?? "virtuapet_migrator";
const appRole = process.env.VIRTUAPET_APP_ROLE ?? "virtuapet_app";

for (const [label, value] of Object.entries({ database, migratorRole, appRole })) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error(`${label} must be a safe lowercase PostgreSQL identifier`);
  }
}

const quoteIdentifier = value => `"${value.replaceAll('"', '""')}"`;

async function formattedSql(client, format, ...values) {
  const result = await client.query("SELECT format($1, VARIADIC $2::text[]) AS sql", [format, values]);
  return result.rows[0].sql;
}

const adminUrl = new URL(process.env.DATABASE_ADMIN_URL);
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();

try {
  for (const [role, password] of [
    [migratorRole, process.env.VIRTUAPET_MIGRATOR_PASSWORD],
    [appRole, process.env.VIRTUAPET_APP_PASSWORD]
  ]) {
    const exists = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role]);
    const command = exists.rowCount
      ? await formattedSql(admin, "ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION", role, password)
      : await formattedSql(admin, "CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION", role, password);
    await admin.query(command);
  }

  const databaseExists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
  if (!databaseExists.rowCount) {
    await admin.query(await formattedSql(admin, "CREATE DATABASE %I", database));
  }
} finally {
  await admin.end();
}

adminUrl.pathname = `/${database}`;
const target = new pg.Client({ connectionString: adminUrl.toString() });
await target.connect();

try {
  const databaseId = quoteIdentifier(database);
  const migratorId = quoteIdentifier(migratorRole);
  const appId = quoteIdentifier(appRole);

  await target.query(`REVOKE ALL ON DATABASE ${databaseId} FROM PUBLIC`);
  await target.query(`GRANT CONNECT ON DATABASE ${databaseId} TO ${migratorId}, ${appId}`);
  await target.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
  await target.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${migratorId}`);
  await target.query(`GRANT USAGE ON SCHEMA public TO ${appId}`);
  await target.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${migratorId} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${appId}`);
  await target.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${migratorId} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${appId}`);
} finally {
  await target.end();
}

console.log(`PostgreSQL database and least-privilege roles are ready for ${database}`);
