import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet, type JWTPayload } from "jose";
import type { IntegrationContext } from "./context.js";
import { createLayer8PolicyClient, layer8ConfigFromEnvironment, LAYER8_POLICY_PROTOCOL,
  type Layer8PolicyConfig, type Layer8IdentityProof, type Layer8PolicyDependencies } from "./layer8.js";

const context: IntegrationContext = {
  userId: "04240ca7-5f6b-497b-89f8-dd4aad574a60", tenantId: "5a0a47a1-402e-437b-8082-f123402ab9d7",
  roles: ["veterinarian"], correlationId: "394c6b7d-d2bf-49e1-acbf-e9490b990146"
};
const request = { action: "spatial.read", resource: "asset:unit-test", purpose: "consumer_preview", requiredEntitlements: ["spatial.asset.view"] };
const nowSeconds = 1_800_000_000;
const identityProof = "verified.identity.proof";
const resolveIdentityProof = async () => ({ proofToken: identityProof });
const tenantToken = "unit-test-tenant-service-token-only";
const otherTenantId = "27138277-7967-4059-b8ab-6041b2497e5d";
let privateKey: CryptoKey;
let publicJwks: JSONWebKeySet;
beforeAll(async () => {
  const keys = await generateKeyPair("ES256");
  privateKey = keys.privateKey;
  publicJwks = { keys: [{ ...await exportJWK(keys.publicKey), kid: "test-policy-key", alg: "ES256", use: "sig" }] };
});
afterEach(() => { vi.useRealTimers(); });
function config(overrides: Partial<Layer8PolicyConfig> = {}): Layer8PolicyConfig {
  return { enabled: true, endpoint: "https://policy.example.com/v1/virtuapet/policy",
    tenantServiceTokens: { [context.tenantId]: tenantToken },
    issuer: "https://policy.example.com", audience: "virtuapet-api", publicJwks, ...overrides };
}
function provider(claims: Record<string, unknown> = {}, signer?: CryptoKey, protectedHeader: { alg: string; kid?: string; typ?: string } = { alg: "ES256", kid: "test-policy-key", typ: "vp-layer8-policy+jwt" }): typeof fetch {
  return vi.fn(async (_input, options) => {
    const body = JSON.parse(String(options?.body));
    const payload: JWTPayload = {
      iss: "https://policy.example.com", aud: "virtuapet-api", sub: body.subject,
      iat: nowSeconds, exp: nowSeconds + 30, jti: "8b149ab0-04a6-4b4f-8c69-ff50613e2705",
      protocol: LAYER8_POLICY_PROTOCOL, tenantId: body.tenantId, correlationId: body.correlationId,
      requestId: body.requestId, action: body.action, resource: body.resource, purpose: body.purpose,
      policyVersion: "test-only-v1", outcome: "allow", entitlements: ["spatial.asset.view"], obligations: [], ...claims
    };
    const decisionToken = await new SignJWT(payload).setProtectedHeader(protectedHeader).sign(signer ?? privateKey);
    return Response.json({ decisionToken });
  });
}
function client(fetcher: typeof fetch = provider(), overrides: Partial<Layer8PolicyConfig> = {},
  dependencies: Layer8PolicyDependencies = {}) {
  return createLayer8PolicyClient(config(overrides), { fetch: fetcher, now: () => new Date(nowSeconds * 1000),
    resolveIdentityProof, ...dependencies });
}

describe("Layer8 signed-policy adapter", () => {
  it("is default off, reports the stable protocol, and sends no request while disabled", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const adapter = createLayer8PolicyClient({}, { fetch: fetcher });
    expect(LAYER8_POLICY_PROTOCOL).toBe("virtuapet.layer8.policy.v1");
    expect(adapter.status()).toEqual({ enabled: false, configured: false, state: "disabled", protocol: LAYER8_POLICY_PROTOCOL });
    await expect(adapter.authorize(context, request)).rejects.toMatchObject({ code: "layer8_disabled", httpStatus: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts only an exact, current, asymmetrically signed decision and uses server credentials only", async () => {
    const fetcher = provider();
    const decision = await client(fetcher).authorize(context, request);
    expect(decision).toMatchObject({ outcome: "allow", policyVersion: "test-only-v1", entitlements: ["spatial.asset.view"], correlationId: context.correlationId });
    expect(decision.expiresAt).toBe(new Date((nowSeconds + 30) * 1000).toISOString());
    expect(fetcher).toHaveBeenCalledOnce();
    const [, options] = vi.mocked(fetcher).mock.calls[0]!;
    expect(options).toMatchObject({ method: "POST", redirect: "error" });
    const body = JSON.parse(String(options?.body));
    expect(body).not.toHaveProperty("roles");
    expect(body).toMatchObject({ protocol: "virtuapet.layer8.policy.v1", identityProof });
    expect(options?.headers).toMatchObject({ authorization: `Bearer ${tenantToken}` });
    expect(decision).not.toHaveProperty("decisionToken");
    expect(decision).not.toHaveProperty("identityProof");
  });

  it.each([
    { endpoint: "http://policy.example.com" }, { endpoint: "https://user:password@policy.example.com" },
    { endpoint: "https://policy.example.com/?key=secret" }, { endpoint: "https://policy.example.com/#key" },
    { endpoint: "https://policy.example.com:8443" }, { tenantServiceTokens: { [context.tenantId]: "unsafe\r\nheader" } },
    { tenantServiceTokens: {} }, { tenantServiceTokens: { "not-a-tenant": tenantToken } },
    { tenantServiceTokens: { [context.tenantId.toUpperCase()]: tenantToken } },
    { endpoint: "https://127.0.0.1/policy" }, { endpoint: "https://[::1]/policy" },
    { endpoint: "https://metadata.internal/policy" }, { endpoint: "https://localhost/policy" },
    { endpoint: "https://service.local/policy" },
    { publicJwks: { keys: [] } }, { timeoutMs: 0 }, { timeoutMs: 30001 }, { maxResponseBytes: 500000 },
    { publicJwks: { keys: [{ kty: "oct", k: "a-secret", kid: "unsafe", alg: "HS256" }] } }
  ])("rejects unsafe or incomplete configuration: %j", async override => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(client(fetcher, override).authorize(context, request)).rejects.toMatchObject({ code: "layer8_unconfigured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not accept a private signing key in verification configuration", async () => {
    await expect(client(provider(), { publicJwks: { keys: [{ ...publicJwks.keys[0]!, d: "private-material" }] } }).authorize(context, request))
      .rejects.toMatchObject({ code: "layer8_unconfigured" });
  });

  it("selects a dedicated credential for each tenant and resolves their own identity proof", async () => {
    const fetcher = provider();
    const resolver = vi.fn(async (current: IntegrationContext) => ({ proofToken: `${current.tenantId}.linked.proof` }));
    const adapter = client(fetcher, { tenantServiceTokens: { [context.tenantId]: tenantToken,
      [otherTenantId]: "unit-test-other-tenant-key" } }, { resolveIdentityProof: resolver });
    await adapter.authorize(context, request);
    await adapter.authorize({ ...context, tenantId: otherTenantId }, request);
    for (const [index, tenantId, token] of [[0, context.tenantId, tenantToken],
      [1, otherTenantId, "unit-test-other-tenant-key"]] as const) {
      const [, options] = vi.mocked(fetcher).mock.calls[index]!;
      expect(options?.headers).toMatchObject({ authorization: `Bearer ${token}` });
      expect(JSON.parse(String(options?.body))).toMatchObject({ tenantId, identityProof: `${tenantId}.linked.proof` });
      expect(resolver.mock.calls[index]![0]).toMatchObject({ tenantId, userId: context.userId });
    }
  });

  it("never falls back to another tenant credential or a legacy global token", async () => {
    const fetcher = provider();
    const resolver = vi.fn(resolveIdentityProof);
    const withLegacyToken = { ...config(), serviceToken: "legacy-global-token" };
    const adapter = createLayer8PolicyClient(withLegacyToken, { fetch: fetcher, resolveIdentityProof: resolver });
    await expect(adapter.authorize({ ...context, tenantId: otherTenantId }, request))
      .rejects.toMatchObject({ code: "layer8_tenant_unconfigured", httpStatus: 503 });
    expect(resolver).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();

    const { tenantServiceTokens: _unused, ...legacyConfig } = withLegacyToken;
    await expect(createLayer8PolicyClient(legacyConfig, { fetch: fetcher, resolveIdentityProof: resolver }).authorize(context, request))
      .rejects.toMatchObject({ code: "layer8_unconfigured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires an identity resolver before reporting configuration usable", async () => {
    const fetcher = provider();
    const adapter = createLayer8PolicyClient(config(), { fetch: fetcher });
    expect(adapter.status()).toMatchObject({ configured: false, state: "unconfigured" });
    await expect(adapter.authorize(context, request)).rejects.toMatchObject({ code: "layer8_unconfigured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([undefined, { proofToken: "" }, { proofToken: "not-a-proof" },
    { proofToken: "unsafe.proof.\n" }, { proofToken: `a.b.${"c".repeat(15000)}` }])(
    "refuses missing or malformed identity evidence before network activity: %j", async proof => {
      const fetcher = provider();
      await expect(client(fetcher, {}, { resolveIdentityProof: async () => proof }).authorize(context, request))
        .rejects.toMatchObject({ code: "layer8_identity_required", httpStatus: 403 });
      expect(fetcher).not.toHaveBeenCalled();
    }
  );

  it("redacts resolver failures and makes no provider request", async () => {
    const fetcher = provider();
    await expect(client(fetcher, {}, { resolveIdentityProof: async () => { throw new Error("private proof and token"); } })
      .authorize(context, request)).rejects.toMatchObject({ message: "layer8_identity_unavailable", httpStatus: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("snapshots keys and resolver dependencies, and isolates the context passed to the resolver", async () => {
    const supplied = config();
    const fetcher = provider();
    const resolver = vi.fn(async (current: IntegrationContext) => {
      current.tenantId = otherTenantId;
      current.userId = otherTenantId;
      return { proofToken: identityProof };
    });
    const dependencies = { fetch: fetcher, resolveIdentityProof: resolver, now: () => new Date(nowSeconds * 1000) };
    const adapter = createLayer8PolicyClient(supplied, dependencies);
    supplied.tenantServiceTokens![context.tenantId] = "replaced-tenant-token";
    supplied.endpoint = "https://replaced.example.com";
    supplied.publicJwks = { keys: [] };
    dependencies.resolveIdentityProof = vi.fn(async () => ({ proofToken: "changed.proof.token" }));
    await expect(adapter.authorize(context, request)).resolves.toHaveProperty("outcome", "allow");
    expect(resolver).toHaveBeenCalledOnce();
    expect(dependencies.resolveIdentityProof).not.toHaveBeenCalled();
    const [url, options] = vi.mocked(fetcher).mock.calls[0]!;
    expect(url).toBe("https://policy.example.com/v1/virtuapet/policy");
    expect(options?.headers).toMatchObject({ authorization: `Bearer ${tenantToken}` });
    expect(JSON.parse(String(options?.body))).toMatchObject({ tenantId: context.tenantId, subject: context.userId, identityProof });
  });

  it.each([
    { tenantId: "27138277-7967-4059-b8ab-6041b2497e5d" }, { sub: "27138277-7967-4059-b8ab-6041b2497e5d" },
    { action: "billing.charge" }, { resource: "asset:different" }, { purpose: "surgery" },
    { action: "spatial.read " }, { purpose: "consumer_preview\n" },
    { correlationId: "27138277-7967-4059-b8ab-6041b2497e5d" }, { requestId: "27138277-7967-4059-b8ab-6041b2497e5d" },
    { exp: nowSeconds }, { iat: nowSeconds + 1 }, { exp: nowSeconds + 61 },
    { iat: nowSeconds - 120, exp: nowSeconds + 1 }, { nbf: nowSeconds + 1 },
    { iss: "https://attacker.example.com" }, { aud: "other-product" }, { protocol: "unknown" },
    { protocol: "virtuapet.layer8.policy.v1.proposed" },
    { unexpectedAuthority: "admin" }
  ])("fails closed for mismatched, stale, or unknown evidence: %j", async claims => {
    await expect(client(provider(claims)).authorize(context, request)).rejects.toMatchObject({ code: "layer8_invalid_evidence", httpStatus: 503 });
  });

  it.each([{ outcome: "deny" }, { entitlements: [] }, { obligations: [{ require: "human_approval" }] }])(
    "denies refused, insufficient, or unimplemented-obligation decisions: %j", async claims => {
      await expect(client(provider(claims)).authorize(context, request)).rejects.toMatchObject({ code: "layer8_denied", httpStatus: 403 });
    }
  );

  it("rejects a signature from an untrusted private key", async () => {
    const other = await generateKeyPair("ES256");
    await expect(client(provider({}, other.privateKey)).authorize(context, request)).rejects.toMatchObject({ code: "layer8_invalid_evidence" });
  });

  it.each([
    { alg: "ES256", typ: "vp-layer8-policy+jwt" },
    { alg: "ES256", kid: "test-policy-key" },
    { alg: "ES256", kid: "test-policy-key", typ: "JWT" }
  ])("requires the exact signed header and key identity: %j", async protectedHeader => {
    await expect(client(provider({}, undefined, protectedHeader)).authorize(context, request)).rejects.toMatchObject({ code: "layer8_invalid_evidence" });
  });

  it("uses a fresh nonce so a captured decision cannot authorize another call", async () => {
    let captured: string | undefined;
    const actual = provider();
    const fetcher: typeof fetch = async (...args) => {
      captured ??= await (await actual(...args)).text();
      return new Response(captured, { headers: { "content-type": "application/json" } });
    };
    const adapter = client(fetcher);
    await expect(adapter.authorize(context, request)).resolves.toHaveProperty("outcome", "allow");
    await expect(adapter.authorize(context, request)).rejects.toMatchObject({ code: "layer8_invalid_evidence" });
  });

  it("bounds the whole operation including an unresponsive transport", async () => {
    let signal: AbortSignal | null | undefined;
    const fetcher: typeof fetch = async (_url, options) => { signal = options?.signal; return new Promise(() => {}); };
    await expect(client(fetcher, { timeoutMs: 5 }).authorize(context, request)).rejects.toMatchObject({ code: "layer8_timeout" });
    expect(signal?.aborted).toBe(true);
  });

  it("includes proof resolution in the deadline and never fetches after a late proof", async () => {
    vi.useFakeTimers();
    let releaseProof: (proof: Layer8IdentityProof) => void = () => { throw new Error("resolver not started"); };
    const fetcher = provider();
    const resolver = vi.fn(() => new Promise<Layer8IdentityProof>(resolve => { releaseProof = resolve; }));
    const operation = client(fetcher, { timeoutMs: 20 }, { resolveIdentityProof: resolver }).authorize(context, request);
    const timedOut = expect(operation).rejects.toMatchObject({ code: "layer8_timeout", httpStatus: 503 });
    await vi.advanceTimersByTimeAsync(20);
    await timedOut;
    releaseProof({ proofToken: identityProof });
    await vi.advanceTimersByTimeAsync(1);
    expect(resolver).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the remaining deadline for fetch after a slow proof lookup", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const fetcher = vi.fn<typeof fetch>(async (_url, options) => { signal = options?.signal; return new Promise(() => {}); });
    const resolver = async () => new Promise<Layer8IdentityProof>(resolve => {
      setTimeout(() => resolve({ proofToken: identityProof }), 15);
    });
    const operation = client(fetcher, { timeoutMs: 20 }, { resolveIdentityProof: resolver }).authorize(context, request);
    const timedOut = expect(operation).rejects.toMatchObject({ code: "layer8_timeout" });
    await vi.advanceTimersByTimeAsync(15);
    expect(fetcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5);
    await timedOut;
    expect(signal?.aborted).toBe(true);
  });

  it("bounds a stalled response body, not just response headers", async () => {
    const fetcher: typeof fetch = async () => new Response(new ReadableStream({ start() {} }), { headers: { "content-type": "application/json" } });
    await expect(client(fetcher, { timeoutMs: 5 }).authorize(context, request)).rejects.toMatchObject({ code: "layer8_timeout" });
  });

  it.each(["oversize-declared", "oversize-stream", "malformed-json", "malformed-envelope", "wrong-type", "unavailable", "redirect"]) (
    "rejects unsafe response %s", async kind => {
      const fetcher: typeof fetch = async () => {
        if (kind === "unavailable") return new Response("provider internal secret", { status: 503 });
        if (kind === "redirect") return new Response(null, { status: 302, headers: { location: "https://other.example.com" } });
        if (kind === "wrong-type") return new Response("{}", { headers: { "content-type": "text/html" } });
        if (kind === "malformed-json") return new Response("bad-json-private", { headers: { "content-type": "application/json" } });
        if (kind === "malformed-envelope") return Response.json({ allow: true });
        return new Response("x".repeat(17000), { headers: { "content-type": "application/json", ...(kind === "oversize-declared" ? { "content-length": "17000" } : {}) } });
      };
      await expect(client(fetcher).authorize(context, request)).rejects.toThrow(/^layer8_/);
      await expect(client(fetcher).authorize(context, request)).rejects.not.toThrow(/private|secret/);
    }
  );

  it("rejects malformed context before network activity", async () => {
    const fetcher = provider();
    await expect(client(fetcher).authorize({ ...context, roles: [] }, request)).rejects.toMatchObject({ code: "layer8_invalid_request", httpStatus: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied proof and credentials in policy requests", async () => {
    const fetcher = provider();
    await expect(client(fetcher).authorize(context, { ...request, identityProof } as typeof request))
      .rejects.toMatchObject({ code: "layer8_invalid_request" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not expose or silently enable environment configuration", async () => {
    const fromEnv = layer8ConfigFromEnvironment({ LAYER8_POLICY_ENABLED: "TRUE", LAYER8_POLICY_PUBLIC_JWKS: "invalid" });
    expect(fromEnv.enabled).toBe(false);
    expect(fromEnv.publicJwks).toBeUndefined();
    const adapter = createLayer8PolicyClient(fromEnv);
    expect(JSON.stringify(adapter.status())).not.toMatch(/token|endpoint|jwks/i);
  });

  it("loads only valid tenant credentials from the dedicated environment mapping", () => {
    expect(layer8ConfigFromEnvironment({ LAYER8_POLICY_CREDENTIALS_JSON: JSON.stringify({ [context.tenantId]: tenantToken }) })
      .tenantServiceTokens).toEqual({ [context.tenantId]: tenantToken });
    for (const value of ["invalid", "null", "[]", "{}", JSON.stringify({ invalid: tenantToken })]) {
      expect(layer8ConfigFromEnvironment({ LAYER8_POLICY_CREDENTIALS_JSON: value,
        LAYER8_POLICY_SERVICE_TOKEN: "legacy-global-token" }).tenantServiceTokens).toBeUndefined();
    }
    expect(layer8ConfigFromEnvironment({ LAYER8_POLICY_SERVICE_TOKEN: "legacy-global-token" }).tenantServiceTokens).toBeUndefined();
  });

  it("labels a valid configuration unverified, not provider-ready", () => {
    expect(client().status()).toMatchObject({ enabled: true, configured: true, state: "configured_unverified" });
  });
});
