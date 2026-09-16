import { describe, expect, it, vi } from "vitest";
import { signSpatialAssetManifest, type UnsignedSpatialAssetManifest } from "@virtuapet/contracts";
import type { IntegrationContext } from "./context.js";
import {
  createPawsome3DPreviewAdapter,
  validateGibiWorldHandoff,
  type GibiWorldHandoffOptions,
  type Pawsome3DPreviewConfig,
  type SpatialDelegation,
} from "./spatial.js";

const context: IntegrationContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  roles: ["clinic_admin"],
  correlationId: "33333333-3333-4333-8333-333333333333",
};
const orderId = "44444444-4444-4444-8444-444444444444";
const otherTenant = "55555555-5555-4555-8555-555555555555";
const config: Pawsome3DPreviewConfig = {
  enabled: true,
  baseUrl: "https://provider.example.com",
  allowedAssetOrigins: ["https://assets.example.com"],
};
const delegation: SpatialDelegation = { provider: "pawsome3d", ...context, orderId, bearerToken: "dedicated-provider-token" };
const preview = { url: "https://assets.example.com/private/model.glb?signature=short-lived", versionId: 4, expiresInSeconds: 300 };
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function adapter(response = jsonResponse(preview), configOverrides: Partial<Pawsome3DPreviewConfig> = {}, link: SpatialDelegation | undefined = delegation) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
  const client = createPawsome3DPreviewAdapter({ ...config, ...configOverrides }, {
    fetch: fetcher,
    resolveDelegation: async () => link,
  });
  return { client, fetcher };
}

describe("Pawsome3D read-only preview bridge", () => {
  it("reports configured-but-unverified status without contacting the provider", () => {
    const { client, fetcher } = adapter();
    expect(client.status()).toEqual({ provider: "pawsome3d", enabled: true, configured: true, state: "configured_unverified" });
    expect(createPawsome3DPreviewAdapter().status().state).toBe("disabled");
    expect(createPawsome3DPreviewAdapter(config).status().state).toBe("not_configured");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("snapshots configuration so later endpoint and allowlist mutations have no effect", async () => {
    const localConfig = { ...config, allowedAssetOrigins: ["https://assets.example.com"] };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(preview));
    const client = createPawsome3DPreviewAdapter(localConfig, { resolveDelegation: async () => delegation, fetch: fetcher });
    localConfig.baseUrl = "https://attacker.example.com";
    localConfig.allowedAssetOrigins[0] = "https://attacker.example.com";
    await expect(client.getPreview(context, orderId)).resolves.toMatchObject({ preview });
    expect(fetcher.mock.calls[0]?.[0]).toContain("https://provider.example.com/");
  });

  it("defaults off without network access", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(createPawsome3DPreviewAdapter({}, { fetch: fetcher }).getPreview(context, orderId))
      .rejects.toMatchObject({ code: "spatial_integration_disabled", statusCode: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires an explicit provider identity link", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(createPawsome3DPreviewAdapter(config, { fetch: fetcher }).getPreview(context, orderId))
      .rejects.toMatchObject({ code: "spatial_not_configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the observed GET endpoint and a dedicated provider token without forwarding context headers", async () => {
    const { client, fetcher } = adapter();
    const result = await client.getPreview(context, orderId);
    expect(result).toMatchObject({ orderId, tenantId: context.tenantId, preview, clinicalUse: false, usage: "visual_preview_only" });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      `https://provider.example.com/api/pet-glb/orders/${orderId}/stages/current/preview`,
      expect.objectContaining({ method: "GET", redirect: "manual", headers: { authorization: "Bearer dedicated-provider-token", accept: "application/json" } }),
    );
    expect(JSON.stringify(result)).not.toContain(delegation.bearerToken);
  });

  it.each([
    { tenantId: otherTenant },
    { userId: otherTenant },
    { orderId: otherTenant },
    { bearerToken: "Bearer\r\nCookie: fake" },
  ])("rejects forged or cross-scope delegations before any provider request: %j", async (override) => {
    const { client, fetcher } = adapter(jsonResponse(preview), {}, { ...delegation, ...override });
    await expect(client.getPreview(context, orderId)).rejects.toMatchObject({ code: "spatial_delegation_denied", statusCode: 403 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["../operator/orders", "?order=foo", "not-a-uuid"])("rejects malformed order IDs %s", async (id) => {
    const { client, fetcher } = adapter();
    await expect(client.getPreview(context, id)).rejects.toMatchObject({ code: "spatial_invalid_order" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([{ roles: [] }, { correlationId: "forged" }])("validates the full integration context %j", async (override) => {
    const { client, fetcher } = adapter();
    await expect(client.getPreview({ ...context, ...override }, orderId)).rejects.toMatchObject({ code: "spatial_invalid_context" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401, "spatial_provider_unauthorized", 424],
    [403, "spatial_order_unavailable", 404],
    [404, "spatial_order_unavailable", 404],
    [500, "spatial_provider_unavailable", 502],
    [302, "spatial_provider_unavailable", 502],
  ])("fails closed on provider status %i", async (status, code, statusCode) => {
    const { client, fetcher } = adapter(jsonResponse({ secret: "must-not-leak" }, status as number));
    await expect(client.getPreview(context, orderId)).rejects.toMatchObject({ code, statusCode });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...preview, versionId: -1 },
    { ...preview, expiresInSeconds: 0 },
    { ...preview, expiresInSeconds: 86400 },
    { ...preview, rawSecret: "never-forward-extra-fields" },
    { arbitrary: "not-a-preview" },
  ])("rejects malformed provider payloads %j", async (body) => {
    await expect(adapter(jsonResponse(body)).client.getPreview(context, orderId)).rejects.toMatchObject({ code: "spatial_invalid_response" });
  });

  it.each([
    "http://assets.example.com/model.glb",
    "https://user:password@assets.example.com/model.glb",
    "https://127.0.0.1/model.glb",
    "https://[::1]/model.glb",
    "https://assets.example.com/model.glb#fragment",
    "https://assets.example.com:8443/model.glb",
    "https://assets.example.com.attacker.com/model.glb",
  ])("rejects unsafe/unapproved asset URLs %s", async (url) => {
    await expect(adapter(jsonResponse({ ...preview, url })).client.getPreview(context, orderId)).rejects.toMatchObject({ statusCode: 502 });
  });

  it.each(["http://provider.example.com", "https://localhost", "https://169.254.169.254", "https://provider.example.com/path"])(
    "rejects unsafe provider configuration %s", async (baseUrl) => {
      const { client, fetcher } = adapter(jsonResponse(preview), { baseUrl });
      await expect(client.getPreview(context, orderId)).rejects.toBeInstanceOf(Error);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("limits streamed responses, including without content length", async () => {
    const { client } = adapter(jsonResponse({ padding: "a".repeat(2048) }), { maxResponseBytes: 128 });
    await expect(client.getPreview(context, orderId)).rejects.toMatchObject({ code: "spatial_response_too_large" });
  });

  it("times out even a provider fetch that never resolves", async () => {
    const client = createPawsome3DPreviewAdapter({ ...config, timeoutMs: 5 }, {
      resolveDelegation: async () => delegation,
      fetch: vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => undefined)),
    });
    await expect(client.getPreview(context, orderId)).rejects.toMatchObject({ code: "spatial_provider_timeout", statusCode: 504 });
  });

  it("times out a stalled account resolver and never starts a late provider request", async () => {
    let finish: (value: SpatialDelegation) => void = () => undefined;
    const stalled = new Promise<SpatialDelegation>(resolve => { finish = resolve; });
    const fetcher = vi.fn<typeof fetch>();
    const client = createPawsome3DPreviewAdapter({ ...config, timeoutMs: 5 }, {
      resolveDelegation: () => stalled, fetch: fetcher,
    });
    await expect(client.getPreview(context, orderId)).rejects.toMatchObject({ code: "spatial_provider_timeout" });
    finish(delegation);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not expose network errors containing URLs or credentials", async () => {
    const client = createPawsome3DPreviewAdapter(config, {
      resolveDelegation: async () => delegation,
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error("secret-provider-token and signed-url")),
    });
    await expect(client.getPreview(context, orderId)).rejects.toThrow(/^spatial_provider_unavailable$/);
  });
});

const signingKey = "server-only-test-key-not-a-live-secret";
const unsigned: UnsignedSpatialAssetManifest = {
  manifestVersion: "2.0.0", assetId: orderId, version: 1, ownerId: context.userId, tenantId: context.tenantId,
  source: "Pawsome3D", provenance: {
    generator: "test-fixture", generatedAt: "2026-09-15T00:00:00Z", sourceHash: "a".repeat(64),
    sourceReference: orderId, lineage: ["source", "mesh"],
  },
  glbUri: "https://assets.example.com/model.glb", sha256: "b".repeat(64), units: "m", scale: 1,
  upAxis: "Y_UP", forwardAxis: "Z_FORWARD", laterality: "not_applicable",
  bounds: { min: [-1, -1, -1], max: [1, 1, 1] }, origin: [0, 0, 0],
  supportedAnimationClips: ["idle"], entitlementRequirements: ["spatial.asset.view"],
  expiresAt: "2026-09-16T00:00:00Z", revokedAt: null, isRevoked: false,
  minClientVersion: "1.0.0", rollbackVersion: null,
};
const handoffOptions: GibiWorldHandoffOptions = {
  verificationKey: signingKey, actualSha256: unsigned.sha256, clientVersion: "1.0.0",
  grantedEntitlements: ["spatial.asset.view"], supportedUnits: ["m"], supportedUpAxes: ["Y_UP"],
  supportedForwardAxes: ["Z_FORWARD"], expectedLaterality: "not_applicable",
  allowedAssetOrigins: ["https://assets.example.com"], now: new Date("2026-09-15T12:00:00Z"),
};

describe("server-side GibiWorld handoff preflight", () => {
  it("requires all gates and returns no HMAC signature or verification secret", () => {
    const result = validateGibiWorldHandoff(signSpatialAssetManifest(unsigned, signingKey), context, handoffOptions);
    expect(result.clinicalUse).toBe(false);
    expect(result.manifest).toEqual(unsigned);
    expect(JSON.stringify(result)).not.toContain(signingKey);
    expect(result.manifest).not.toHaveProperty("signature");
  });

  it.each([
    { actualSha256: "" },
    { verificationKey: "" },
    { supportedUnits: [] },
    { clientVersion: "wrong" },
    { now: new Date("invalid") },
  ])("rejects missing or invalid mandatory runtime gate %j", (override) => {
    expect(() => validateGibiWorldHandoff(signSpatialAssetManifest(unsigned, signingKey), context, { ...handoffOptions, ...override }))
      .toThrow("spatial_handoff_context_incomplete");
  });

  it.each([
    { grantedEntitlements: [] },
    { actualSha256: "a".repeat(64) },
    { clientVersion: "0.0.1" },
    { supportedUnits: ["mm"] as const },
    { now: new Date("2026-09-17T00:00:00Z") },
  ])("rejects failed gate %j", (override) => {
    expect(() => validateGibiWorldHandoff(signSpatialAssetManifest(unsigned, signingKey), context,
      { ...handoffOptions, ...override } as GibiWorldHandoffOptions)).toThrow("spatial_manifest_rejected");
  });

  it("rejects a correctly signed manifest from another tenant", () => {
    expect(() => validateGibiWorldHandoff(signSpatialAssetManifest({ ...unsigned, tenantId: otherTenant }, signingKey), context, handoffOptions))
      .toThrow("spatial_manifest_scope_denied");
  });

  it("rejects revoked manifests", () => {
    expect(() => validateGibiWorldHandoff(signSpatialAssetManifest({ ...unsigned, isRevoked: true, revokedAt: "2026-09-15T10:00:00Z" }, signingKey), context, handoffOptions))
      .toThrow("spatial_manifest_rejected");
  });
});
