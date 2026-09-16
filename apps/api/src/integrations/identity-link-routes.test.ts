import { randomBytes, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { MemoryPetRepository } from "../repository.js";
import { createIdentityLinkService, type IdentityLinkService } from "./identity-links.js";
import { MemoryIdentityLinkStore } from "./identity-link-store.js";
import { registerIdentityLinkRoutes } from "./identity-link-routes.js";

const userId = "04240ca7-5f6b-497b-89f8-dd4aad574a60";
const tenantId = "5a0a47a1-402e-437b-8082-f123402ab9d7";
const headers = { authorization: "Bearer local-test-only" };
const base = "/v1/integrations/layer8/links";
const issuer = "https://layer8.example.test";
let app: FastifyInstance;
let repository: MemoryPetRepository;
let service: IdentityLinkService;
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
beforeEach(async () => {
  keys = await generateKeyPair("ES256");
  repository = new MemoryPetRepository("test");
  service = createIdentityLinkService({ enabled: true, store: new MemoryIdentityLinkStore(), issuer, audience: "virtuapet-links", pinnedKid: "fixture-key",
    publicJwks: { keys: [{ ...await exportJWK(keys.publicKey), kid: "fixture-key", alg: "ES256" }] }, encryptionKeyBase64: randomBytes(32).toString("base64") })!;
});
afterEach(async () => { await app?.close(); });
async function setup(options: { member?: boolean; enabled?: boolean } = {}) {
  if (options.member !== false) await repository.createMembership({ membershipId: randomUUID(), organizationId: tenantId, userId,
    role: "guardian", status: "active", createdAt: new Date().toISOString(), revokedAt: null });
  app = Fastify();
  app.addHook("onRequest", async request => {
    if (request.headers.authorization) request.principal = { userId, organizationId: tenantId, roles: ["platform_admin"] };
  });
  await registerIdentityLinkRoutes(app, repository, options.enabled === false ? undefined : service);
}
async function proof(challenge: { challengeId: string; nonce: string }) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ iss: issuer, aud: "virtuapet-links", sub: userId, tenantId, protocol: "virtuapet.layer8.link.v1", iat: now, exp: now + 300, jti: randomUUID(),
    challengeId: challenge.challengeId, nonce: challenge.nonce, providerSubject: "user_provider", providerTenantId: "tenant_provider", providerOrganizationId: "org_provider" })
    .setProtectedHeader({ alg: "ES256", kid: "fixture-key", typ: "vp-layer8-link+jwt" }).sign(keys.privateKey);
}

describe("Layer8 account-link routes", () => {
  it("requires authentication and active server membership on every endpoint", async () => {
    await setup({ member: false });
    for (const request of [{ method: "GET" as const, url: base }, { method: "POST" as const, url: `${base}/challenges` },
      { method: "POST" as const, url: `${base}/complete` }, { method: "DELETE" as const, url: `${base}/${randomUUID()}` }]) {
      expect((await app.inject(request)).statusCode).toBe(401);
      expect((await app.inject({ ...request, headers })).statusCode).toBe(403);
    }
  });
  it("reports unavailable without touching providers when disabled", async () => {
    await setup({ enabled: false });
    expect((await app.inject({ url: base, headers })).statusCode).toBe(503);
    expect((await app.inject({ method: "POST", url: `${base}/challenges`, headers })).json()).toEqual({ error: "identity_links_unavailable" });
  });
  it("completes challenge -> signed proof -> safe listing -> revoke end to end", async () => {
    await setup();
    const challengeResponse = await app.inject({ method: "POST", url: `${base}/challenges`, headers: { ...headers, "x-virtuapet-organization-id": randomUUID() }, payload: {} });
    expect(challengeResponse.statusCode).toBe(201);
    const challenge = challengeResponse.json();
    expect(challenge).toMatchObject({ subject: userId, tenantId });
    const proofToken = await proof(challenge);
    const complete = await app.inject({ method: "POST", url: `${base}/complete`, headers, payload: { challengeId: challenge.challengeId, proofToken, consent: true } });
    expect(complete.statusCode).toBe(201);
    const linkId = complete.json().linkId;
    const listing = await app.inject({ url: base, headers });
    expect(listing.json()).toMatchObject({ links: [{ linkId, provider: "layer8", state: "active" }] });
    expect(listing.body).not.toMatch(/proof|user_provider|tenant_provider|org_provider/);
    expect(listing.headers["cache-control"]).toBe("no-store");
    expect((await app.inject({ method: "DELETE", url: `${base}/${linkId}`, headers })).statusCode).toBe(204);
    expect((await app.inject({ url: base, headers })).json().links[0].state).toBe("revoked");
  });
  it("rejects caller-selected identity fields and absent or false consent", async () => {
    await setup();
    for (const payload of [{ tenantId: randomUUID() }, { subject: randomUUID() }, { providerSubject: "user_forged" }]) {
      expect((await app.inject({ method: "POST", url: `${base}/challenges`, headers, payload })).statusCode).toBe(400);
    }
    const challenge = (await app.inject({ method: "POST", url: `${base}/challenges`, headers })).json();
    const proofToken = await proof(challenge);
    for (const payload of [{ challengeId: challenge.challengeId, proofToken }, { challengeId: challenge.challengeId, proofToken, consent: false },
      { challengeId: challenge.challengeId, proofToken, consent: true, providerSubject: "user_forged" }]) {
      expect((await app.inject({ method: "POST", url: `${base}/complete`, headers, payload })).statusCode).toBe(400);
    }
  });
  it("fails replay, malformed IDs, and missing link targets safely", async () => {
    await setup();
    const challenge = (await app.inject({ method: "POST", url: `${base}/challenges`, headers })).json();
    const payload = { challengeId: challenge.challengeId, proofToken: await proof(challenge), consent: true };
    expect((await app.inject({ method: "POST", url: `${base}/complete`, headers, payload })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: `${base}/complete`, headers, payload })).statusCode).toBe(409);
    expect((await app.inject({ method: "DELETE", url: `${base}/not-a-uuid`, headers })).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: `${base}/${randomUUID()}`, headers })).statusCode).toBe(404);
  });
  it("rechecks membership after an account has been connected", async () => {
    await setup();
    const challenge = (await app.inject({ method: "POST", url: `${base}/challenges`, headers })).json();
    await app.inject({ method: "POST", url: `${base}/complete`, headers, payload: { challengeId: challenge.challengeId, proofToken: await proof(challenge), consent: true } });
    vi.spyOn(repository, "findMembership").mockResolvedValue(undefined);
    expect((await app.inject({ url: base, headers })).statusCode).toBe(403);
  });
  it("redacts unexpected storage failures", async () => {
    await setup();
    vi.spyOn(service, "list").mockRejectedValue(new Error("database password secret proofToken upstream url"));
    const response = await app.inject({ url: base, headers });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "identity_links_unavailable" });
  });
});
