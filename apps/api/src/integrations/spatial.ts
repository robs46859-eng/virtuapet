import { isIP } from "node:net";
import {
  validateSpatialAssetManifest,
  type ManifestValidationOptions,
  type SpatialAssetManifest,
} from "@virtuapet/contracts";
import { z } from "zod";
import { integrationContextSchema, type IntegrationContext } from "./context.js";

export class SpatialIntegrationError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "SpatialIntegrationError";
  }
}

export interface SpatialDelegation {
  provider: "pawsome3d";
  userId: string;
  tenantId: string;
  orderId: string;
  bearerToken: string;
}

export interface Pawsome3DPreviewConfig {
  enabled?: boolean;
  baseUrl?: string;
  allowedAssetOrigins?: string[];
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface Pawsome3DPreviewDependencies {
  /** Server-owned, consent-checked account/order link; never construct from caller headers. */
  resolveDelegation?: (context: IntegrationContext, orderId: string) => Promise<SpatialDelegation | undefined>;
  fetch?: typeof fetch;
}

const uuid = z.string().uuid();
const previewSchema = z.object({
  url: z.string().url().max(8192),
  versionId: z.number().int().positive().safe(),
  expiresInSeconds: z.number().int().positive().max(3600),
}).strict();

export interface SpatialPreview {
  provider: "pawsome3d";
  orderId: string;
  tenantId: string;
  userId: string;
  preview: z.infer<typeof previewSchema>;
  usage: "visual_preview_only";
  clinicalUse: false;
}

/** URLs are operator configuration, never user-supplied proxy destinations. */
function safeHttpsUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new SpatialIntegrationError("spatial_unsafe_url", 502); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      (url.port && url.port !== "443") || isIP(host.replace(/^\[|\]$/g, "")) ||
      !host.includes(".") || host.endsWith(".") ||
      ["localhost", ".localhost", ".local", ".internal", ".test", ".invalid"].some(suffix => host === suffix || host.endsWith(suffix))) {
    throw new SpatialIntegrationError("spatial_unsafe_url", 502);
  }
  return url;
}

function configuredOrigin(value: string): string {
  const url = safeHttpsUrl(value);
  if (url.pathname !== "/" || url.search) throw new SpatialIntegrationError("spatial_invalid_configuration", 503);
  return url.origin;
}

function assertContext(context: IntegrationContext): void {
  if (!integrationContextSchema.safeParse(context).success) {
    throw new SpatialIntegrationError("spatial_invalid_context", 403);
  }
}

async function boundedJson(response: Response, maximum: number): Promise<unknown> {
  const type = response.headers.get("content-type")?.split(";")[0]?.trim();
  const length = Number(response.headers.get("content-length") ?? 0);
  if (type !== "application/json" || !Number.isFinite(length) || length < 0 || length > maximum || !response.body) {
    throw new SpatialIntegrationError("spatial_invalid_response", 502);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maximum) throw new SpatialIntegrationError("spatial_response_too_large", 502);
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function createPawsome3DPreviewAdapter(
  inputConfig: Pawsome3DPreviewConfig = {},
  dependencies: Pawsome3DPreviewDependencies = {},
) {
  const config = Object.freeze({ ...inputConfig, allowedAssetOrigins: Object.freeze([...(inputConfig.allowedAssetOrigins ?? [])]) });
  const { resolveDelegation, fetch: configuredFetch } = dependencies;
  const timeoutMs = config.timeoutMs ?? 5000;
  const maximum = config.maxResponseBytes ?? 16_384;
  const parseConfiguration = () => {
    if (!config.baseUrl || !config.allowedAssetOrigins.length || !resolveDelegation) {
      throw new SpatialIntegrationError("spatial_not_configured", 503);
    }
    const base = configuredOrigin(config.baseUrl);
    const assetOrigins = config.allowedAssetOrigins.map(configuredOrigin);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15_000 ||
        !Number.isInteger(maximum) || maximum < 128 || maximum > 65_536) {
      throw new SpatialIntegrationError("spatial_invalid_configuration", 503);
    }
    return { base, assetOrigins, resolve: resolveDelegation };
  };
  return {
    status() {
      let configured = false;
      try { parseConfiguration(); configured = true; } catch { /* Status is deliberately redacted. */ }
      return {
        provider: "pawsome3d" as const, enabled: config.enabled === true, configured,
        state: config.enabled !== true ? "disabled" as const : configured ? "configured_unverified" as const : "not_configured" as const,
      };
    },
    async getPreview(context: IntegrationContext, orderId: string): Promise<SpatialPreview> {
      if (config.enabled !== true) throw new SpatialIntegrationError("spatial_integration_disabled", 503);
      assertContext(context);
      if (!uuid.safeParse(orderId).success) throw new SpatialIntegrationError("spatial_invalid_order", 400);
      const { base, assetOrigins, resolve } = parseConfiguration();
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new SpatialIntegrationError("spatial_provider_timeout", 504));
        }, timeoutMs);
      });
      const operation = async () => {
        // Provider has separate account JWTs and no tenant claim. The server-owned
        // link and provider authorization are both required and must both fit the deadline.
        let delegation: SpatialDelegation | undefined;
        try { delegation = await resolve(context, orderId); }
        catch { throw new SpatialIntegrationError("spatial_delegation_unavailable", 503); }
        if (controller.signal.aborted) throw new SpatialIntegrationError("spatial_provider_timeout", 504);
        if (!delegation || delegation.provider !== "pawsome3d" || delegation.userId !== context.userId ||
            delegation.tenantId !== context.tenantId || delegation.orderId !== orderId ||
            !/^[A-Za-z0-9._~+\/-]+=*$/.test(delegation.bearerToken) || delegation.bearerToken.length > 8192) {
          throw new SpatialIntegrationError("spatial_delegation_denied", 403);
        }
        const response = await (configuredFetch ?? fetch)(
          `${base}/api/pet-glb/orders/${encodeURIComponent(orderId)}/stages/current/preview`,
          {
            method: "GET",
            redirect: "manual",
            signal: controller.signal,
            headers: { authorization: `Bearer ${delegation.bearerToken}`, accept: "application/json" },
          },
        );
        if (response.status !== 200) {
          void response.body?.cancel().catch(() => undefined);
          if (response.status === 401) throw new SpatialIntegrationError("spatial_provider_unauthorized", 424);
          if (response.status === 403 || response.status === 404) throw new SpatialIntegrationError("spatial_order_unavailable", 404);
          throw new SpatialIntegrationError("spatial_provider_unavailable", 502);
        }
        const parsed = previewSchema.safeParse(await boundedJson(response, maximum));
        if (!parsed.success) throw new SpatialIntegrationError("spatial_invalid_response", 502);
        const assetUrl = safeHttpsUrl(parsed.data.url);
        if (!assetOrigins.includes(assetUrl.origin)) throw new SpatialIntegrationError("spatial_untrusted_asset_origin", 502);
        return {
          provider: "pawsome3d" as const, orderId, tenantId: context.tenantId, userId: context.userId,
          preview: parsed.data, usage: "visual_preview_only" as const, clinicalUse: false as const,
        };
      };
      try { return await Promise.race([operation(), deadline]); }
      catch (error) {
        if (error instanceof SpatialIntegrationError) throw error;
        throw new SpatialIntegrationError("spatial_provider_unavailable", 502);
      } finally {
        if (timer) clearTimeout(timer);
        controller.abort();
      }
    },
  };
}

export interface GibiWorldHandoffOptions extends Required<Pick<ManifestValidationOptions,
  "verificationKey" | "actualSha256" | "clientVersion" | "grantedEntitlements" |
  "supportedUnits" | "supportedUpAxes" | "supportedForwardAxes" | "expectedLaterality">> {
  allowedAssetOrigins: string[];
  now?: Date;
}

/** Server-side preflight only. Never send the HMAC verification key to a client. */
export function validateGibiWorldHandoff(
  input: unknown,
  context: IntegrationContext,
  options: GibiWorldHandoffOptions,
): { manifest: Omit<SpatialAssetManifest, "signature">; usage: "visual_preview_only"; clinicalUse: false } {
  assertContext(context);
  if (!options.verificationKey || !/^[a-f0-9]{64}$/i.test(options.actualSha256) ||
      !/^\d+\.\d+\.\d+$/.test(options.clientVersion) ||
      options.clientVersion.split(".").some(part => !Number.isSafeInteger(Number(part))) ||
      !Array.isArray(options.grantedEntitlements) || !options.supportedUnits?.length ||
      !options.supportedUpAxes?.length || !options.supportedForwardAxes?.length ||
      !["L", "R", "bilateral", "not_applicable"].includes(options.expectedLaterality) ||
      !options.allowedAssetOrigins?.length || (options.now && !Number.isFinite(options.now.getTime()))) {
    throw new SpatialIntegrationError("spatial_handoff_context_incomplete", 403);
  }
  const result = validateSpatialAssetManifest(input, options);
  if (!result.valid || !result.manifest) throw new SpatialIntegrationError("spatial_manifest_rejected", 403);
  const manifest = result.manifest;
  if (manifest.tenantId !== context.tenantId || manifest.ownerId !== context.userId) {
    throw new SpatialIntegrationError("spatial_manifest_scope_denied", 403);
  }
  if (![manifest.scale, ...manifest.origin, ...manifest.bounds.min, ...manifest.bounds.max].every(Number.isFinite) ||
      !options.allowedAssetOrigins.map(configuredOrigin).includes(safeHttpsUrl(manifest.glbUri).origin)) {
    throw new SpatialIntegrationError("spatial_manifest_rejected", 403);
  }
  // Preserve the legacy signed contract internally; this response makes no
  // claim that the Unity runtime supports a new cryptographic transport yet.
  const { signature: _signature, ...unsigned } = manifest;
  return { manifest: unsigned, usage: "visual_preview_only", clinicalUse: false };
}
