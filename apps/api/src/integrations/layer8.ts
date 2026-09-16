import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { z } from "zod";
import { integrationContextSchema, type IntegrationContext } from "./context.js";

/** Shared signed-policy protocol; configuration alone does not establish deployed readiness. */
export const LAYER8_POLICY_PROTOCOL = "virtuapet.layer8.policy.v1" as const;
const tokenType = "vp-layer8-policy+jwt";
const boundedText = z.string().min(1).max(256)
  .refine(value => value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value), "noncanonical text");
export const layer8PolicyRequestSchema = z.object({
  action: boundedText,
  resource: boundedText,
  purpose: boundedText,
  requiredEntitlements: z.array(boundedText).max(32).default([])
}).strict();
export type Layer8PolicyRequest = z.input<typeof layer8PolicyRequestSchema>;

export interface Layer8PolicyConfig {
  enabled?: boolean;
  endpoint?: string;
  /** VirtuaPet tenant UUID to dedicated Layer8 API key with virtuapet:policy scope. */
  tenantServiceTokens?: Record<string, string>;
  issuer?: string;
  audience?: string;
  publicJwks?: JSONWebKeySet;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface Layer8IdentityProof {
  proofToken: string;
}

/** Resolves only an active, server-verified account link belonging to this context. */
export type Layer8IdentityProofResolver = (context: IntegrationContext) => Promise<Layer8IdentityProof | undefined>;

export interface Layer8PolicyDependencies {
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  resolveIdentityProof?: Layer8IdentityProofResolver;
}

const tenantServiceTokensSchema = z.record(
  z.string().uuid().refine(value => value === value.toLowerCase(), "noncanonical tenant"),
  z.string().regex(/^[\x21-\x7e]{16,4096}$/)
).refine(value => Object.keys(value).length > 0, "tenant credentials required");
const identityProofTokenSchema = z.string().max(15000).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

export class Layer8IntegrationError extends Error {
  constructor(readonly code: string, readonly httpStatus: 400 | 403 | 503 = 503) {
    super(code);
    this.name = "Layer8IntegrationError";
  }
}

export interface Layer8AllowedDecision {
  decisionId: string;
  policyVersion: string;
  outcome: "allow";
  entitlements: string[];
  expiresAt: string;
  correlationId: string;
}

const signedDecisionSchema = z.object({
  iss: boundedText,
  aud: z.union([boundedText, z.array(boundedText).min(1).max(8)]),
  sub: z.string().uuid(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().nonnegative(),
  nbf: z.number().int().nonnegative().optional(),
  jti: z.string().uuid(),
  protocol: z.literal(LAYER8_POLICY_PROTOCOL),
  tenantId: z.string().uuid(),
  correlationId: z.string().uuid(),
  requestId: z.string().uuid(),
  action: boundedText,
  resource: boundedText,
  purpose: boundedText,
  policyVersion: boundedText,
  outcome: z.enum(["allow", "deny"]),
  entitlements: z.array(boundedText).max(64),
  // No obligations are implemented yet. Unknown obligations must not become implicit grants.
  obligations: z.array(z.unknown()).max(16)
}).strict();

function validConfiguration(config: Layer8PolicyConfig): boolean {
  try {
    const endpoint = new URL(config.endpoint ?? "");
    const host = endpoint.hostname.toLowerCase();
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search ||
        endpoint.hash || (endpoint.port && endpoint.port !== "443") ||
        isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".") || host.endsWith(".") ||
        ["localhost", ".localhost", ".local", ".internal", ".test", ".invalid"].some(suffix => host === suffix || host.endsWith(suffix))) return false;
    if (!tenantServiceTokensSchema.safeParse(config.tenantServiceTokens).success) return false;
    if (!boundedText.safeParse(config.issuer).success || !boundedText.safeParse(config.audience).success) return false;
    if (!config.publicJwks || !Array.isArray(config.publicJwks.keys) || config.publicJwks.keys.length < 1 ||
        config.publicJwks.keys.length > 8) return false;
    const ids = new Set<string>();
    for (const key of config.publicJwks.keys) {
      if (!key.kid || ids.has(key.kid) || !["RSA", "EC"].includes(key.kty ?? "")) return false;
      if (["d", "p", "q", "dp", "dq", "qi", "oth", "k"].some(field => field in key)) return false;
      if (key.use !== undefined && key.use !== "sig") return false;
      if (key.key_ops !== undefined && (key.key_ops.length !== 1 || key.key_ops[0] !== "verify")) return false;
      if (key.kty === "RSA" && (key.alg !== "RS256" || !key.n || !key.e)) return false;
      if (key.kty === "EC" && (key.alg !== "ES256" || key.crv !== "P-256" || !key.x || !key.y)) return false;
      ids.add(key.kid);
    }
    if (!Number.isInteger(config.timeoutMs ?? 5000) || (config.timeoutMs ?? 5000) < 1 || (config.timeoutMs ?? 5000) > 30000) return false;
    if (!Number.isInteger(config.maxResponseBytes ?? 16384) || (config.maxResponseBytes ?? 16384) < 512 || (config.maxResponseBytes ?? 16384) > 65536) return false;
    return true;
  } catch { return false; }
}

async function boundedJson(response: Response, maxBytes: number, signal: AbortSignal): Promise<unknown> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Layer8IntegrationError("layer8_unavailable");
  }
  if (response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    await response.body?.cancel();
    throw new Layer8IntegrationError("layer8_invalid_evidence");
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    await response.body?.cancel();
    throw new Layer8IntegrationError("layer8_response_too_large");
  }
  if (!response.body) throw new Layer8IntegrationError("layer8_invalid_evidence");
  const reader = response.body.getReader();
  const cancelRead = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancelRead, { once: true });
  if (signal.aborted) cancelRead();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Layer8IntegrationError("layer8_response_too_large");
      }
      chunks.push(next.value);
    }
  } finally {
    signal.removeEventListener("abort", cancelRead);
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export function layer8ConfigFromEnvironment(env: NodeJS.ProcessEnv = process.env): Layer8PolicyConfig {
  let publicJwks: JSONWebKeySet | undefined;
  let tenantServiceTokens: Record<string, string> | undefined;
  try { publicJwks = JSON.parse(env.LAYER8_POLICY_PUBLIC_JWKS ?? "null") ?? undefined; } catch { /* Invalid config remains fail-closed. */ }
  try {
    const parsed = tenantServiceTokensSchema.safeParse(JSON.parse(env.LAYER8_POLICY_CREDENTIALS_JSON ?? "null"));
    if (parsed.success) tenantServiceTokens = parsed.data;
  } catch { /* Invalid credentials remain fail-closed; there is no global-token fallback. */ }
  return {
    enabled: env.LAYER8_POLICY_ENABLED === "true",
    ...(env.LAYER8_POLICY_ENDPOINT ? { endpoint: env.LAYER8_POLICY_ENDPOINT } : {}),
    ...(tenantServiceTokens ? { tenantServiceTokens } : {}),
    ...(env.LAYER8_POLICY_ISSUER ? { issuer: env.LAYER8_POLICY_ISSUER } : {}),
    ...(env.LAYER8_POLICY_AUDIENCE ? { audience: env.LAYER8_POLICY_AUDIENCE } : {}),
    ...(publicJwks ? { publicJwks } : {})
  };
}

export function createLayer8PolicyClient(
  suppliedConfig: Layer8PolicyConfig = {},
  dependencies: Layer8PolicyDependencies = {}
) {
  // Snapshot configuration: an external mutation must not replace a trusted key/endpoint in flight.
  const config = structuredClone(suppliedConfig);
  const resolveIdentityProof = dependencies.resolveIdentityProof;
  const configured = validConfiguration(config) && typeof resolveIdentityProof === "function";
  const enabled = config.enabled === true;
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  const clock = dependencies.now ?? (() => new Date());
  const jwks = configured ? createLocalJWKSet(config.publicJwks!) : undefined;
  return {
    status: () => ({ enabled, configured, protocol: LAYER8_POLICY_PROTOCOL,
      state: !enabled ? "disabled" as const : !configured ? "unconfigured" as const : "configured_unverified" as const }),
    async authorize(context: IntegrationContext, request: Layer8PolicyRequest): Promise<Layer8AllowedDecision> {
      if (!enabled) throw new Layer8IntegrationError("layer8_disabled");
      if (!configured || !jwks) throw new Layer8IntegrationError("layer8_unconfigured");
      const validContext = integrationContextSchema.safeParse(context);
      const validRequest = layer8PolicyRequestSchema.safeParse(request);
      if (!validContext.success || !validRequest.success) throw new Layer8IntegrationError("layer8_invalid_request", 400);
      const serviceToken = Object.hasOwn(config.tenantServiceTokens!, validContext.data.tenantId)
        ? config.tenantServiceTokens![validContext.data.tenantId] : undefined;
      if (!serviceToken) throw new Layer8IntegrationError("layer8_tenant_unconfigured");
      const requestId = randomUUID();
      const input = { protocol: LAYER8_POLICY_PROTOCOL, requestId,
        subject: validContext.data.userId, tenantId: validContext.data.tenantId,
        correlationId: validContext.data.correlationId, ...validRequest.data };
      const controller = new AbortController();
      const deadline = performance.now() + (config.timeoutMs ?? 5000);
      const requireWithinDeadline = () => {
        if (controller.signal.aborted || performance.now() >= deadline) throw new Layer8IntegrationError("layer8_timeout");
      };
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Start the deadline before lookup, including resolvers that ignore cancellation.
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Layer8IntegrationError("layer8_timeout"));
          }, config.timeoutMs ?? 5000);
        });
        const operation = async () => {
          let proof: Layer8IdentityProof | undefined;
          try {
            proof = await resolveIdentityProof!(structuredClone(validContext.data));
          } catch {
            requireWithinDeadline();
            throw new Layer8IntegrationError("layer8_identity_unavailable");
          }
          // A lookup resolving after timeout must never initiate an outbound request.
          requireWithinDeadline();
          const identityProof = identityProofTokenSchema.safeParse(proof?.proofToken);
          if (!identityProof.success) throw new Layer8IntegrationError("layer8_identity_required", 403);
          const response = await fetcher(config.endpoint!, {
            method: "POST", redirect: "error", signal: controller.signal,
            headers: { authorization: `Bearer ${serviceToken}`, "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({ ...input, identityProof: identityProof.data })
          });
          requireWithinDeadline();
          const envelope = z.object({ decisionToken: z.string().min(1).max(15000) }).strict()
            .parse(await boundedJson(response, config.maxResponseBytes ?? 16384, controller.signal));
          const now = clock();
          if (!Number.isFinite(now.getTime())) throw new Layer8IntegrationError("layer8_invalid_clock");
          const { payload, protectedHeader } = await jwtVerify(envelope.decisionToken, jwks, {
            algorithms: ["RS256", "ES256"], issuer: config.issuer!, audience: config.audience!,
            typ: tokenType, currentDate: now, clockTolerance: 0,
            requiredClaims: ["iss", "aud", "sub", "exp", "iat", "jti"]
          });
          if (!protectedHeader.kid || !config.publicJwks!.keys.some(key => key.kid === protectedHeader.kid)) {
            throw new Layer8IntegrationError("layer8_invalid_evidence");
          }
          const decision = signedDecisionSchema.parse(payload);
          const nowSeconds = Math.floor(now.getTime() / 1000);
          if (decision.sub !== input.subject || decision.tenantId !== input.tenantId ||
              decision.correlationId !== input.correlationId || decision.requestId !== requestId ||
              decision.action !== input.action || decision.resource !== input.resource || decision.purpose !== input.purpose ||
              decision.iat > nowSeconds || decision.exp <= nowSeconds || decision.exp <= decision.iat ||
              decision.exp - decision.iat > 60 || nowSeconds - decision.iat > 60) {
            throw new Layer8IntegrationError("layer8_invalid_evidence");
          }
          if (decision.outcome !== "allow" || decision.obligations.length > 0 ||
              !input.requiredEntitlements.every(value => decision.entitlements.includes(value))) {
            throw new Layer8IntegrationError("layer8_denied", 403);
          }
          requireWithinDeadline();
          return { decisionId: decision.jti, policyVersion: decision.policyVersion, outcome: "allow" as const,
            entitlements: decision.entitlements, expiresAt: new Date(decision.exp * 1000).toISOString(),
            correlationId: decision.correlationId };
        };
        return await Promise.race([operation(), timeout]);
      } catch (error) {
        if (error instanceof Layer8IntegrationError) throw error;
        // Never forward provider errors, tokens, response bodies, or endpoint details to the caller.
        throw new Layer8IntegrationError("layer8_invalid_evidence");
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        controller.abort();
      }
    }
  };
}

export type Layer8PolicyClient = ReturnType<typeof createLayer8PolicyClient>;
