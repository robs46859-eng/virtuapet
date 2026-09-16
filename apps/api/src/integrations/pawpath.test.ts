import { describe, expect, it, vi } from "vitest";
import { createPawPathAdapter, type PawPathDelegation } from "./pawpath.js";
import type { IntegrationContext } from "./context.js";
const context: IntegrationContext = { userId: "04240ca7-5f6b-497b-89f8-dd4aad574a60", tenantId: "5a0a47a1-402e-437b-8082-f123402ab9d7", roles: ["guardian"], correlationId: "27138277-7967-4059-b8ab-6041b2497e5d" };
const input = { latitude: 39.7, longitude: -104.9, radiusMeters: 5000, shareLocation: true as const };
const config = { enabled: true, baseUrl: "https://partner.example.com" };
const delegation = { provider: "pawpath" as const, userId: context.userId, tenantId: context.tenantId, bearerToken: "provider-user-token" };
const resolveDelegation = async () => delegation;
describe("PawPath read-only bridge", () => {
  it("stays unavailable without explicit enablement and server identity resolver", async () => {
    const call = vi.fn();
    await expect(createPawPathAdapter({}, { fetch: call }).nearby(context, input)).rejects.toMatchObject({ code: "pawpath_unavailable" });
    await expect(createPawPathAdapter(config, { fetch: call }).nearby(context, input)).rejects.toMatchObject({ code: "pawpath_unavailable" });
    expect(call).not.toHaveBeenCalled();
  });
  it("uses the observed route, dedicated token and strips unexpected provider fields", async () => {
    const call = vi.fn(async () => Response.json([{ id: "42", displayName: "Test", petName: "Pet", latitude: 39, longitude: -105, updatedAtMillis: 1, phone: "must-not-expose" }]));
    const output = await createPawPathAdapter(config, { resolveDelegation, fetch: call }).nearby(context, input);
    expect(output.users[0]).not.toHaveProperty("phone");
    expect(String(call.mock.calls[0]?.[0])).toBe("https://partner.example.com/api/pawpath/map/users?lat=39.7&lng=-104.9&radiusMeters=5000");
    expect(call.mock.calls[0]?.[1]).toMatchObject({ redirect: "error", headers: { authorization: "Bearer provider-user-token" } });
  });
  it("denies a cross-tenant identity link before network access", async () => {
    const call = vi.fn();
    await expect(createPawPathAdapter(config, { fetch: call, resolveDelegation: async () => ({ ...delegation, tenantId: context.userId }) }).nearby(context, input)).rejects.toMatchObject({ statusCode: 403 });
    expect(call).not.toHaveBeenCalled();
  });
  it("requires affirmative location sharing", async () => {
    await expect(createPawPathAdapter(config, { resolveDelegation }).nearby(context, { ...input, shareLocation: false } as never)).rejects.toMatchObject({ statusCode: 400 });
  });
  it.each(["http://partner.example.com", "https://127.0.0.1", "https://localhost.", "https://service.local.", "https://user:pass@partner.example.com", "https://partner.example.com/override"])("rejects unsafe base %s", baseUrl => {
    expect(createPawPathAdapter({ ...config, baseUrl }, { resolveDelegation }).status().configured).toBe(false);
  });
  it.each([401, 403, 503])("handles upstream %s without echoing details", async status => {
    await expect(createPawPathAdapter(config, { resolveDelegation, fetch: async () => new Response("secret", { status }) }).nearby(context, input)).rejects.toMatchObject({ statusCode: status === 503 ? 502 : 403 });
  });
  it("rejects malformed and oversized provider output", async () => {
    for (const payload of [{ users: [] }, "x".repeat(140000)]) {
      await expect(createPawPathAdapter(config, { resolveDelegation, fetch: async () => Response.json(payload) }).nearby(context, input)).rejects.toMatchObject({ statusCode: 502 });
    }
  });
  it("bounds stalled fetches even if injected transport ignores abort", async () => {
    await expect(createPawPathAdapter({ ...config, timeoutMs: 10 }, { resolveDelegation, fetch: () => new Promise(() => {}) }).nearby(context, input)).rejects.toMatchObject({ code: "pawpath_timeout" });
  });
  it("uses the validated default radius when callers omit it", async () => {
    const call = vi.fn(async () => Response.json([]));
    const { radiusMeters: _radius, ...withoutRadius } = input;
    await createPawPathAdapter(config, { resolveDelegation, fetch: call }).nearby(context, withoutRadius as never);
    expect(String(call.mock.calls[0]?.[0])).toContain("radiusMeters=5000");
  });
  it.each([
    { ...input, latitude: NaN }, { ...input, longitude: Infinity }, { ...input, latitude: 91 },
    { ...input, longitude: -181 }, { ...input, latitude: "39.7" }, { ...input, radiusMeters: 5001 },
    { ...input, radiusMeters: 99 }, { ...input, radiusMeters: 100.5 },
    { ...input, tenantId: context.tenantId }, { ...input, shareLocation: false }
  ])("rejects invalid or extra location input before delegation %#", async candidate => {
    const resolver = vi.fn(resolveDelegation);
    const call = vi.fn();
    await expect(createPawPathAdapter(config, { resolveDelegation: resolver, fetch: call }).nearby(context, candidate as never))
      .rejects.toMatchObject({ code: "invalid_pawpath_request", statusCode: 400 });
    expect(resolver).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });
  it.each([
    { ...context, tenantId: "bad" }, { ...context, userId: "bad" },
    { ...context, correlationId: "bad" }, { ...context, roles: [] }, { ...context, admin: true }
  ])("rejects invalid integration context before delegation %#", async candidate => {
    const resolver = vi.fn(resolveDelegation);
    await expect(createPawPathAdapter(config, { resolveDelegation: resolver }).nearby(candidate, input))
      .rejects.toMatchObject({ code: "invalid_pawpath_request" });
    expect(resolver).not.toHaveBeenCalled();
  });
  it("snapshots validated context and coordinates before awaiting delegation", async () => {
    let resume!: (result: PawPathDelegation) => void;
    const deferred = new Promise<PawPathDelegation>(resolve => { resume = resolve; });
    const call = vi.fn(async () => Response.json([]));
    const mutableInput = { ...input };
    const mutableContext = { ...context };
    const result = createPawPathAdapter(config, { resolveDelegation: () => deferred, fetch: call }).nearby(mutableContext, mutableInput);
    mutableInput.latitude = 91;
    mutableContext.tenantId = context.userId;
    resume(delegation);
    await expect(result).resolves.toEqual({ users: [], source: "pawpath" });
    expect(String(call.mock.calls[0]?.[0])).toContain("lat=39.7");
  });
  it("requires strict boolean enablement", async () => {
    const call = vi.fn();
    await expect(createPawPathAdapter({ ...config, enabled: "true" as never }, { resolveDelegation, fetch: call }).nearby(context, input))
      .rejects.toMatchObject({ code: "pawpath_unavailable" });
    expect(call).not.toHaveBeenCalled();
  });
  it.each([undefined, null, 123, "contains whitespace", "token\r\ninjected"])("rejects malformed delegation token %#", async bearerToken => {
    const call = vi.fn();
    await expect(createPawPathAdapter(config, {
      fetch: call, resolveDelegation: async () => ({ ...delegation, bearerToken } as never)
    }).nearby(context, input)).rejects.toMatchObject({ code: "pawpath_identity_link_required" });
    expect(call).not.toHaveBeenCalled();
  });
  it("cancels a stalled resolver and never sends a late provider request", async () => {
    let resume!: (result: PawPathDelegation) => void;
    let signal: AbortSignal | undefined;
    const call = vi.fn();
    const result = createPawPathAdapter({ ...config, timeoutMs: 10 }, {
      fetch: call,
      resolveDelegation: async (_context, cancellation) => {
        signal = cancellation;
        return new Promise<PawPathDelegation>(resolve => { resume = resolve; });
      }
    }).nearby(context, input);
    await expect(result).rejects.toMatchObject({ code: "pawpath_timeout", statusCode: 504 });
    expect(signal?.aborted).toBe(true);
    resume(delegation);
    await Promise.resolve();
    await Promise.resolve();
    expect(call).not.toHaveBeenCalled();
  });
  it("cancels stalled response streams even if their cancellation never resolves", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const body = new ReadableStream<Uint8Array>({ cancel });
    const result = createPawPathAdapter({ ...config, timeoutMs: 10 }, {
      resolveDelegation,
      fetch: async () => new Response(body, { headers: { "content-type": "application/json" } })
    }).nearby(context, input);
    await expect(result).rejects.toMatchObject({ code: "pawpath_timeout", statusCode: 504 });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("rejects invalid JSON and media types without echoing provider data", async () => {
    for (const [body, contentType] of [["provider-secret-not-json", "application/json"], ["[]", "application/json-invalid"]]) {
      await expect(createPawPathAdapter(config, {
        resolveDelegation, fetch: async () => new Response(body, { headers: { "content-type": contentType! } })
      }).nearby(context, input)).rejects.toMatchObject({ code: "pawpath_invalid_response", statusCode: 502 });
    }
  });
});
