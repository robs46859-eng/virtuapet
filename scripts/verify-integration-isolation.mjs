import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { withIntegrationTransaction } from "../apps/api/dist/integrations/transaction.js";

// This verifier is intentionally restricted to a disposable local test database.
// It never uses DATABASE_URL and cannot target the configured Azure database.
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required for the disposable local isolation test");
let target;
try { target = new URL(connectionString); } catch { throw new Error("Invalid test database URL"); }
if (!["postgres:", "postgresql:"].includes(target.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    !/^\/[a-zA-Z0-9_]+_test$/.test(target.pathname) || target.search) {
  throw new Error("Isolation verifier requires a loopback PostgreSQL URL, a database ending in _test, and no URL options");
}

const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
const runtimeRole = `vp_isolation_${randomUUID().replaceAll("-", "")}`;
const quoteIdentifier = value => `"${value.replaceAll('"', '""')}"`;
const roleSql = quoteIdentifier(runtimeRole);
const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const contextA = { tenantId: tenantA, userId: userA, roles: ["vet_staff"], correlationId: randomUUID() };
const contextB = { tenantId: tenantB, userId: userB, roles: ["vet_staff"], correlationId: randomUUID() };
let createdRole = false;
let checks = 0;
const check = name => { checks += 1; console.log(`PASS ${name}`); };
const markers = async client => (await client.query("SELECT marker FROM pg_temp.integration_isolation ORDER BY marker")).rows.map(row => row.marker);
const databaseDenial = error => error?.code === "42501";

try {
  const setup = await pool.connect();
  try {
    const identity = await setup.query("SELECT rolsuper FROM pg_roles WHERE rolname = current_user");
    assert.equal(identity.rows[0]?.rolsuper, true, "Use the disposable local cluster administrator for test fixture setup");
    await setup.query(`CREATE ROLE ${roleSql} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    createdRole = true;
    await setup.query(`CREATE TEMP TABLE integration_isolation (
      id uuid PRIMARY KEY, tenant_id uuid NOT NULL, user_id uuid NOT NULL, marker text NOT NULL
    ) ON COMMIT PRESERVE ROWS`);
    await setup.query("INSERT INTO pg_temp.integration_isolation VALUES ($1,$2,$3,'tenant-a'),($4,$5,$6,'tenant-b')",
      [randomUUID(), tenantA, userA, randomUUID(), tenantB, userB]);
    await setup.query("ALTER TABLE pg_temp.integration_isolation ENABLE ROW LEVEL SECURITY");
    await setup.query("ALTER TABLE pg_temp.integration_isolation FORCE ROW LEVEL SECURITY");
    await setup.query(`CREATE POLICY integration_identity ON pg_temp.integration_isolation
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
        AND user_id = nullif(current_setting('app.user_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
        AND user_id = nullif(current_setting('app.user_id', true), '')::uuid)`);
    const schema = (await setup.query("SELECT nspname FROM pg_namespace WHERE oid = pg_my_temp_schema()")).rows[0].nspname;
    await setup.query(`GRANT USAGE ON SCHEMA ${quoteIdentifier(schema)} TO ${roleSql}`);
    await setup.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON pg_temp.integration_isolation TO ${roleSql}`);
    await setup.query(`SET ROLE ${roleSql}`);
  } finally {
    setup.release();
  }

  const policy = await pool.query(`SELECT r.rolsuper, r.rolbypassrls, c.relrowsecurity,
      c.relforcerowsecurity, c.relowner = r.oid AS owns_table
    FROM pg_roles r CROSS JOIN pg_class c
    WHERE r.rolname = current_user AND c.oid = 'pg_temp.integration_isolation'::regclass`);
  assert.deepEqual(policy.rows[0], {
    rolsuper: false, rolbypassrls: false, relrowsecurity: true, relforcerowsecurity: true, owns_table: false
  });
  check("forced RLS exercised as a non-owner without superuser or BYPASSRLS");

  assert.deepEqual(await markers(pool), []);
  // pg.Pool.query discards its connection on query errors. Keep an explicitly
  // checked-out client for this expected denial so the session fixture survives.
  const noContext = await pool.connect();
  try {
    await assert.rejects(noContext.query("INSERT INTO pg_temp.integration_isolation VALUES ($1,$2,$3,'missing-context')",
      [randomUUID(), tenantA, userA]), databaseDenial);
  } finally {
    noContext.release();
  }
  check("missing context hides rows and denies inserts");

  const pidA = await withIntegrationTransaction(pool, contextA, async client => {
    assert.deepEqual(await markers(client), ["tenant-a"]);
    const result = await client.query("SELECT pg_backend_pid() AS pid, current_setting('app.correlation_id') AS correlation");
    assert.equal(result.rows[0].correlation, contextA.correlationId);
    return result.rows[0].pid;
  });
  check("tenant A sees only its own row with transaction correlation");
  const pidB = await withIntegrationTransaction(pool, contextB, async client => {
    assert.deepEqual(await markers(client), ["tenant-b"]);
    return (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  });
  assert.equal(pidA, pidB, "Both tenants must exercise one reused physical database connection");
  check("tenant B sees only its row on the same reused connection");

  await withIntegrationTransaction(pool, { ...contextA, userId: userB }, async client => {
    assert.deepEqual(await markers(client), []);
  });
  check("mismatched user identity hides same-tenant records");

  assert.deepEqual(await markers(pool), []);
  const cleared = (await pool.query(`SELECT
    nullif(current_setting('app.tenant_id', true), '') AS tenant,
    nullif(current_setting('app.user_id', true), '') AS actor,
    nullif(current_setting('app.correlation_id', true), '') AS correlation`)).rows[0];
  assert.deepEqual(cleared, { tenant: null, actor: null, correlation: null });
  check("committed transactions leave no tenant, user, or correlation context");

  await assert.rejects(withIntegrationTransaction(pool, contextA, client =>
    client.query("INSERT INTO pg_temp.integration_isolation VALUES ($1,$2,$3,'forged-tenant')",
      [randomUUID(), tenantB, userB])), databaseDenial);
  await assert.rejects(withIntegrationTransaction(pool, contextA, client =>
    client.query("UPDATE pg_temp.integration_isolation SET tenant_id=$1 WHERE marker='tenant-a'", [tenantB])), databaseDenial);
  await withIntegrationTransaction(pool, contextA, async client => {
    assert.equal((await client.query("DELETE FROM pg_temp.integration_isolation WHERE tenant_id=$1", [tenantB])).rowCount, 0);
  });
  check("cross-tenant insert, ownership change, and delete are blocked");

  await withIntegrationTransaction(pool, contextA, async client => {
    await client.query("INSERT INTO pg_temp.integration_isolation VALUES ($1,$2,$3,'allowed-write')", [randomUUID(), tenantA, userA]);
  });
  await withIntegrationTransaction(pool, contextA, async client => {
    assert.deepEqual(await markers(client), ["allowed-write", "tenant-a"]);
  });
  check("authorized writes persist across transactions");

  const controlledFailure = new Error("controlled rollback");
  await assert.rejects(withIntegrationTransaction(pool, contextA, async client => {
    await client.query("INSERT INTO pg_temp.integration_isolation VALUES ($1,$2,$3,'rolled-back')", [randomUUID(), tenantA, userA]);
    throw controlledFailure;
  }), error => error === controlledFailure);
  assert.deepEqual(await markers(pool), []);
  await withIntegrationTransaction(pool, contextA, async client => {
    assert.deepEqual(await markers(client), ["allowed-write", "tenant-a"]);
  });
  await withIntegrationTransaction(pool, contextB, async client => {
    assert.deepEqual(await markers(client), ["tenant-b"]);
  });
  check("callback rollback removes its write and context; reused connection remains isolated");

  console.log(`PostgreSQL integration isolation: ${checks} checks passed (temporary fixture only)`);
} finally {
  try {
    await pool.query("ROLLBACK");
    await pool.query("RESET ROLE");
    await pool.query("DROP TABLE IF EXISTS pg_temp.integration_isolation");
    if (createdRole) {
      // Remove the fixture role's temporary-schema privilege before dropping it.
      await pool.query(`DROP OWNED BY ${roleSql}`);
      await pool.query(`DROP ROLE ${roleSql}`);
    }
  } finally {
    await pool.end();
  }
}
