import { beforeAll, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet, type JWTPayload } from "jose";
import type { IntegrationContext } from "./context.js";
import { createLayer8PolicyClient, layer8ConfigFromEnvironment, LAYER8_POLICY_PROTOCOL, type Layer8PolicyConfig } from "./layer8.js";

const context: IntegrationContext = {
  userId: "04240ca7-5f6b-497b-89f8-dd4aad574a60", tenantId: "5a0a47a1-402e-437b-8082-f123402ab9d7",
  roles: ["veterinarian"], correlationId: "394c6b7d-d2bf-49e1-acbf-e9490b990146"
};
const request = { action: "spatial.read", resource: "asset:unit-test", purpose: "consumer_preview", requiredEntitlements: ["spatial.asset.view"] };
const nowSeconds = 1_800_000_000;
let privateKey: CryptoKey;
let publicJwks: JSONWebKeySet;
beforeAll(async () => {
  const keys = await generateKeyPair("ES256");
  privateKey = keys.privateKey;
  publicJwks = { keys: [{ ...await exportJWK(keys.publicKey), kid: "test-policy-key", alg: "ES256", use: "sig" }] };
});
function config(overrides: Partial<Layer8PolicyConfig> = {}): Layer8PolicyConfig {
  return { enabled: true, endpoint: "https://policy.example.com/explicitly-proposed", serviceToken: "unit-test-service-token-only",
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
function client(fetcher: typeof fetch = provider(), overrides: Partial<Layer8PolicyConfig> = {}) {
  return createLayer8PolicyClient(config(overrides), { fetch: fetcher, now: () => new Date(nowSeconds * 1000) });
}

describe("Layer8 proposed signed-policy adapter", () => {
  it("is default off, reports the proposed protocol, and sends no request while disabled", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const adapter = createLayer8PolicyClient({}, { fetch: fetcher });
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
    expect(JSON.parse(String(options?.body))).not.toHaveProperty("roles");
    expect(options?.headers).toMatchObject({ authorization: "Bearer unit-test-service-token-only" });
    expect(decision).not.toHaveProperty("decisionToken");
  });

  it.each([
    { endpoint: "http://policy.example.com" }, { endpoint: "https://user:password@policy.example.com" },
    { endpoint: "https://policy.example.com/?key=secret" }, { endpoint: "https://policy.example.com/#key" },
    { endpoint: "https://policy.example.com:8443" }, { serviceToken: "unsafe\r\nheader" },
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

  it.each([
    { tenantId: "27138277-7967-4059-b8ab-6041b2497e5d" }, { sub: "27138277-7967-4059-b8ab-6041b2497e5d" },
    { action: "billing.charge" }, { resource: "asset:different" }, { purpose: "surgery" },
    { action: "spatial.read " }, { purpose: "consumer_preview\n" },
    { correlationId: "27138277-7967-4059-b8ab-6041b2497e5d" }, { requestId: "27138277-7967-4059-b8ab-6041b2497e5d" },
    { exp: nowSeconds }, { iat: nowSeconds + 1 }, { exp: nowSeconds + 61 },
    { iat: nowSeconds - 120, exp: nowSeconds + 1 }, { nbf: nowSeconds + 1 },
    { iss: "https://attacker.example.com" }, { aud: "other-product" }, { protocol: "unknown" },
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

  it("does not expose or silently enable environment configuration", async () => {
    const fromEnv = layer8ConfigFromEnvironment({ LAYER8_POLICY_ENABLED: "TRUE", LAYER8_POLICY_PUBLIC_JWKS: "invalid" });
    expect(fromEnv.enabled).toBe(false);
    expect(fromEnv.publicJwks).toBeUndefined();
    const adapter = createLayer8PolicyClient(fromEnv);
    expect(JSON.stringify(adapter.status())).not.toMatch(/token|endpoint|jwks/i);
  });

  it("labels a valid configuration unverified, not provider-ready", () => {
    expect(client().status()).toMatchObject({ enabled: true, configured: true, state: "configured_unverified" });
  });
});
