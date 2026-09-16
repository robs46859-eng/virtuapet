import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { integrationContextSchema, type IntegrationContext } from "./context.js";
import { withIntegrationTransaction } from "./transaction.js";

export interface IdentityLinkChallenge {
  challengeId: string;
  tenantId: string;
  userId: string;
  nonce: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  revokedAt: string | null;
}

/** Internal persistence shape. Never serialize this object into an API response. */
export interface IdentityLinkRecord {
  linkId: string;
  tenantId: string;
  userId: string;
  provider: "layer8";
  providerSubject: string;
  providerTenantId: string;
  providerOrganizationId: string;
  proofId: string;
  encryptedProof: string;
  createdAt: string;
  consentedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface IdentityLinkAuditEvent {
  eventId: string;
  tenantId: string;
  userId: string;
  correlationId: string;
  eventType: "challenge_created" | "link_completed" | "links_revoked";
  targetId: string;
  occurredAt: string;
}

export interface IdentityLinkStore {
  createChallenge(context: IntegrationContext, challenge: IdentityLinkChallenge): Promise<void>;
  findChallenge(context: IntegrationContext, challengeId: string): Promise<IdentityLinkChallenge | undefined>;
  completeChallenge(context: IntegrationContext, challengeId: string, nonce: string, record: IdentityLinkRecord, now: string): Promise<boolean>;
  list(context: IntegrationContext): Promise<IdentityLinkRecord[]>;
  findActive(context: IntegrationContext, now: string): Promise<IdentityLinkRecord | undefined>;
  /** Disconnect the whole user/tenant Layer8 scope, including outstanding challenges. */
  revoke(context: IntegrationContext, linkId: string, now: string): Promise<boolean>;
}

function sameScope(context: IntegrationContext, record: { tenantId: string; userId: string }): boolean {
  return record.tenantId === context.tenantId && record.userId === context.userId;
}
function checkedScope(context: IntegrationContext, record?: { tenantId: string; userId: string }) {
  integrationContextSchema.parse(context);
  if (record && !sameScope(context, record)) throw new Error("identity_link_scope_mismatch");
}
function audit(context: IntegrationContext, eventType: IdentityLinkAuditEvent["eventType"], targetId: string, occurredAt: string): IdentityLinkAuditEvent {
  return { eventId: randomUUID(), tenantId: context.tenantId, userId: context.userId, correlationId: context.correlationId, eventType, targetId, occurredAt };
}

/** Test-only store: all mutating sections are synchronous, so consumption is atomic. */
export class MemoryIdentityLinkStore implements IdentityLinkStore {
  private readonly challenges = new Map<string, IdentityLinkChallenge>();
  private readonly records = new Map<string, IdentityLinkRecord>();
  private readonly events: IdentityLinkAuditEvent[] = [];

  async createChallenge(context: IntegrationContext, challenge: IdentityLinkChallenge): Promise<void> {
    checkedScope(context, challenge);
    for (const item of this.challenges.values()) {
      if (sameScope(context, item) && !item.consumedAt && !item.revokedAt) item.revokedAt = challenge.createdAt;
    }
    this.challenges.set(challenge.challengeId, structuredClone(challenge));
    this.events.push(audit(context, "challenge_created", challenge.challengeId, challenge.createdAt));
  }
  async findChallenge(context: IntegrationContext, challengeId: string): Promise<IdentityLinkChallenge | undefined> {
    checkedScope(context);
    const item = this.challenges.get(challengeId);
    return item && sameScope(context, item) ? structuredClone(item) : undefined;
  }
  async completeChallenge(context: IntegrationContext, challengeId: string, nonce: string, record: IdentityLinkRecord, now: string): Promise<boolean> {
    checkedScope(context, record);
    const item = this.challenges.get(challengeId);
    if (!item || !sameScope(context, item) || item.nonce !== nonce || item.consumedAt || item.revokedAt ||
        Date.parse(item.expiresAt) <= Date.parse(now) || Date.parse(record.expiresAt) <= Date.parse(now)) return false;
    if ([...this.records.values()].some(value => value.proofId === record.proofId)) return false;
    item.consumedAt = now;
    for (const value of this.records.values()) if (sameScope(context, value) && !value.revokedAt) value.revokedAt = now;
    this.records.set(record.linkId, structuredClone(record));
    this.events.push(audit(context, "link_completed", record.linkId, now));
    return true;
  }
  async list(context: IntegrationContext): Promise<IdentityLinkRecord[]> {
    checkedScope(context);
    return [...this.records.values()].filter(value => sameScope(context, value)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100).map(value => structuredClone(value));
  }
  async findActive(context: IntegrationContext, now: string): Promise<IdentityLinkRecord | undefined> {
    checkedScope(context);
    const value = [...this.records.values()].find(item => sameScope(context, item) && !item.revokedAt && Date.parse(item.expiresAt) > Date.parse(now));
    return value ? structuredClone(value) : undefined;
  }
  async revoke(context: IntegrationContext, linkId: string, now: string): Promise<boolean> {
    checkedScope(context);
    const target = this.records.get(linkId);
    if (!target || !sameScope(context, target)) return false;
    for (const item of this.records.values()) if (sameScope(context, item) && !item.revokedAt) item.revokedAt = now;
    for (const item of this.challenges.values()) if (sameScope(context, item) && !item.consumedAt && !item.revokedAt) item.revokedAt = now;
    this.events.push(audit(context, "links_revoked", linkId, now));
    return true;
  }
  /** Safe ID-only evidence for tests; no tokens or provider identifiers. */
  auditEvents(context: IntegrationContext): IdentityLinkAuditEvent[] {
    checkedScope(context);
    return this.events.filter(item => sameScope(context, item)).map(value => structuredClone(value));
  }
}

type Row = Record<string, unknown>;
function timestamp(value: unknown): string { return new Date(value as string | Date).toISOString(); }
function nullableTimestamp(value: unknown): string | null { return value == null ? null : timestamp(value); }
function challengeFromRow(row: Row): IdentityLinkChallenge {
  return { challengeId: String(row.challenge_id), tenantId: String(row.tenant_id), userId: String(row.user_id), nonce: String(row.nonce),
    createdAt: timestamp(row.created_at), expiresAt: timestamp(row.expires_at), consumedAt: nullableTimestamp(row.consumed_at), revokedAt: nullableTimestamp(row.revoked_at) };
}
function recordFromRow(row: Row): IdentityLinkRecord {
  return { linkId: String(row.link_id), tenantId: String(row.tenant_id), userId: String(row.user_id), provider: "layer8",
    providerSubject: String(row.provider_subject), providerTenantId: String(row.provider_tenant_id), providerOrganizationId: String(row.provider_organization_id),
    proofId: String(row.proof_id), encryptedProof: String(row.encrypted_proof), createdAt: timestamp(row.created_at),
    consentedAt: timestamp(row.consented_at), expiresAt: timestamp(row.expires_at), revokedAt: nullableTimestamp(row.revoked_at) };
}

export class PostgreSQLIdentityLinkStore implements IdentityLinkStore {
  constructor(private readonly pool: Pick<Pool, "connect">) {}

  private run<T>(context: IntegrationContext, work: (client: PoolClient) => Promise<T>): Promise<T> {
    return withIntegrationTransaction(this.pool, context, async client => {
      await client.query("SET LOCAL statement_timeout = '10s'");
      await client.query("SET LOCAL lock_timeout = '5s'");
      return work(client);
    });
  }

  private async lockScope(client: PoolClient, context: IntegrationContext) {
    // Serialize create/complete/disconnect even when there is no existing link row.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`identity-link:layer8:${context.tenantId}:${context.userId}`]);
  }
  private async writeAudit(client: PoolClient, event: IdentityLinkAuditEvent) {
    await client.query(`INSERT INTO integration_identity_link_audit
      (event_id, tenant_id, user_id, correlation_id, event_type, target_id, occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [event.eventId, event.tenantId, event.userId, event.correlationId, event.eventType, event.targetId, event.occurredAt]);
  }
  async createChallenge(context: IntegrationContext, challenge: IdentityLinkChallenge): Promise<void> {
    checkedScope(context, challenge);
    await this.run(context, async client => {
      await this.lockScope(client, context);
      await client.query(`UPDATE integration_identity_link_challenges SET revoked_at=$3
        WHERE tenant_id=$1 AND user_id=$2 AND consumed_at IS NULL AND revoked_at IS NULL`, [context.tenantId, context.userId, challenge.createdAt]);
      await client.query(`INSERT INTO integration_identity_link_challenges
        (challenge_id,tenant_id,user_id,nonce,created_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [challenge.challengeId, challenge.tenantId, challenge.userId, challenge.nonce, challenge.createdAt, challenge.expiresAt]);
      await this.writeAudit(client, audit(context, "challenge_created", challenge.challengeId, challenge.createdAt));
    });
  }
  async findChallenge(context: IntegrationContext, challengeId: string): Promise<IdentityLinkChallenge | undefined> {
    return this.run(context, async client => {
      const result = await client.query(`SELECT * FROM integration_identity_link_challenges WHERE tenant_id=$1 AND user_id=$2 AND challenge_id=$3`,
        [context.tenantId, context.userId, challengeId]);
      return result.rows[0] ? challengeFromRow(result.rows[0]) : undefined;
    });
  }
  async completeChallenge(context: IntegrationContext, challengeId: string, nonce: string, record: IdentityLinkRecord, now: string): Promise<boolean> {
    checkedScope(context, record);
    return this.run(context, async client => {
      await this.lockScope(client, context);
      if (Date.parse(record.expiresAt) <= Date.parse(now)) return false;
      const consumed = await client.query(`UPDATE integration_identity_link_challenges SET consumed_at=$5
        WHERE tenant_id=$1 AND user_id=$2 AND challenge_id=$3 AND nonce=$4
          AND consumed_at IS NULL AND revoked_at IS NULL
          AND expires_at>GREATEST($5::timestamptz,clock_timestamp())
          AND $6::timestamptz>GREATEST($5::timestamptz,clock_timestamp()) RETURNING challenge_id`,
      [context.tenantId, context.userId, challengeId, nonce, now, record.expiresAt]);
      if (!consumed.rowCount) return false;
      await client.query(`UPDATE integration_identity_links SET revoked_at=$3 WHERE tenant_id=$1 AND user_id=$2 AND revoked_at IS NULL`,
        [context.tenantId, context.userId, now]);
      await client.query(`INSERT INTO integration_identity_links
        (link_id,tenant_id,user_id,provider,provider_subject,provider_tenant_id,provider_organization_id,proof_id,encrypted_proof,created_at,consented_at,expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [record.linkId, record.tenantId, record.userId, record.provider, record.providerSubject, record.providerTenantId, record.providerOrganizationId,
        record.proofId, record.encryptedProof, record.createdAt, record.consentedAt, record.expiresAt]);
      await this.writeAudit(client, audit(context, "link_completed", record.linkId, now));
      return true;
    });
  }
  async list(context: IntegrationContext): Promise<IdentityLinkRecord[]> {
    return this.run(context, async client => {
      const result = await client.query(`SELECT * FROM integration_identity_links WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100`,
        [context.tenantId, context.userId]);
      return result.rows.map(recordFromRow);
    });
  }
  async findActive(context: IntegrationContext, now: string): Promise<IdentityLinkRecord | undefined> {
    return this.run(context, async client => {
      const result = await client.query(`SELECT * FROM integration_identity_links WHERE tenant_id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>GREATEST($3::timestamptz,clock_timestamp()) LIMIT 1`,
        [context.tenantId, context.userId, now]);
      return result.rows[0] ? recordFromRow(result.rows[0]) : undefined;
    });
  }
  async revoke(context: IntegrationContext, linkId: string, now: string): Promise<boolean> {
    return this.run(context, async client => {
      await this.lockScope(client, context);
      const target = await client.query(`SELECT link_id FROM integration_identity_links WHERE tenant_id=$1 AND user_id=$2 AND link_id=$3`,
        [context.tenantId, context.userId, linkId]);
      if (!target.rowCount) return false;
      await client.query(`UPDATE integration_identity_links SET revoked_at=$3 WHERE tenant_id=$1 AND user_id=$2 AND revoked_at IS NULL`,
        [context.tenantId, context.userId, now]);
      await client.query(`UPDATE integration_identity_link_challenges SET revoked_at=$3 WHERE tenant_id=$1 AND user_id=$2 AND consumed_at IS NULL AND revoked_at IS NULL`,
        [context.tenantId, context.userId, now]);
      await this.writeAudit(client, audit(context, "links_revoked", linkId, now));
      return true;
    });
  }
}
