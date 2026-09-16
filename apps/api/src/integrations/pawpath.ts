import { z } from "zod";
import { integrationContextSchema, type IntegrationContext } from "./context.js";

export const nearbyRequestSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  radiusMeters: z.number().int().min(100).max(5000).default(5000),
  shareLocation: z.literal(true)
}).strict();
export type NearbyRequest = z.infer<typeof nearbyRequestSchema>;
const usersSchema = z.array(z.object({
  id: z.string().min(1).max(128), displayName: z.string().max(256), petName: z.string().max(256),
  latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180),
  updatedAtMillis: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
})).max(200);
export interface PawPathDelegation {
  provider: "pawpath"; userId: string; tenantId: string; bearerToken: string;
}
export interface PawPathConfig { enabled?: boolean; baseUrl?: string; timeoutMs?: number }
export interface PawPathDependencies {
  fetch?: typeof fetch;
  resolveDelegation?: (context: IntegrationContext, signal?: AbortSignal) => Promise<PawPathDelegation | undefined>;
}
export class PawPathIntegrationError extends Error {
  constructor(readonly code: string, readonly statusCode = 503) { super(code); }
}
export function createPawPathAdapter(suppliedConfig: PawPathConfig = {}, suppliedDependencies: PawPathDependencies = {}) {
  const config = { ...suppliedConfig };
  const dependencies = { ...suppliedDependencies };
  let origin: string | undefined;
  try {
    const url = new URL(config.baseUrl ?? "");
    // Operator-controlled public origin, not a caller-supplied proxy URL.
    if (url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash &&
        url.pathname === "/" && !url.port && !/^(localhost|.*\.localhost|.*\.local|[\d.]+|\[.*\])$/.test(url.hostname.replace(/\.$/, ""))) origin = url.origin;
  } catch { /* invalid/unset remains disabled */ }
  const configured = Boolean(origin && dependencies.resolveDelegation);
  const timeoutMs = config.timeoutMs ?? 5000;
  const validTimeout = Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 10_000;
  const status = () => ({ enabled: config.enabled === true, configured: configured && validTimeout,
    state: config.enabled === true && configured && validTimeout ? "configured_unverified" : "unavailable" });
  return {
    status,
    async nearby(context: IntegrationContext, input: NearbyRequest) {
      if (config.enabled !== true || !configured || !validTimeout) throw new PawPathIntegrationError("pawpath_unavailable");
      const checkedContext = integrationContextSchema.safeParse(context);
      const checkedInput = nearbyRequestSchema.safeParse(input);
      if (!checkedContext.success || !checkedInput.success) {
        throw new PawPathIntegrationError("invalid_pawpath_request", 400);
      }
      // Zod snapshots retain validated values and defaults across async boundaries.
      const { userId, tenantId } = checkedContext.data;
      const location = checkedInput.data;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new PawPathIntegrationError("pawpath_timeout", 504)); }, timeoutMs);
      });
      try {
        return await Promise.race([deadline, (async () => {
          const delegation = await dependencies.resolveDelegation!(checkedContext.data, controller.signal);
          if (!delegation || delegation.provider !== "pawpath" || delegation.userId !== userId ||
              delegation.tenantId !== tenantId || typeof delegation.bearerToken !== "string" ||
              !/^[A-Za-z0-9._~+\/-]{1,8192}={0,2}$/.test(delegation.bearerToken)) {
            throw new PawPathIntegrationError("pawpath_identity_link_required", 403);
          }
          // Check again after an async resolver: do not start a request after the deadline.
          controller.signal.throwIfAborted();
          const url = new URL("/api/pawpath/map/users", origin);
          url.searchParams.set("lat", String(location.latitude));
          url.searchParams.set("lng", String(location.longitude));
          url.searchParams.set("radiusMeters", String(location.radiusMeters));
          const response = await (dependencies.fetch ?? fetch)(url, {
            headers: { authorization: `Bearer ${delegation.bearerToken}`, accept: "application/json" },
            redirect: "error", signal: controller.signal
          });
          if (controller.signal.aborted) {
            void response.body?.cancel().catch(() => {});
            controller.signal.throwIfAborted();
          }
          if (!response.ok) {
            void response.body?.cancel().catch(() => {});
            throw new PawPathIntegrationError(response.status === 401 || response.status === 403 ? "pawpath_access_denied" : "pawpath_provider_unavailable",
              response.status === 401 || response.status === 403 ? 403 : 502);
          }
          if (response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json" || !response.body) {
            void response.body?.cancel().catch(() => {});
            throw new PawPathIntegrationError("pawpath_invalid_response", 502);
          }
          const reader = response.body.getReader();
          const cancel = () => { void reader.cancel().catch(() => {}); };
          controller.signal.addEventListener("abort", cancel, { once: true });
          const chunks: Uint8Array[] = [];
          let bytes = 0;
          try {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              bytes += chunk.value.byteLength;
              if (bytes > 131072) throw new PawPathIntegrationError("pawpath_response_too_large", 502);
              chunks.push(chunk.value);
            }
          } finally {
            controller.signal.removeEventListener("abort", cancel);
            cancel();
            reader.releaseLock();
          }
          controller.signal.throwIfAborted();
          let payload: unknown;
          try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
          catch { throw new PawPathIntegrationError("pawpath_invalid_response", 502); }
          const parsed = usersSchema.safeParse(payload);
          if (!parsed.success) throw new PawPathIntegrationError("pawpath_invalid_response", 502);
          return { users: parsed.data, source: "pawpath" as const };
        })()]);
      } catch (error) {
        if (error instanceof PawPathIntegrationError) throw error;
        throw new PawPathIntegrationError("pawpath_provider_unavailable", 502);
      } finally { clearTimeout(timer); controller.abort(); }
    }
  };
}
