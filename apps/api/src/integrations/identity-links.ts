import { createCipheriv, createDecipheriv, createPublicKey, randomBytes, randomUUID } from "node:crypto";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { uuidSchema } from "@virtuapet/contracts";
import { z } from "zod";
import { integrationContextSchema, type IntegrationContext } from "./context.js";
import type { IdentityLinkRecord, IdentityLinkStore } from "./identity-link-store.js";

export const LAYER8_LINK_PROTOCOL = "virtuapet.layer8.link.v1";
const MAX_PROOF_BYTES = 16_384;
const safeProviderId = z.string().min(1).max(255).regex(/^[A-Za-z0-9_.:-]+$/);
export const layer8LinkClaimsSchema = z.object({
  iss: z.string().min(1), aud: z.string().min(1), sub: uuidSchema,
  iat: z.number().int().nonnegative(), exp: z.number().int().positive(), jti: uuidSchema,
  protocol: z.literal(LAYER8_LINK_PROTOCOL), tenantId: uuidSchema, challengeId: uuidSchema, nonce: uuidSchema,
  providerSubject: safeProviderId, providerTenantId: safeProviderId, providerOrganizationId: safeProviderId
}).strict();
type LinkClaims = z.infer<typeof layer8LinkClaimsSchema>;

export class IdentityLinkError extends Error {
  constructor(readonly code: string, readonly statusCode: 400 | 403 | 404 | 409 | 503) {
    super(code);
    this.name = "IdentityLinkError";
  }
}
export interface IdentityLinkConfiguration {
  enabled?: boolean;
  store?: IdentityLinkStore;
  issuer?: string;
  audience?: string;
  pinnedKid?: string;
  publicJwks?: JSONWebKeySet;
  encryptionKeyBase64?: string;
  now?: () => Date;
}
export interface IdentityLinkMetadata {
  linkId: string;
  provider: "layer8";
  state: "active" | "expired" | "revoked";
  createdAt: string;
  consentedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}
export interface LinkChallengeResponse {
  protocol: typeof LAYER8_LINK_PROTOCOL;
  challengeId: string;
  nonce: string;
  subject: string;
  tenantId: string;
  expiresAt: string;
}
export interface ResolvedIdentityProof {
  proofToken: string;
  linkId: string;
  providerSubject: string;
  providerTenantId: string;
  providerOrganizationId: string;
  expiresAt: string;
}
export interface IdentityLinkService {
  createChallenge(context: IntegrationContext): Promise<LinkChallengeResponse>;
  complete(context: IntegrationContext, input: { challengeId: string; proofToken: string; consent: true }): Promise<IdentityLinkMetadata>;
  list(context: IntegrationContext): Promise<IdentityLinkMetadata[]>;
  revoke(context: IntegrationContext, linkId: string): Promise<boolean>;
  resolveProof(context: IntegrationContext): Promise<ResolvedIdentityProof | undefined>;
}

function metadata(record: IdentityLinkRecord, now: Date): IdentityLinkMetadata {
  return { linkId: record.linkId, provider: "layer8", state: record.revokedAt ? "revoked" : Date.parse(record.expiresAt) <= now.getTime() ? "expired" : "active",
    createdAt: record.createdAt, consentedAt: record.consentedAt, expiresAt: record.expiresAt, revokedAt: record.revokedAt };
}
function aad(context: IntegrationContext, linkId: string): Buffer {
  return Buffer.from(JSON.stringify(["virtuapet.identity-link.v1", context.tenantId, context.userId, linkId]));
}
function encryptProof(key: Buffer, context: IntegrationContext, linkId: string, proofToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(context, linkId));
  const ciphertext = Buffer.concat([cipher.update(proofToken, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}
function decryptProof(key: Buffer, context: IntegrationContext, record: IdentityLinkRecord): string {
  const parts = record.encryptedProof.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || parts.slice(1).some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error("invalid_ciphertext");
  const iv = Buffer.from(parts[1]!, "base64url");
  const ciphertext = Buffer.from(parts[2]!, "base64url");
  const tag = Buffer.from(parts[3]!, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length > MAX_PROOF_BYTES) throw new Error("invalid_ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad(context, record.linkId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** No memory fallback and no remote key discovery. Incomplete settings stay unavailable. */
export function createIdentityLinkService(config: IdentityLinkConfiguration = {}): IdentityLinkService | undefined {
  if (!config.enabled || !config.store || !config.issuer || !config.audience || !config.pinnedKid || !config.publicJwks || !config.encryptionKeyBase64) return undefined;
  const { store, issuer, audience, pinnedKid } = config;
  let verificationKeys: ReturnType<typeof createLocalJWKSet>;
  let key: Buffer;
  try {
    const issuerUrl = new URL(issuer);
    if (issuerUrl.protocol !== "https:" || issuerUrl.username || issuerUrl.password || issuerUrl.search || issuerUrl.hash ||
        audience.length > 255 || pinnedKid.length > 255) return undefined;
    key = Buffer.from(config.encryptionKeyBase64, "base64");
    if (key.length !== 32 || key.toString("base64") !== config.encryptionKeyBase64) return undefined;
    const keys = config.publicJwks.keys.filter(item => item.kid === pinnedKid);
    const pinned = keys[0];
    if (keys.length !== 1 || !pinned || pinned.kty !== "EC" || pinned.crv !== "P-256" || !pinned.x || !pinned.y || pinned.d ||
        (pinned.alg !== undefined && pinned.alg !== "ES256") || (pinned.use !== undefined && pinned.use !== "sig") ||
        (pinned.key_ops !== undefined && (pinned.key_ops.length !== 1 || pinned.key_ops[0] !== "verify"))) return undefined;
    createPublicKey({ key: { kty: "EC", crv: "P-256", x: pinned.x, y: pinned.y }, format: "jwk" });
    verificationKeys = createLocalJWKSet({ keys: [structuredClone(pinned)] });
  } catch { return undefined; }
  const configuredClock = config.now;
  const now = () => {
    const value = configuredClock?.() ?? new Date();
    if (!Number.isFinite(value.getTime())) throw new IdentityLinkError("identity_links_unavailable", 503);
    return value;
  };
  async function verifyProof(proofToken: string, context: IntegrationContext, current: Date): Promise<LinkClaims> {
    try {
      if (typeof proofToken !== "string" || proofToken.length < 20 || Buffer.byteLength(proofToken) > MAX_PROOF_BYTES) throw new Error("invalid_token");
      const verified = await jwtVerify(proofToken, verificationKeys, { issuer, audience, algorithms: ["ES256"],
        typ: "vp-layer8-link+jwt", currentDate: current, clockTolerance: 0, requiredClaims: ["iss", "aud", "sub", "iat", "exp", "jti"] });
      if (verified.protectedHeader.kid !== pinnedKid || verified.protectedHeader.typ !== "vp-layer8-link+jwt" ||
          Object.keys(verified.protectedHeader).some(field => !["alg", "typ", "kid"].includes(field))) throw new Error("invalid_header");
      const claims = layer8LinkClaimsSchema.parse(verified.payload);
      const seconds = Math.floor(current.getTime() / 1000);
      if (claims.sub !== context.userId || claims.tenantId !== context.tenantId || claims.iat > seconds || claims.exp <= seconds ||
          claims.exp <= claims.iat || claims.exp - claims.iat > 300) throw new Error("invalid_binding");
      return claims;
    } catch { throw new IdentityLinkError("identity_link_proof_invalid", 403); }
  }
  return {
    async createChallenge(context) {
      integrationContextSchema.parse(context);
      const current = now();
      const challenge = { challengeId: randomUUID(), tenantId: context.tenantId, userId: context.userId,
        nonce: randomUUID(), createdAt: current.toISOString(), expiresAt: new Date(current.getTime() + 300_000).toISOString(), consumedAt: null, revokedAt: null };
      await store.createChallenge(context, challenge);
      return { protocol: LAYER8_LINK_PROTOCOL, challengeId: challenge.challengeId, nonce: challenge.nonce,
        subject: context.userId, tenantId: context.tenantId, expiresAt: challenge.expiresAt };
    },
    async complete(context, input) {
      integrationContextSchema.parse(context);
      if (input.consent !== true || !uuidSchema.safeParse(input.challengeId).success) throw new IdentityLinkError("identity_link_consent_and_challenge_required", 400);
      const current = now();
      const challenge = await store.findChallenge(context, input.challengeId);
      if (!challenge || challenge.consumedAt || challenge.revokedAt || Date.parse(challenge.expiresAt) <= current.getTime()) throw new IdentityLinkError("identity_link_challenge_invalid", 409);
      const claims = await verifyProof(input.proofToken, context, current);
      if (claims.challengeId !== challenge.challengeId || claims.nonce !== challenge.nonce || claims.iat < Math.floor(Date.parse(challenge.createdAt) / 1000)) {
        throw new IdentityLinkError("identity_link_proof_invalid", 403);
      }
      const linkId = randomUUID();
      const record: IdentityLinkRecord = { linkId, tenantId: context.tenantId, userId: context.userId, provider: "layer8",
        providerSubject: claims.providerSubject, providerTenantId: claims.providerTenantId, providerOrganizationId: claims.providerOrganizationId,
        proofId: claims.jti, encryptedProof: encryptProof(key, context, linkId, input.proofToken), createdAt: current.toISOString(),
        consentedAt: current.toISOString(), expiresAt: new Date(claims.exp * 1000).toISOString(), revokedAt: null };
      // Recheck wall time after cryptography; store atomically rechecks expiry and consumption.
      const completionTime = now();
      if (!await store.completeChallenge(context, challenge.challengeId, challenge.nonce, record, completionTime.toISOString())) {
        throw new IdentityLinkError("identity_link_challenge_invalid", 409);
      }
      return metadata(record, completionTime);
    },
    async list(context) {
      integrationContextSchema.parse(context);
      const current = now();
      return (await store.list(context)).map(record => metadata(record, current));
    },
    async revoke(context, linkId) {
      integrationContextSchema.parse(context);
      if (!uuidSchema.safeParse(linkId).success) throw new IdentityLinkError("invalid_identity_link_id", 400);
      return store.revoke(context, linkId, now().toISOString());
    },
    async resolveProof(context) {
      integrationContextSchema.parse(context);
      const current = now();
      const record = await store.findActive(context, current.toISOString());
      if (!record) return undefined;
      try {
        if (record.tenantId !== context.tenantId || record.userId !== context.userId || record.revokedAt ||
            !Number.isFinite(Date.parse(record.consentedAt)) || Date.parse(record.consentedAt) > current.getTime() || Date.parse(record.expiresAt) <= current.getTime()) return undefined;
        const proofToken = decryptProof(key, context, record);
        const claims = await verifyProof(proofToken, context, current);
        if (claims.jti !== record.proofId || claims.providerSubject !== record.providerSubject || claims.providerTenantId !== record.providerTenantId ||
            claims.providerOrganizationId !== record.providerOrganizationId || claims.exp * 1000 !== Date.parse(record.expiresAt)) return undefined;
        // Re-query after asynchronous signature verification so a completed
        // disconnect during verification cannot return the old proof.
        const active = await store.findActive(context, now().toISOString());
        if (!active || active.linkId !== record.linkId || active.encryptedProof !== record.encryptedProof) return undefined;
        return { proofToken, linkId: record.linkId, providerSubject: record.providerSubject,
          providerTenantId: record.providerTenantId, providerOrganizationId: record.providerOrganizationId, expiresAt: record.expiresAt };
      } catch { return undefined; }
    }
  };
}
