import { randomBytes, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet } from "jose";
import { createIdentityLinkService, type IdentityLinkConfiguration, type IdentityLinkService, type LinkChallengeResponse } from "./identity-links.js";
import { MemoryIdentityLinkStore, type IdentityLinkRecord } from "./identity-link-store.js";
import type { IntegrationContext } from "./context.js";

const context: IntegrationContext = { userId: "04240ca7-5f6b-497b-89f8-dd4aad574a60", tenantId: "5a0a47a1-402e-437b-8082-f123402ab9d7", roles: ["guardian"], correlationId: randomUUID() };
const otherTenant = { ...context, tenantId: randomUUID() };
const otherUser = { ...context, userId: randomUUID() };
const issuer = "https://layer8.example.test";
const audience = "virtuapet-links";
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let store: MemoryIdentityLinkStore;
let service: IdentityLinkService;
let config: IdentityLinkConfiguration;
let current: Date;

beforeEach(async () => {
  keys = await generateKeyPair("ES256");
  const jwk = await exportJWK(keys.publicKey);
  const publicJwks: JSONWebKeySet = { keys: [{ ...jwk, kid: "link-test-key", alg: "ES256", use: "sig" }] };
  current = new Date("2026-09-16T10:00:00Z");
  store = new MemoryIdentityLinkStore();
  config = { enabled: true, store, issuer, audience, pinnedKid: "link-test-key", publicJwks,
    encryptionKeyBase64: randomBytes(32).toString("base64"), now: () => current };
  service = createIdentityLinkService(config)!;
});

async function sign(challenge: LinkChallengeResponse, overrides: Record<string, unknown> = {}, headerOverrides: Record<string, unknown> = {}) {
  const seconds = Math.floor(current.getTime() / 1000);
  return new SignJWT({ iss: issuer, aud: audience, sub: context.userId, iat: seconds, exp: seconds + 300, jti: randomUUID(),
    protocol: "virtuapet.layer8.link.v1", tenantId: context.tenantId, challengeId: challenge.challengeId, nonce: challenge.nonce,
    providerSubject: "user_clerk_verified", providerTenantId: "tenant_layer8_verified", providerOrganizationId: "org_clerk_verified", ...overrides })
    .setProtectedHeader({ alg: "ES256", kid: "link-test-key", typ: "vp-layer8-link+jwt", ...headerOverrides }).sign(keys.privateKey);
}
async function link() {
  const challenge = await service.createChallenge(context);
  const proofToken = await sign(challenge);
  const result = await service.complete(context, { challengeId: challenge.challengeId, proofToken, consent: true });
  return { challenge, proofToken, result };
}

describe("verified Layer8 identity links", () => {
  it("is unavailable by default and on missing or invalid cryptographic settings", () => {
    expect(createIdentityLinkService()).toBeUndefined();
    for (const field of ["store", "issuer", "audience", "pinnedKid", "publicJwks", "encryptionKeyBase64"] as const) {
      expect(createIdentityLinkService({ ...config, [field]: undefined })).toBeUndefined();
    }
    expect(createIdentityLinkService({ ...config, enabled: false })).toBeUndefined();
    expect(createIdentityLinkService({ ...config, encryptionKeyBase64: "not-a-key" })).toBeUndefined();
    expect(createIdentityLinkService({ ...config, issuer: "http://untrusted.example" })).toBeUndefined();
    expect(createIdentityLinkService({ ...config, publicJwks: { keys: [{ ...config.publicJwks!.keys[0], d: "private-key-disallowed" }] } })).toBeUndefined();
    expect(createIdentityLinkService({ ...config, pinnedKid: "wrong-key" })).toBeUndefined();
  });

  it("completes a bound challenge, encrypts the proof, and lists metadata only", async () => {
    const { proofToken, result } = await link();
    expect(result).toMatchObject({ provider: "layer8", state: "active" });
    const records = await store.list(context);
    expect(records[0]!.encryptedProof).not.toContain(proofToken);
    expect(records[0]!.encryptedProof).toMatch(/^v1\./);
    const resolved = await service.resolveProof(context);
    expect(resolved).toMatchObject({ proofToken, linkId: result.linkId, providerSubject: "user_clerk_verified" });
    expect(JSON.stringify(await service.list(context))).not.toMatch(/proof|providerSubject|providerTenantId|providerOrganizationId|nonce|tenantId|userId/);
    expect(store.auditEvents(context).map(value => value.eventType)).toEqual(["challenge_created", "link_completed"]);
    expect(JSON.stringify(store.auditEvents(context))).not.toContain(proofToken);
  });

  it("requires explicit true consent", async () => {
    const challenge = await service.createChallenge(context);
    await expect(service.complete(context, { challengeId: challenge.challengeId, proofToken: await sign(challenge), consent: false as true })).rejects.toMatchObject({ statusCode: 400 });
    expect(await service.resolveProof(context)).toBeUndefined();
  });

  it.each([
    ["subject", { sub: otherUser.userId }], ["tenant", { tenantId: otherTenant.tenantId }],
    ["challenge", { challengeId: randomUUID() }], ["nonce", { nonce: randomUUID() }],
    ["issuer", { iss: "https://wrong.example.test" }], ["audience", { aud: "virtuapet-policy" }],
    ["protocol", { protocol: "unrelated" }], ["extra_claim", { email: "not-authority@example.test" }],
    ["bad_provider", { providerSubject: "https://credential.example/private?token=x" }]
  ])("rejects wrong %s binding", async (_name, overrides) => {
    const challenge = await service.createChallenge(context);
    await expect(service.complete(context, { challengeId: challenge.challengeId, proofToken: await sign(challenge, overrides), consent: true })).rejects.toMatchObject({ code: "identity_link_proof_invalid" });
  });

  it.each([
    ["expired", { exp: 1789552800 }], ["future", { iat: 1789552801, exp: 1789553100 }],
    ["long_lifetime", { exp: 1789553101 }], ["fractional_time", { exp: 1789553000.5 }]
  ])("rejects %s token timestamps", async (_name, overrides) => {
    const challenge = await service.createChallenge(context);
    await expect(service.complete(context, { challengeId: challenge.challengeId, proofToken: await sign(challenge, overrides), consent: true })).rejects.toMatchObject({ code: "identity_link_proof_invalid" });
  });

  it.each([{ typ: "JWT" }, { kid: "other-key" }, { jku: "https://attacker.example/keys" }])("rejects unsafe protected header %j", async header => {
    const challenge = await service.createChallenge(context);
    await expect(service.complete(context, { challengeId: challenge.challengeId, proofToken: await sign(challenge, {}, header), consent: true })).rejects.toMatchObject({ code: "identity_link_proof_invalid" });
  });

  it("rejects altered signatures and foreign keys", async () => {
    const challenge = await service.createChallenge(context);
    const proof = await sign(challenge);
    const parts = proof.split(".");
    parts[2] = `${parts[2]![0] === "A" ? "B" : "A"}${parts[2]!.slice(1)}`;
    await expect(service.complete(context, { challengeId: challenge.challengeId, proofToken: parts.join("."), consent: true })).rejects.toMatchObject({ statusCode: 403 });
    keys = await generateKeyPair("ES256");
    await expect(service.complete(context, { challengeId: challenge.challengeId, proofToken: await sign(challenge), consent: true })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows exactly one concurrent completion and rejects replay", async () => {
    const challenge = await service.createChallenge(context);
    const input = { challengeId: challenge.challengeId, proofToken: await sign(challenge), consent: true as const };
    const completed = await Promise.allSettled([service.complete(context, input), service.complete(context, input)]);
    expect(completed.filter(value => value.status === "fulfilled")).toHaveLength(1);
    expect(completed.filter(value => value.status === "rejected")).toHaveLength(1);
    await expect(service.complete(context, input)).rejects.toMatchObject({ statusCode: 409 });
    expect(await store.list(context)).toHaveLength(1);
  });

  it("denies cross-user and cross-tenant challenge/list/resolve/revoke", async () => {
    const { result, challenge, proofToken } = await link();
    for (const other of [otherTenant, otherUser]) {
      await expect(service.complete(other, { challengeId: challenge.challengeId, proofToken, consent: true })).rejects.toMatchObject({ statusCode: 409 });
      expect(await service.list(other)).toEqual([]);
      expect(await service.resolveProof(other)).toBeUndefined();
      expect(await service.revoke(other, result.linkId)).toBe(false);
    }
    expect(await service.resolveProof(context)).toBeDefined();
  });

  it("expires both challenges and authorization and never refreshes silently", async () => {
    const { result } = await link();
    const challenge = await service.createChallenge(context);
    const proofToken = await sign(challenge);
    current = new Date(current.getTime() + 300_000);
    expect(await service.resolveProof(context)).toBeUndefined();
    expect(await service.list(context)).toEqual([expect.objectContaining({ linkId: result.linkId, state: "expired" })]);
    await expect(service.complete(context, { challengeId: challenge.challengeId, proofToken, consent: true })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("revoking an old link disconnects refreshed links and pending challenges", async () => {
    const original = await link();
    const refreshed = await link();
    const pending = await service.createChallenge(context);
    const proofToken = await sign(pending);
    expect(await service.revoke(context, original.result.linkId)).toBe(true);
    expect(await service.resolveProof(context)).toBeUndefined();
    expect((await service.list(context)).every(value => value.state === "revoked")).toBe(true);
    await expect(service.complete(context, { challengeId: pending.challengeId, proofToken, consent: true })).rejects.toMatchObject({ statusCode: 409 });
    expect(await service.revoke(context, refreshed.result.linkId)).toBe(true);
  });

  it("invalidates earlier pending challenges when another is issued", async () => {
    const first = await service.createChallenge(context);
    const proofToken = await sign(first);
    await service.createChallenge(context);
    await expect(service.complete(context, { challengeId: first.challengeId, proofToken, consent: true })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects tampered ciphertext, record scope, IDs, expiry, consent and provider metadata", async () => {
    await link();
    const record = (await store.list(context))[0]!;
    for (const changed of [
      { encryptedProof: record.encryptedProof.slice(0, -4) + "AAAA" }, { linkId: randomUUID() }, { tenantId: otherTenant.tenantId },
      { providerSubject: "user_another" }, { providerTenantId: "tenant_another" }, { providerOrganizationId: "org_another" },
      { proofId: randomUUID() }, { expiresAt: new Date(current.getTime() + 600_000).toISOString() },
      { consentedAt: "not-a-date" }, { consentedAt: new Date(current.getTime() + 1).toISOString() }, { revokedAt: current.toISOString() }
    ]) {
      const mock = vi.spyOn(store, "findActive").mockResolvedValue({ ...record, ...changed });
      expect(await service.resolveProof(context)).toBeUndefined();
      mock.mockRestore();
    }
  });

  it("does not resolve with a different encryption key or invalid clock", async () => {
    await link();
    const wrongKey = createIdentityLinkService({ ...config, encryptionKeyBase64: randomBytes(32).toString("base64") })!;
    expect(await wrongKey.resolveProof(context)).toBeUndefined();
    current = new Date("not-a-date");
    await expect(service.createChallenge(context)).rejects.toMatchObject({ code: "identity_links_unavailable" });
  });

  it("rechecks revocation after signature verification", async () => {
    await link();
    const record = (await store.list(context))[0]!;
    vi.spyOn(store, "findActive").mockResolvedValueOnce(record).mockResolvedValueOnce(undefined);
    expect(await service.resolveProof(context)).toBeUndefined();
  });
});
