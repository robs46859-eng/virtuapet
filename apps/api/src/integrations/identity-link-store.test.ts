import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";
import { MemoryIdentityLinkStore, PostgreSQLIdentityLinkStore, type IdentityLinkChallenge, type IdentityLinkRecord } from "./identity-link-store.js";
import type { IntegrationContext } from "./context.js";

const context: IntegrationContext = { userId: randomUUID(), tenantId: randomUUID(), roles: ["guardian"], correlationId: randomUUID() };
const time = new Date().toISOString();
const later = new Date(Date.parse(time) + 60_000).toISOString();
const makeChallenge = (): IdentityLinkChallenge => ({ challengeId: randomUUID(), ...context, nonce: randomUUID(), createdAt: time, expiresAt: later, consumedAt: null, revokedAt: null });
const makeRecord = (): IdentityLinkRecord => ({ linkId: randomUUID(), userId: context.userId, tenantId: context.tenantId, provider: "layer8", providerSubject: "user_provider",
  providerTenantId: "tenant_provider", providerOrganizationId: "org_provider", proofId: randomUUID(), encryptedProof: "encrypted-fixture-not-a-real-token",
  createdAt: time, consentedAt: time, expiresAt: later, revokedAt: null });

describe("memory identity store", () => {
  it("isolates returned objects and denies mismatched writes", async () => {
    const store = new MemoryIdentityLinkStore();
    const challenge = makeChallenge();
    await store.createChallenge(context, challenge);
    challenge.nonce = randomUUID();
    expect((await store.findChallenge(context, challenge.challengeId))!.nonce).not.toBe(challenge.nonce);
    const returned = await store.findChallenge(context, challenge.challengeId);
    returned!.revokedAt = time;
    expect((await store.findChallenge(context, challenge.challengeId))!.revokedAt).toBeNull();
    await expect(store.createChallenge(context, { ...makeChallenge(), userId: randomUUID() })).rejects.toThrow("scope_mismatch");
    await expect(store.completeChallenge(context, challenge.challengeId, challenge.nonce, { ...makeRecord(), tenantId: randomUUID() }, time)).rejects.toThrow("scope_mismatch");
  });
  it("atomically consumes one challenge, replaces active links, and audits IDs only", async () => {
    const store = new MemoryIdentityLinkStore();
    const challenge = makeChallenge();
    await store.createChallenge(context, challenge);
    const record = makeRecord();
    const completed = await Promise.all(Array.from({ length: 12 }, () => store.completeChallenge(context, challenge.challengeId, challenge.nonce, record, time)));
    expect(completed.filter(Boolean)).toHaveLength(1);
    const next = makeChallenge();
    await store.createChallenge(context, next);
    await store.completeChallenge(context, next.challengeId, next.nonce, makeRecord(), time);
    expect((await store.list(context)).filter(value => !value.revokedAt)).toHaveLength(1);
    expect(store.auditEvents(context)).toHaveLength(4);
    expect(JSON.stringify(store.auditEvents(context))).not.toMatch(/encryptedProof|providerSubject|nonce/);
  });
  it("does not consume invalid, expired, revoked, or replayed proofs", async () => {
    const store = new MemoryIdentityLinkStore();
    const challenge = makeChallenge();
    await store.createChallenge(context, challenge);
    const record = makeRecord();
    expect(await store.completeChallenge(context, challenge.challengeId, randomUUID(), record, time)).toBe(false);
    expect(await store.completeChallenge(context, challenge.challengeId, challenge.nonce, { ...record, expiresAt: time }, time)).toBe(false);
    expect(await store.completeChallenge(context, challenge.challengeId, challenge.nonce, record, later)).toBe(false);
    expect(await store.completeChallenge(context, challenge.challengeId, challenge.nonce, record, time)).toBe(true);
    const next = makeChallenge();
    await store.createChallenge(context, next);
    expect(await store.completeChallenge(context, next.challengeId, next.nonce, { ...makeRecord(), proofId: record.proofId }, time)).toBe(false);
    expect(await store.revoke(context, record.linkId, time)).toBe(true);
    expect(await store.completeChallenge(context, next.challengeId, next.nonce, makeRecord(), time)).toBe(false);
  });
});

function pgFixture(failAudit = false) {
  const queries: { sql: string; values: unknown[] }[] = [];
  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    queries.push({ sql, values });
    if (failAudit && sql.includes("INSERT INTO integration_identity_link_audit")) throw new Error("audit failed");
    return { rows: [], rowCount: sql.includes("RETURNING challenge_id") || sql.includes("SELECT link_id") ? 1 : 0 };
  });
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const connect = vi.fn(async () => client);
  const pool = { connect } as unknown as Pick<Pool, "connect">;
  return { store: new PostgreSQLIdentityLinkStore(pool), queries, query, release, connect };
}
describe("PostgreSQL identity store transaction contract", () => {
  it("uses one pooled connection and transaction-local user/tenant/timeouts on every operation", async () => {
    const fixture = pgFixture();
    const challenge = makeChallenge();
    await fixture.store.createChallenge(context, challenge);
    await fixture.store.findChallenge(context, challenge.challengeId);
    await fixture.store.completeChallenge(context, challenge.challengeId, challenge.nonce, makeRecord(), time);
    await fixture.store.list(context);
    await fixture.store.findActive(context, time);
    await fixture.store.revoke(context, randomUUID(), time);
    expect(fixture.connect).toHaveBeenCalledTimes(6);
    expect(fixture.release).toHaveBeenCalledTimes(6);
    expect(fixture.queries.filter(value => value.sql === "BEGIN")).toHaveLength(6);
    expect(fixture.queries.filter(value => value.sql === "COMMIT")).toHaveLength(6);
    expect(fixture.queries.filter(value => value.sql.includes("set_config")).every(value => value.values[0] === context.tenantId && value.values[1] === context.userId)).toBe(true);
    expect(fixture.queries.filter(value => value.sql.includes("SET LOCAL lock_timeout"))).toHaveLength(6);
    expect(fixture.queries.filter(value => value.sql.includes("pg_advisory_xact_lock"))).toHaveLength(3);
    expect(fixture.queries.find(value => value.sql.includes("RETURNING challenge_id"))!.sql).toContain("clock_timestamp()");
  });
  it("rolls back state with audit failure and releases the connection", async () => {
    const fixture = pgFixture(true);
    await expect(fixture.store.createChallenge(context, makeChallenge())).rejects.toThrow("audit failed");
    expect(fixture.queries.at(-1)!.sql).toBe("ROLLBACK");
    expect(fixture.queries.some(value => value.sql === "COMMIT")).toBe(false);
    expect(fixture.release).toHaveBeenCalledTimes(1);
  });
  it("does not insert an identity record when challenge consumption returns no rows", async () => {
    const fixture = pgFixture();
    fixture.query.mockImplementation(async (sql, values = []) => {
      fixture.queries.push({ sql, values });
      return { rows: [], rowCount: 0 };
    });
    const challenge = makeChallenge();
    expect(await fixture.store.completeChallenge(context, challenge.challengeId, challenge.nonce, makeRecord(), time)).toBe(false);
    expect(fixture.queries.some(value => value.sql.includes("INSERT INTO integration_identity_links"))).toBe(false);
  });
});
