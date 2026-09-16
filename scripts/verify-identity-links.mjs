import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { createIdentityLinkService } from "../apps/api/dist/integrations/identity-links.js";
import { PostgreSQLIdentityLinkStore } from "../apps/api/dist/integrations/identity-link-store.js";
import { withIntegrationTransaction } from "../apps/api/dist/integrations/transaction.js";

// Deliberately independent of DATABASE_URL. Only an already-migrated disposable
// loopback *_test database and its local administrator are accepted.
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL is required for the disposable identity-link verifier");
let target;
try { target = new URL(connectionString); } catch { throw new Error("Invalid test database URL"); }
if (!["postgres:", "postgresql:"].includes(target.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    !/^\/[a-zA-Z0-9_]+_test$/.test(target.pathname) || target.search) {
  throw new Error("Identity-link verifier requires loopback PostgreSQL, a database ending in _test, and no URL options");
}

const tables = ["integration_identity_link_challenges", "integration_identity_links", "integration_identity_link_audit"];
const admin = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000 });
const rawRuntime = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 5000 });
const rawReuse = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
const runtimeRole = `vp_link_test_${randomUUID().replaceAll("-", "")}`;
const quote = value => `"${value.replaceAll('"', '""')}"`;
const roleSql = quote(runtimeRole);
// Each acquired physical connection becomes the restricted role, including a
// fresh connection after a failed query. No test executes runtime SQL as admin.
const asRuntime = pool => ({
  async connect() {
    const client = await pool.connect();
    try { await client.query(`SET ROLE ${roleSql}`); return client; }
    catch (error) { client.release(error); throw error; }
  }
});
const runtime = asRuntime(rawRuntime);
const reusedRuntime = asRuntime(rawReuse);
const store = new PostgreSQLIdentityLinkStore(runtime);
const tenantA = randomUUID();
const tenantB = randomUUID();
const tenants = [tenantA, tenantB];
const contextA = { tenantId: tenantA, userId: randomUUID(), roles: ["guardian"], correlationId: randomUUID() };
const contextB = { tenantId: tenantB, userId: randomUUID(), roles: ["guardian"], correlationId: randomUUID() };
const contextC = { ...contextA, userId: randomUUID(), correlationId: randomUUID() };
const contexts = [contextA, contextB, contextC];
const issuer = "https://identity-link-fixture.example.test";
const audience = "virtuapet-link-test";
const kid = "ephemeral-local-fixture";
const keys = await generateKeyPair("ES256");
const publicJwks = { keys: [{ ...await exportJWK(keys.publicKey), kid, alg: "ES256", use: "sig" }] };
const service = createIdentityLinkService({ enabled: true, store, issuer, audience, pinnedKid: kid, publicJwks,
  encryptionKeyBase64: randomBytes(32).toString("base64") });
assert.ok(service);
let createdRole = false;
let fixturesCreated = false;
let stage = "setup";
let checks = 0;
const check = name => { checks += 1; console.log(`PASS ${name}`); };
const denied = error => error?.code === "42501";
async function signedProof(context, challenge, seconds = 300) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ iss: issuer, aud: audience, sub: context.userId, iat: now, exp: now + seconds, jti: randomUUID(),
    protocol: "virtuapet.layer8.link.v1", tenantId: context.tenantId, challengeId: challenge.challengeId, nonce: challenge.nonce,
    providerSubject: `user_${context.userId}`, providerTenantId: `tenant_${context.tenantId}`, providerOrganizationId: `org_${context.tenantId}` })
    .setProtectedHeader({ alg: "ES256", typ: "vp-layer8-link+jwt", kid }).sign(keys.privateKey);
}
async function link(context) {
  const challenge = await service.createChallenge(context);
  const proofToken = await signedProof(context, challenge);
  const result = await service.complete(context, { challengeId: challenge.challengeId, proofToken, consent: true });
  return { challenge, proofToken, result };
}
async function adminScopeRows(table, context) {
  assert.ok(tables.includes(table));
  return (await admin.query(`SELECT * FROM ${quote(table)} WHERE tenant_id=$1 AND user_id=$2`, [context.tenantId, context.userId])).rows;
}

try {
  const identity = (await admin.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0];
  assert.equal(identity?.rolsuper, true, "Fixture setup requires the disposable local cluster administrator");
  for (const table of tables) {
    assert.equal((await admin.query("SELECT to_regclass($1) IS NOT NULL AS present", [`public.${table}`])).rows[0].present, true,
      "Apply migration 005 before running this verifier");
  }
  await admin.query(`CREATE ROLE ${roleSql} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
  createdRole = true;
  await admin.query(`GRANT USAGE ON SCHEMA public TO ${roleSql}`);
  await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${tables.map(quote).join(",")} TO ${roleSql}`);
  await admin.query("INSERT INTO organizations (organization_id,name,kind,created_at) VALUES ($1,'Identity test A','household',now()),($2,'Identity test B','household',now())", tenants);
  fixturesCreated = true;

  stage = "forced RLS privilege verification";
  const privileges = await runtime.connect();
  try {
    const result = await privileges.query(`SELECT c.relname,r.rolsuper,r.rolbypassrls,c.relrowsecurity,c.relforcerowsecurity,c.relowner=r.oid AS owns_table
      FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE r.rolname=current_user AND n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname`, [tables]);
    assert.equal(result.rowCount, 3);
    for (const row of result.rows) assert.deepEqual({ ...row, relname: undefined }, {
      relname: undefined, rolsuper: false, rolbypassrls: false, relrowsecurity: true, relforcerowsecurity: true, owns_table: false
    });
  } finally { privileges.release(); }
  check("all three migration tables force RLS for a real non-owner/non-bypass runtime role");

  stage = "signed completion and encrypted persistence";
  const linked = [];
  for (const context of contexts) linked.push(await link(context));
  for (const [index, context] of contexts.entries()) {
    const rows = await adminScopeRows("integration_identity_links", context);
    assert.equal(rows.length, 1);
    assert.match(rows[0].encrypted_proof, /^v1\./);
    assert.equal(JSON.stringify(rows).includes(linked[index].proofToken), false);
    const audit = await adminScopeRows("integration_identity_link_audit", context);
    assert.deepEqual(audit.map(row => row.event_type).sort(), ["challenge_created", "link_completed"]);
    assert.equal(JSON.stringify(audit).includes(linked[index].proofToken), false);
    assert.equal((await service.resolveProof(context))?.proofToken, linked[index].proofToken);
    assert.equal(JSON.stringify(await service.list(context)).includes("providerSubject"), false);
  }
  check("real service signature verification, encrypted persistence, safe metadata and transactional audit succeed");

  stage = "scope isolation and missing context";
  for (const context of contexts) {
    await withIntegrationTransaction(runtime, context, async client => {
      // Deliberately omit WHERE so RLS, not the repository filter, is tested.
      for (const table of tables) {
        const rows = (await client.query(`SELECT tenant_id,user_id FROM ${quote(table)}`)).rows;
        assert.ok(rows.length > 0);
        assert.ok(rows.every(row => row.tenant_id === context.tenantId && row.user_id === context.userId));
      }
    });
  }
  assert.equal(await service.resolveProof({ ...contextB, userId: contextA.userId }), undefined);
  const noContext = await runtime.connect();
  try {
    for (const table of tables) assert.equal((await noContext.query(`SELECT * FROM ${quote(table)}`)).rowCount, 0);
    await assert.rejects(noContext.query(`INSERT INTO integration_identity_link_challenges
      (challenge_id,tenant_id,user_id,nonce,created_at,expires_at) VALUES ($1,$2,$3,$4,now(),now()+interval '1 minute')`,
    [randomUUID(), tenantA, contextA.userId, randomUUID()]), denied);
  } finally { noContext.release(); }
  check("tenant A/B and same-tenant users are isolated; missing context hides every table and denies writes");

  stage = "connection reuse and rollback clearing";
  const pids = [];
  for (const context of contexts) {
    pids.push(await withIntegrationTransaction(reusedRuntime, context, async client => {
      const rows = (await client.query("SELECT user_id FROM integration_identity_links")).rows;
      assert.deepEqual(rows.map(row => row.user_id), [context.userId]);
      return (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    }));
  }
  assert.equal(new Set(pids).size, 1);
  const rolledBack = randomUUID();
  await assert.rejects(withIntegrationTransaction(reusedRuntime, contextA, async client => {
    await client.query(`INSERT INTO integration_identity_link_challenges
      (challenge_id,tenant_id,user_id,nonce,created_at,expires_at) VALUES ($1,$2,$3,$4,now(),now()+interval '1 minute')`,
    [rolledBack, tenantA, contextA.userId, randomUUID()]);
    throw new Error("controlled-fixture-rollback");
  }), /controlled-fixture-rollback/);
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM integration_identity_link_challenges WHERE challenge_id=$1", [rolledBack])).rows[0].n, 0);
  const cleared = await reusedRuntime.connect();
  try {
    assert.deepEqual((await cleared.query(`SELECT nullif(current_setting('app.tenant_id',true),'') AS tenant,
      nullif(current_setting('app.user_id',true),'') AS actor,nullif(current_setting('app.correlation_id',true),'') AS correlation`)).rows[0],
    { tenant: null, actor: null, correlation: null });
    assert.equal((await cleared.query("SELECT * FROM integration_identity_links")).rowCount, 0);
  } finally { cleared.release(); }
  check("one reused physical connection remains isolated after commits and rollback, with no context leakage");

  stage = "cross-scope writes";
  await assert.rejects(withIntegrationTransaction(runtime, contextA, client => client.query(
    "UPDATE integration_identity_links SET user_id=$1 WHERE link_id=$2", [contextC.userId, linked[0].result.linkId])), denied);
  await withIntegrationTransaction(runtime, contextA, async client => {
    assert.equal((await client.query("DELETE FROM integration_identity_links WHERE link_id=$1", [linked[1].result.linkId])).rowCount, 0);
  });
  assert.equal(await service.revoke(contextB, linked[0].result.linkId), false);
  check("cross-user ownership changes, cross-tenant deletion and cross-scope revoke are denied");

  stage = "one-time concurrent completion";
  const concurrent = await service.createChallenge(contextA);
  const concurrentInput = { challengeId: concurrent.challengeId, proofToken: await signedProof(contextA, concurrent), consent: true };
  const completions = await Promise.allSettled(Array.from({ length: 6 }, () => service.complete(contextA, concurrentInput)));
  assert.equal(completions.filter(value => value.status === "fulfilled").length, 1);
  assert.equal(completions.filter(value => value.status === "rejected" && value.reason.code === "identity_link_challenge_invalid").length, 5);
  await assert.rejects(service.complete(contextA, concurrentInput), error => error.code === "identity_link_challenge_invalid");
  assert.equal((await adminScopeRows("integration_identity_links", contextA)).filter(row => row.revoked_at === null).length, 1);
  check("six concurrent completions consume exactly once and replay cannot replace the active link");

  stage = "atomic rollback on audit failure";
  const beforeFailure = await service.resolveProof(contextA);
  const auditChallenge = await service.createChallenge(contextA);
  const auditProof = await signedProof(contextA, auditChallenge);
  const beforeRows = await adminScopeRows("integration_identity_links", contextA);
  await admin.query(`REVOKE INSERT ON integration_identity_link_audit FROM ${roleSql}`);
  try {
    await assert.rejects(service.complete(contextA, { challengeId: auditChallenge.challengeId, proofToken: auditProof, consent: true }), denied);
  } finally { await admin.query(`GRANT INSERT ON integration_identity_link_audit TO ${roleSql}`); }
  assert.equal((await store.findChallenge(contextA, auditChallenge.challengeId)).consumedAt, null);
  assert.deepEqual(await adminScopeRows("integration_identity_links", contextA), beforeRows);
  assert.equal((await service.resolveProof(contextA))?.linkId, beforeFailure.linkId);
  await service.complete(contextA, { challengeId: auditChallenge.challengeId, proofToken: auditProof, consent: true });
  check("real audit INSERT denial rolls back challenge consumption, replacement and ciphertext insertion atomically");

  stage = "ciphertext tampering";
  const active = await store.findActive(contextA, new Date().toISOString());
  await admin.query("UPDATE integration_identity_links SET encrypted_proof=$1 WHERE link_id=$2", [`${active.encryptedProof.slice(0, -4)}AAAA`, active.linkId]);
  assert.equal(await service.resolveProof(contextA), undefined);
  await admin.query("UPDATE integration_identity_links SET encrypted_proof=$1 WHERE link_id=$2", [active.encryptedProof, active.linkId]);
  assert.equal((await service.resolveProof(contextA))?.linkId, active.linkId);
  check("persisted ciphertext tampering closes authorization without exposing plaintext");

  stage = "expiry while waiting on a real advisory lock";
  const short = await service.createChallenge(contextA);
  const shortProof = await signedProof(contextA, short, 2);
  const blocker = await admin.connect();
  let attempted;
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`identity-link:layer8:${contextA.tenantId}:${contextA.userId}`]);
    // Attach rejection handling immediately while the store waits on another
    // physical connection. The lock wait must be observed, not merely assumed.
    attempted = service.complete(contextA, { challengeId: short.challengeId, proofToken: shortProof, consent: true })
      .then(value => ({ value }), error => ({ error }));
    const deadline = Date.now() + 1000;
    let waiting = false;
    while (Date.now() < deadline) {
      const result = await admin.query("SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted");
      if (result.rows[0].n > 0) { waiting = true; break; }
      await delay(20);
    }
    assert.equal(waiting, true, "Completion must actually wait on the held advisory lock before proof expiry");
    await delay(2200);
    await blocker.query("COMMIT");
    const outcome = await attempted;
    assert.equal(outcome.error?.code, "identity_link_challenge_invalid");
    assert.equal(outcome.value, undefined);
    assert.equal((await store.findChallenge(contextA, short.challengeId)).consumedAt, null);
  } finally {
    await blocker.query("ROLLBACK").catch(() => {});
    blocker.release();
    if (attempted) await attempted;
  }
  check("proof expiry during an observed advisory-lock wait is rechecked against the database wall clock");

  stage = "disconnect invalidates pending challenges";
  const pending = await service.createChallenge(contextA);
  const pendingProof = await signedProof(contextA, pending);
  assert.equal(await service.revoke(contextA, linked[0].result.linkId), true);
  assert.equal(await service.resolveProof(contextA), undefined);
  await assert.rejects(service.complete(contextA, { challengeId: pending.challengeId, proofToken: pendingProof, consent: true }), error => error.code === "identity_link_challenge_invalid");
  assert.ok((await adminScopeRows("integration_identity_links", contextA)).every(row => row.revoked_at !== null));
  assert.ok((await adminScopeRows("integration_identity_link_challenges", contextA)).every(row => row.consumed_at !== null || row.revoked_at !== null));
  assert.ok(await service.resolveProof(contextB));
  assert.ok(await service.resolveProof(contextC));
  check("disconnect closes refreshed links and pending challenges without affecting another user or tenant");

  console.log(`PostgreSQL verified identity links: ${checks} checks passed (disposable local fixtures only)`);
} catch (error) {
  // Do not print database errors, assertion values, connection strings or proofs.
  console.error(`Identity-link verifier failed during ${stage}; error type ${error?.code ?? error?.name ?? "unknown"}`);
  process.exitCode = 1;
} finally {
  await rawRuntime.end();
  await rawReuse.end();
  try {
    if (fixturesCreated) {
      // Exact random fixture tenants only; no shared table/database is dropped.
      for (const table of [...tables].reverse()) await admin.query(`DELETE FROM ${quote(table)} WHERE tenant_id=ANY($1::uuid[])`, [tenants]);
      await admin.query("DELETE FROM organizations WHERE organization_id=ANY($1::uuid[])", [tenants]);
    }
    if (createdRole) {
      await admin.query(`REVOKE ALL PRIVILEGES ON ${tables.map(quote).join(",")} FROM ${roleSql}`);
      await admin.query(`REVOKE USAGE ON SCHEMA public FROM ${roleSql}`);
      await admin.query(`DROP ROLE ${roleSql}`);
    }
  } catch {
    console.error("Identity-link verifier fixture cleanup failed; inspect the named local test database before reusing it");
    process.exitCode = 1;
  } finally { await admin.end(); }
}
