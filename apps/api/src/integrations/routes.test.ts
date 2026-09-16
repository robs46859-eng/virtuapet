import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { MemoryPetRepository } from "../repository.js";
import { createLayer8PolicyClient, Layer8IntegrationError } from "./layer8.js";
import { createPawsome3DPreviewAdapter } from "./spatial.js";
import { createPawPathAdapter } from "./pawpath.js";

const userId = "04240ca7-5f6b-497b-89f8-dd4aad574a60";
const tenantId = "5a0a47a1-402e-437b-8082-f123402ab9d7";
const orderId = "27138277-7967-4059-b8ab-6041b2497e5d";
const headers = { authorization: "Bearer local-test-only" };
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
afterEach(async () => { await app?.close(); app = undefined; });
async function setup(member = true) {
  const repository = new MemoryPetRepository("test");
  if (member) await repository.createMembership({ membershipId: orderId, organizationId: tenantId, userId,
    role: "guardian", status: "active", createdAt: new Date().toISOString(), revokedAt: null });
  const integrations = { layer8: createLayer8PolicyClient(), spatial: createPawsome3DPreviewAdapter(), pawpath: createPawPathAdapter() };
  app = await buildApp({ environment: "test", repository, integrations,
    verifyPrincipal: async request => request.headers.authorization ? { userId, organizationId: tenantId, roles: ["platform_admin"] } : undefined });
  return { repository, integrations };
}
describe("integration routes", () => {
  it("protects all integration routes before any provider call", async () => {
    await setup();
    for (const request of [
      { method: "GET" as const, url: "/v1/integrations" },
      { method: "GET" as const, url: `/v1/integrations/pawsome3d/orders/${orderId}/preview` },
      { method: "POST" as const, url: "/v1/integrations/pawpath/nearby" }
    ]) expect((await app!.inject(request)).statusCode).toBe(401);
  });
  it("rejects forged elevated JWT roles when no server membership exists", async () => {
    await setup(false);
    const result = await app!.inject({ url: "/v1/integrations", headers });
    expect(result.statusCode).toBe(403);
    expect(result.json().error).toBe("active_membership_required");
  });
  it("reports configuration status without live verification or secret details", async () => {
    await setup();
    const result = await app!.inject({ url: "/v1/integrations", headers });
    expect(result.statusCode).toBe(200);
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.json()).toMatchObject({ liveVerified: false, providers: { Layer8: { enabled: false }, Judy: { state: "not_connected" } } });
    expect(result.body).not.toMatch(/bearerToken|serviceToken|tenantServiceTokens|identityProof|publicJwks/);
  });
  it("does not call a provider if Layer8 is disabled or denies", async () => {
    const { integrations } = await setup();
    const preview = vi.spyOn(integrations.spatial, "getPreview");
    const url = `/v1/integrations/pawsome3d/orders/${orderId}/preview`;
    expect((await app!.inject({ url, headers })).statusCode).toBe(503);
    vi.spyOn(integrations.layer8, "authorize").mockRejectedValue(new Layer8IntegrationError("layer8_denied", 403));
    expect((await app!.inject({ url, headers })).statusCode).toBe(403);
    expect(preview).not.toHaveBeenCalled();
  });
  it("derives policy scope from verified context, never tenant headers", async () => {
    const { integrations } = await setup();
    const authorize = vi.spyOn(integrations.layer8, "authorize").mockResolvedValue({ decisionId: orderId,
      policyVersion: "test", outcome: "allow", entitlements: ["spatial.preview"], expiresAt: new Date(Date.now() + 30000).toISOString(), correlationId: orderId });
    const preview = vi.spyOn(integrations.spatial, "getPreview").mockResolvedValue({ provider: "pawsome3d", userId, tenantId, orderId,
      preview: { url: "https://assets.example.com/model.glb", versionId: 1, expiresInSeconds: 30 }, usage: "visual_preview_only", clinicalUse: false });
    const response = await app!.inject({ url: `/v1/integrations/pawsome3d/orders/${orderId}/preview`,
      headers: { ...headers, "x-virtuapet-organization-id": orderId } });
    expect(response.statusCode).toBe(200);
    expect(authorize).toHaveBeenCalledWith(expect.objectContaining({ userId, tenantId, roles: ["guardian"] }),
      { action: "spatial.preview.read", resource: `pawsome3d:order:${orderId}`, purpose: "owner_visual_preview", requiredEntitlements: ["spatial.preview"] });
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({ tenantId }), orderId);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it("rejects malformed orders and unconsented location without contacting policy", async () => {
    const { integrations } = await setup();
    const policy = vi.spyOn(integrations.layer8, "authorize");
    expect((await app!.inject({ url: "/v1/integrations/pawsome3d/orders/not-an-id/preview", headers })).statusCode).toBe(400);
    expect((await app!.inject({ method: "POST", url: "/v1/integrations/pawpath/nearby", headers,
      payload: { latitude: 39.7, longitude: -104.9 } })).statusCode).toBe(400);
    expect(policy).not.toHaveBeenCalled();
  });
  it("calls nearby only after a bound policy grant with explicit location consent", async () => {
    const { integrations } = await setup();
    const authorize = vi.spyOn(integrations.layer8, "authorize").mockResolvedValue({ decisionId: orderId, policyVersion: "test", outcome: "allow",
      entitlements: ["pawpath.community"], expiresAt: new Date(Date.now() + 30000).toISOString(), correlationId: orderId });
    const nearby = vi.spyOn(integrations.pawpath, "nearby").mockResolvedValue({ users: [], source: "pawpath" });
    const response = await app!.inject({ method: "POST", url: "/v1/integrations/pawpath/nearby", headers,
      payload: { latitude: 39.7, longitude: -104.9, shareLocation: true } });
    expect(response.statusCode).toBe(200);
    expect(authorize).toHaveBeenCalledWith(expect.objectContaining({ tenantId }), expect.objectContaining({ resource: `pawpath:user:${userId}`, requiredEntitlements: ["pawpath.community"] }));
    expect(nearby).toHaveBeenCalledWith(expect.objectContaining({ userId }), { latitude: 39.7, longitude: -104.9, radiusMeters: 5000, shareLocation: true });
  });
  it("redacts unexpected provider errors", async () => {
    const { integrations } = await setup();
    vi.spyOn(integrations.layer8, "authorize").mockRejectedValue(new Error("private provider token must not escape"));
    const response = await app!.inject({ url: `/v1/integrations/pawsome3d/orders/${orderId}/preview`, headers });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "integration_unavailable" });
  });
});
